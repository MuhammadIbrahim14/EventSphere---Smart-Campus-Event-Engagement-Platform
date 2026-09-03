import { supabase } from '../lib/supabase'
import { sendOtpEmail } from '../lib/emailjs'

export async function sendPersonalEmailOtp(email) {
  const toEmail = String(email || '')
    .trim()
    .toLowerCase()
  if (!toEmail || !toEmail.includes('@')) {
    return { error: new Error('Enter a valid email address.') }
  }

  const { data: otp, error: otpError } = await supabase.rpc('request_personal_email_otp', {
    p_email: toEmail,
  })

  if (otpError) {
    return { error: otpError }
  }

  if (!otp) {
    return {
      error: new Error(
        'OTP was not generated. Run supabase/eventsphere-enrollment-auth.sql in the SQL Editor.',
      ),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const toName =
    user?.user_metadata?.full_name || toEmail.split('@')[0] || 'Student'

  const { error: mailError } = await sendOtpEmail({
    toEmail,
    toName,
    otp,
  })

  return { error: mailError, toEmail }
}

export async function verifyPersonalEmailOtp(otp) {
  const { data, error } = await supabase.rpc('verify_personal_email_otp', {
    p_otp: String(otp || '').trim(),
  })
  return { ok: Boolean(data), error }
}

export async function clearMustChangePassword() {
  const { data, error } = await supabase.rpc('clear_must_change_password')
  return { ok: Boolean(data), error }
}
