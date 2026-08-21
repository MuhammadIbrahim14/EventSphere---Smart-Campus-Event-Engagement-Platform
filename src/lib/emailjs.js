import emailjs from '@emailjs/browser'

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const isEmailJsConfigured = Boolean(serviceId && templateId && publicKey)

/**
 * Sends OTP via EmailJS.
 * Template "To Email" field MUST be: {{to_email}}
 * Body vars: to_email, to_name, otp
 */
export async function sendOtpEmail({ toEmail, toName, otp }) {
  if (!isEmailJsConfigured) {
    return {
      error: new Error(
        'EmailJS not configured. Add VITE_EMAILJS_SERVICE_ID, TEMPLATE_ID, and PUBLIC_KEY to .env',
      ),
    }
  }

  const recipient = String(toEmail || '').trim()
  if (!recipient) {
    return { error: new Error('The recipients address is empty (no email on account).') }
  }

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        // common EmailJS "To Email" variable names
        to_email: recipient,
        email: recipient,
        user_email: recipient,
        to_name: toName || 'User',
        otp: String(otp),
      },
      { publicKey },
    )
    return { error: null }
  } catch (err) {
    console.error('EmailJS send failed:', err)
    const text = err?.text || err?.message || 'Failed to send OTP email'
    if (String(text).toLowerCase().includes('recipient')) {
      return {
        error: new Error(
          `${text} — In EmailJS template, set To Email exactly to {{to_email}} and Save.`,
        ),
      }
    }
    return { error: new Error(text) }
  }
}
