// @ts-nocheck — Supabase Edge Function (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing auth' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceKey)

    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Sign in required' }, 401)

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (String(profile?.role || '').toLowerCase() !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const body = await req.json()
    const studentId = String(body.studentId || body.userId || '').trim()
    const tempPassword = String(body.tempPassword || body.temp_password || '')

    if (!studentId) return json({ error: 'studentId required' }, 400)
    if (tempPassword.length < 8) {
      return json({ error: 'Temp password must be at least 8 characters' }, 400)
    }

    const { data: student } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', studentId)
      .maybeSingle()

    if (!student?.id || student.role !== 'user') {
      return json({ error: 'Student not found' }, 404)
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(studentId, {
      password: tempPassword,
    })
    if (updErr) return json({ error: updErr.message }, 400)

    const { error: flagErr } = await admin
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', studentId)

    if (flagErr) return json({ error: flagErr.message }, 400)

    return json({ ok: true, studentId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reset error'
    return json({ error: message }, 500)
  }
})
