import { supabase } from '../lib/supabase'
import { sendOtpEmail } from '../lib/emailjs'

export async function requestPasswordResetOtp(email) {
  const toEmail = String(email || '').trim().toLowerCase()
  if (!toEmail || !toEmail.includes('@')) {
    return { error: new Error('Enter a valid email address.') }
  }

  const { data: otp, error } = await supabase.rpc('request_password_reset_otp', {
    p_email: toEmail,
  })

  if (error) {
    if (String(error.message || '').toLowerCase().includes('request_password_reset_otp')) {
      return {
        error: new Error(
          'Password reset is not installed yet. Run supabase/eventsphere-password-reset.sql in the SQL Editor.',
        ),
      }
    }
    return { error }
  }

  if (otp) {
    const toName = toEmail.split('@')[0] || 'User'
    const { error: mailError } = await sendOtpEmail({ toEmail, toName, otp })
    if (mailError) return { error: mailError }
  }

  return { sent: true, toEmail }
}

export async function completePasswordReset({ email, otp, newPassword }) {
  const { data, error } = await supabase.rpc('complete_password_reset', {
    p_email: String(email || '').trim().toLowerCase(),
    p_otp: String(otp || '').trim(),
    p_new_password: newPassword,
  })

  if (error) {
    if (String(error.message || '').toLowerCase().includes('complete_password_reset')) {
      return {
        ok: false,
        error: new Error(
          'Password reset is not installed yet. Run supabase/eventsphere-password-reset.sql in the SQL Editor.',
        ),
      }
    }
    return { ok: false, error }
  }

  return { ok: Boolean(data), error: null }
}
