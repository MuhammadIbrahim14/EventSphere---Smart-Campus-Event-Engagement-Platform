// @ts-nocheck — Supabase Edge Function (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DOMAIN = 'students.eventsphere.local'

function normalizeEnrollment(raw: string) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

function syntheticEmail(enrollmentNo: string) {
  const enr = normalizeEnrollment(enrollmentNo)
  return `${enr.toLowerCase()}@${DOMAIN}`
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: json({ error: 'Missing auth' }, 401) }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return { error: json({ error: 'Sign in required' }, 401) }

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (String(profile?.role || '').toLowerCase() !== 'admin') {
    return { error: json({ error: 'Admin only' }, 403) }
  }

  return { user, admin, userClient }
}

async function provisionOne(
  admin: ReturnType<typeof createClient>,
  row: {
    enrollment_no?: string
    enrollmentNo?: string
    full_name?: string
    fullName?: string
    temp_password?: string
    tempPassword?: string
    department?: string
  },
  provisionedBy: string,
) {
  const enrollment = normalizeEnrollment(row.enrollment_no || row.enrollmentNo || '')
  const fullName = String(row.full_name || row.fullName || '').trim()
  const tempPassword = String(row.temp_password || row.tempPassword || '')
  const department = String(row.department || '').trim() || null

  if (!enrollment) return { ok: false, enrollment, error: 'Enrollment number required' }
  if (fullName.length < 2) return { ok: false, enrollment, error: 'Full name required' }
  if (tempPassword.length < 8) {
    return { ok: false, enrollment, error: 'Temp password must be at least 8 characters' }
  }

  const email = syntheticEmail(enrollment)

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'user')
    .ilike('enrollment_no', enrollment)
    .maybeSingle()

  if (existing?.id) {
    return { ok: false, enrollment, error: 'Enrollment already exists' }
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      enrollment_no: enrollment,
      role: 'user',
      provisioned: true,
    },
  })

  if (createErr || !created?.user?.id) {
    return {
      ok: false,
      enrollment,
      error: createErr?.message || 'Could not create auth user',
    }
  }

  const userId = created.user.id
  const now = new Date().toISOString()

  const { error: upsertErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: 'user',
      enrollment_no: enrollment,
      department,
      email_verified: true,
      must_change_password: true,
      provisioned: true,
      provisioned_at: now,
      provisioned_by: provisionedBy,
      personal_email: null,
      personal_email_verified: false,
      updated_at: now,
    },
    { onConflict: 'id' },
  )

  if (upsertErr) {
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch {
      /* ignore rollback failure */
    }
    return { ok: false, enrollment, error: upsertErr.message }
  }

  return { ok: true, enrollment, userId, email }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const gate = await requireAdmin(req)
    if (gate.error) return gate.error
    const { user, admin } = gate

    const body = await req.json()
    const batch = Array.isArray(body.students) ? body.students : null

    if (batch) {
      const results = []
      for (const row of batch) {
        results.push(await provisionOne(admin, row || {}, user.id))
      }
      const created = results.filter((r) => r.ok).length
      const failed = results.length - created
      return json({ ok: true, created, failed, results })
    }

    const one = await provisionOne(admin, body || {}, user.id)
    if (!one.ok) return json({ error: one.error, enrollment: one.enrollment }, 400)
    return json({ ok: true, ...one })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Provision error'
    return json({ error: message }, 500)
  }
})
