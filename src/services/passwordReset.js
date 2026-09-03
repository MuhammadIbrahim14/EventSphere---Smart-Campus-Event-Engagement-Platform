import { supabase } from '../lib/supabase'
import { sendOtpEmail } from '../lib/emailjs'

function mapResetRpcError(error, missingHint) {
  const msg = String(error?.message || error || '')
  const lower = msg.toLowerCase()
  if (
    lower.includes('request_password_reset_otp') ||
    lower.includes('complete_password_reset') ||
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  ) {
    return new Error(missingHint)
  }
  if (lower.includes('gen_salt') || lower.includes('crypt(')) {
    return new Error(
      'Password reset crypto is misconfigured. Re-run supabase/eventsphere-password-reset.sql in the SQL Editor.',
    )
  }
  return error instanceof Error ? error : new Error(msg || 'Password reset failed')
}

/**
 * Request a 6-digit password reset OTP (EmailJS OTP template).
 * Privacy: if no account matches, still returns { sent: true } and does not send mail.
 */
export async function requestPasswordResetOtp(email) {
  const toEmail = String(email || '').trim().toLowerCase()
  if (!toEmail || !toEmail.includes('@')) {
    return { error: new Error('Enter a valid email address.') }
  }

  if (toEmail.endsWith('@students.eventsphere.local')) {
    return {
      error: new Error(
        'Use your linked personal email, or login with enrollment / ask admin to reset.',
      ),
    }
  }

  const { data: otp, error } = await supabase.rpc('request_password_reset_otp', {
    p_email: toEmail,
  })

  if (error) {
    return {
      error: mapResetRpcError(
        error,
        'Password reset is not installed yet. Run supabase/eventsphere-password-reset.sql in the SQL Editor.',
      ),
    }
  }

  // RPC returns plaintext OTP only when a real account matched
  if (otp) {
    const toName = toEmail.split('@')[0] || 'User'
    const { error: mailError } = await sendOtpEmail({ toEmail, toName, otp })
    if (mailError) return { error: mailError }
  }

  return { sent: true, toEmail, delivered: Boolean(otp) }
}

export async function completePasswordReset({ email, otp, newPassword }) {
  const toEmail = String(email || '').trim().toLowerCase()
  const { data, error } = await supabase.rpc('complete_password_reset', {
    p_email: toEmail,
    p_otp: String(otp || '').trim(),
    p_new_password: newPassword,
  })

  if (error) {
    return {
      ok: false,
      error: mapResetRpcError(
        error,
        'Password reset is not installed yet. Run supabase/eventsphere-password-reset.sql in the SQL Editor.',
      ),
    }
  }

  return { ok: Boolean(data), error: null }
}
