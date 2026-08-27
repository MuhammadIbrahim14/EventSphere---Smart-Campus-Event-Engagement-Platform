import { supabase } from '../../src/lib/supabase.js'
import { TABLES } from '../../src/constants/domain.js'

export async function submitContactMessage({ name, email, subject, message }) {
  const payload = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    subject: String(subject || 'General inquiry').trim() || 'General inquiry',
    message: String(message || '').trim(),
  }

  if (payload.name.length < 2) {
    return { data: null, error: { message: 'Enter your name.' } }
  }
  if (!payload.email.includes('@')) {
    return { data: null, error: { message: 'Enter a valid email.' } }
  }
  if (payload.message.length < 5) {
    return { data: null, error: { message: 'Message is too short.' } }
  }

  // Security-definer RPC — avoids anon RLS block on insert + returning select
  const { data, error } = await supabase.rpc('submit_contact_message', {
    p_name: payload.name,
    p_email: payload.email,
    p_subject: payload.subject,
    p_message: payload.message,
  })

  if (error) {
    const msg = String(error.message || '')
    if (/submit_contact_message|could not find the function/i.test(msg)) {
      return {
        data: null,
        error: {
          message:
            'Contact inbox is not installed yet. Re-run supabase/eventsphere-contact-messages.sql in the SQL Editor.',
        },
      }
    }
    return { data: null, error }
  }

  return { data, error: null }
}

/** Public track — RPC returns messages for this email only. */
export async function lookupContactMessages(email) {
  const toEmail = String(email || '').trim().toLowerCase()
  if (!toEmail.includes('@')) {
    return { data: [], error: { message: 'Enter a valid email.' } }
  }

  const { data, error } = await supabase.rpc('lookup_contact_messages', {
    p_email: toEmail,
  })

  if (error) {
    if (String(error.message || '').toLowerCase().includes('lookup_contact_messages')) {
      return {
        data: [],
        error: {
          message:
            'Contact inbox is not installed yet. Run supabase/eventsphere-contact-messages.sql in the SQL Editor.',
        },
      }
    }
    return { data: [], error }
  }

  return { data: data || [], error: null }
}

export async function listAllContactMessages() {
  const { data, error } = await supabase
    .from(TABLES.CONTACT_MESSAGES)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    if (String(error.message || '').toLowerCase().includes('contact_messages')) {
      return {
        data: [],
        error: {
          message:
            'Contact inbox is not installed yet. Run supabase/eventsphere-contact-messages.sql in the SQL Editor.',
        },
      }
    }
  }

  return { data: data || [], error }
}

export async function replyToContactMessage({ id, reply }) {
  const cleaned = String(reply || '').trim()
  if (!id) return { data: null, error: { message: 'Missing message id' } }
  if (cleaned.length < 2) return { data: null, error: { message: 'Write a reply first.' } }

  const { data, error } = await supabase.rpc('admin_reply_contact_message', {
    p_id: id,
    p_reply: cleaned,
  })

  if (error) {
    if (String(error.message || '').toLowerCase().includes('admin_reply_contact_message')) {
      return {
        data: null,
        error: {
          message:
            'Contact reply RPC missing. Run supabase/eventsphere-contact-messages.sql in the SQL Editor.',
        },
      }
    }
    return { data: null, error }
  }

  return { data, error: null }
}
