/**
 * Campus notification emails via EmailJS (OTP template reusable, or optional notify template).
 *
 * Same template works if it has {{to_email}} {{to_name}} {{otp}}:
 *   - put short alert text in {{otp}} (and also {{message}} if you upgrade template)
 *
 * Optional: VITE_EMAILJS_NOTIFY_TEMPLATE_ID for a dedicated notify template with
 *   {{to_email}} {{to_name}} {{subject}} {{title}} {{message}} {{otp}}
 */
import emailjs from '@emailjs/browser'

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
const otpTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const notifyTemplateId =
  import.meta.env.VITE_EMAILJS_NOTIFY_TEMPLATE_ID || otpTemplateId
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const isEmailJsConfigured = Boolean(serviceId && otpTemplateId && publicKey)

/**
 * Sends OTP via EmailJS.
 * Template "To Email" field MUST be: {{to_email}}
 * Body vars: to_email, to_name, otp
 */
export async function sendOtpEmail({ toEmail, toName, otp }) {
  return sendEmailJs({
    templateId: otpTemplateId,
    toEmail,
    toName,
    vars: { otp: String(otp) },
  })
}

/**
 * Student experience notifications (registration, payment, reminder, waitlist).
 */
export async function sendCampusNotify({
  toEmail,
  toName,
  subject,
  title,
  message,
}) {
  const text = String(message || title || subject || '').slice(0, 400)
  return sendEmailJs({
    templateId: notifyTemplateId,
    toEmail,
    toName,
    vars: {
      subject: subject || title || 'EventSphere',
      title: title || subject || 'EventSphere',
      message: text,
      // Reuse OTP template slot so existing EmailJS template still delivers a useful body
      otp: text,
    },
  })
}

async function sendEmailJs({ templateId, toEmail, toName, vars = {} }) {
  if (!serviceId || !templateId || !publicKey) {
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
        to_email: recipient,
        email: recipient,
        user_email: recipient,
        to_name: toName || 'Student',
        ...vars,
      },
      { publicKey },
    )
    return { error: null }
  } catch (err) {
    console.error('EmailJS send failed:', err)
    const text = err?.text || err?.message || 'Failed to send email'
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
