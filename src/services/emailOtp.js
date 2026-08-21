import { supabase } from '../lib/supabase'
import { sendOtpEmail } from '../lib/emailjs'

async function resolveRecipient({ email, fullName } = {}) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return { error }
  }

  const toEmail = String(email || user?.email || '')
    .trim()
    .toLowerCase()
  const toName =
    fullName ||
    user?.user_metadata?.full_name ||
    toEmail.split('@')[0] ||
    'User'

  if (!toEmail || !toEmail.includes('@')) {
    return {
      error: new Error(
        'Recipient email is empty. Sign out and sign up again with a valid email.',
      ),
    }
  }

  // Keep profiles.email in sync so UI never shows blank
  if (user?.id) {
    await supabase.from('profiles').update({ email: toEmail }).eq('id', user.id)
  }

  return { toEmail, toName, user }
}

/** Generate OTP in DB and send it with EmailJS */
export async function sendEmailOtp({ email, fullName } = {}) {
  const resolved = await resolveRecipient({ email, fullName })
  if (resolved.error) {
    return { error: resolved.error }
  }

  const { toEmail, toName } = resolved

  const { data: otp, error: otpError } = await supabase.rpc('request_email_otp', {})

  if (otpError) {
    return { error: otpError }
  }

  if (!otp) {
    return {
      error: new Error('OTP was not generated. Run supabase/email-otp.sql in SQL Editor.'),
    }
  }

  const { error: mailError } = await sendOtpEmail({
    toEmail,
    toName,
    otp,
  })

  return { error: mailError, toEmail }
}

export async function verifyEmailOtp(otp) {
  const { data, error } = await supabase.rpc('verify_email_otp', {
    otp: String(otp || '').trim(),
  })
  return { ok: Boolean(data), error }
}
