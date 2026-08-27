/**
 * EmailJS — two templates, one service.
 *
 * OTP template (VITE_EMAILJS_TEMPLATE_ID):
 *   vars: to_email, to_name, otp
 *   used for: signup verify OTP, forgot-password OTP
 *
 * Notify template (VITE_EMAILJS_NOTIFY_TEMPLATE_ID):
 *   vars: to_email, to_name, subject, title, message
 *   used for: registration, waitlist, payment, reminders, promotions
 *
 * Never reuse the OTP template for campus notifications.
 */
import emailjs from '@emailjs/browser'

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
const otpTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const notifyTemplateId = import.meta.env.VITE_EMAILJS_NOTIFY_TEMPLATE_ID
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/** OTP emails ready (signup / password reset). */
export const isEmailJsConfigured = Boolean(serviceId && otpTemplateId && publicKey)

/** Campus notify emails ready (registration, payment, reminders, etc.). */
export const isEmailJsNotifyConfigured = Boolean(
  serviceId && notifyTemplateId && publicKey,
)

/**
 * Sends a one-time code. OTP template only.
 * EmailJS "To Email" MUST be: {{to_email}}
 */
export async function sendOtpEmail({ toEmail, toName, otp }) {
  if (!isEmailJsConfigured) {
    return {
      error: new Error(
        'EmailJS OTP not configured. Add VITE_EMAILJS_SERVICE_ID, TEMPLATE_ID, and PUBLIC_KEY to .env',
      ),
    }
  }

  return sendEmailJs({
    templateId: otpTemplateId,
    toEmail,
    toName,
    vars: {
      otp: String(otp ?? '').trim(),
    },
  })
}

/**
 * Campus experience notifications. Notify template only — never OTP template.
 * EmailJS "To Email" MUST be: {{to_email}}
 * Subject field SHOULD be: {{subject}}
 */
export async function sendCampusNotify({
  toEmail,
  toName,
  subject,
  title,
  message,
}) {
  if (!isEmailJsNotifyConfigured) {
    return {
      error: new Error(
        'EmailJS notify template not configured. Add VITE_EMAILJS_NOTIFY_TEMPLATE_ID to .env',
      ),
    }
  }

  const safeTitle = String(title || subject || 'EventSphere').trim()
  const safeSubject = String(subject || title || 'EventSphere').trim()
  const safeMessage = String(message || safeTitle).slice(0, 1200)

  return sendEmailJs({
    templateId: notifyTemplateId,
    toEmail,
    toName,
    vars: {
      subject: safeSubject,
      title: safeTitle,
      message: safeMessage,
    },
  })
}

async function sendEmailJs({ templateId, toEmail, toName, vars = {} }) {
  if (!serviceId || !templateId || !publicKey) {
    return {
      error: new Error(
        'EmailJS not configured. Check SERVICE_ID, template IDs, and PUBLIC_KEY in .env',
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
        to_name: String(toName || 'Campus member').trim() || 'Campus member',
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
