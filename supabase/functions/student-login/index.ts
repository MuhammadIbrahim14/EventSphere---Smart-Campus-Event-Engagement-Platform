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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)
    const anon = createClient(supabaseUrl, anonKey)

    const body = await req.json()
    const mode = String(body.mode || '').toLowerCase().trim()
    const identifier = String(body.identifier || body.id || '').trim()
    const password = String(body.password || '')

    if (!password) return json({ error: 'Password is required', code: 'invalid_credentials' }, 400)
    if (!identifier) return json({ error: 'Identifier is required', code: 'invalid_credentials' }, 400)

    let authEmail = ''

    if (mode === 'enrollment') {
      const enr = normalizeEnrollment(identifier)
      if (!enr) return json({ error: 'Enrollment number required', code: 'invalid_credentials' }, 400)

      const { data: profile } = await admin
        .from('profiles')
        .select('id, enrollment_no, role, provisioned')
        .eq('role', 'user')
        .ilike('enrollment_no', enr)
        .maybeSingle()

      if (!profile?.id) {
        return json({ error: 'Invalid enrollment or password', code: 'invalid_credentials' }, 401)
      }
      authEmail = syntheticEmail(profile.enrollment_no || enr)
    } else if (mode === 'email') {
      const emailNorm = identifier.toLowerCase()
      if (!emailNorm.includes('@')) {
        return json({ error: 'Enter a valid email', code: 'invalid_credentials' }, 400)
      }

      // Prefer verified personal email (provisioned students)
      const { data: byPersonal } = await admin
        .from('profiles')
        .select('id, enrollment_no, email, provisioned, personal_email_verified, personal_email')
        .eq('personal_email_verified', true)
        .ilike('personal_email', emailNorm)
        .maybeSingle()

      if (byPersonal?.id) {
        if (byPersonal.provisioned && byPersonal.enrollment_no) {
          authEmail = syntheticEmail(byPersonal.enrollment_no)
        } else {
          authEmail = String(byPersonal.email || emailNorm).toLowerCase()
        }
      } else {
        // Legacy / guest / staff: direct Auth email login
        authEmail = emailNorm
        // If this email is only someone's unverified personal_email, block
        const { data: unverified } = await admin
          .from('profiles')
          .select('id')
          .eq('personal_email_verified', false)
          .ilike('personal_email', emailNorm)
          .maybeSingle()
        if (unverified?.id) {
          return json(
            {
              error: 'Email not linked. Verify your email from Profile, or login with enrollment number.',
              code: 'email_not_linked',
            },
            403,
          )
        }
      }
    } else {
      return json({ error: 'mode must be enrollment or email', code: 'invalid_mode' }, 400)
    }

    const { data, error } = await anon.auth.signInWithPassword({
      email: authEmail,
      password,
    })

    if (error || !data?.session) {
      if (mode === 'email') {
        // Distinguish missing personal link when user typed email but only enrollment exists
        const { data: maybeProvisioned } = await admin
          .from('profiles')
          .select('id, personal_email_verified')
          .eq('provisioned', true)
          .ilike('email', authEmail)
          .maybeSingle()
        if (maybeProvisioned && !maybeProvisioned.personal_email_verified && mode === 'email') {
          /* fall through */
        }
      }
      return json(
        { error: error?.message || 'Invalid credentials', code: 'invalid_credentials' },
        401,
      )
    }

    return json({
      ok: true,
      session: data.session,
      user: data.user,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login error'
    return json({ error: message }, 500)
  }
})
