import { supabase } from '../lib/supabase.js'
import { TABLES } from '../constants/domain.js'

export const DEFAULT_ABOUT = {
  id: 1,
  eyebrow: 'Who we are',
  title: 'About EventSphere',
  lead:
    'EventSphere is the smart campus event and engagement platform — one place for discovery, registration, attendance, and celebration.',
  body:
    'Students discover approved gatherings, register with capacity-safe seats, carry digital QR passes, leave feedback, and collect certificates.\n\nOrganizers create and run events end-to-end — from approvals and waitlists to check-in and media.\n\nAdmins keep quality high: approve events, assign roles, moderate the gallery, answer Contact Us, and tune campus theme + FAQs from one control surface.',
  highlights: [
    {
      title: 'For students',
      body: 'Discover, register, waitlist promote, QR passes, feedback, and certificates — all in one orbit.',
    },
    {
      title: 'For organizers',
      body: 'Create events, manage roster & attendance, announce updates, and track earnings settlement.',
    },
    {
      title: 'For admins',
      body: 'Approve events, assign roles, settle commissions, reply to Contact Us, and shape About & FAQs.',
    },
  ],
}

function mapAbout(row) {
  if (!row) return null
  let highlights = row.highlights
  if (typeof highlights === 'string') {
    try {
      highlights = JSON.parse(highlights)
    } catch {
      highlights = []
    }
  }
  if (!Array.isArray(highlights)) highlights = []
  return {
    id: row.id,
    eyebrow: row.eyebrow || DEFAULT_ABOUT.eyebrow,
    title: row.title || DEFAULT_ABOUT.title,
    lead: row.lead || '',
    body: row.body || '',
    highlights: highlights.map((h) => ({
      title: String(h?.title || '').trim(),
      body: String(h?.body || '').trim(),
    })),
    updatedAt: row.updated_at || null,
  }
}

function mapFaq(row) {
  if (!row) return null
  return {
    id: row.id,
    question: row.question || '',
    answer: row.answer || '',
    sortOrder: Number(row.sort_order || 0),
    published: row.published !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

/** Public + admin: singleton About. Falls back to DEFAULT_ABOUT if missing. */
export async function getAboutContent() {
  const { data, error } = await supabase
    .from(TABLES.SITE_ABOUT)
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    if (/does not exist|schema cache|site_about/i.test(error.message || '')) {
      return { data: DEFAULT_ABOUT, error: null, fallback: true }
    }
    return { data: DEFAULT_ABOUT, error, fallback: true }
  }
  return { data: mapAbout(data) || DEFAULT_ABOUT, error: null, fallback: !data }
}

export async function saveAboutContent(payload) {
  const highlights = Array.isArray(payload.highlights)
    ? payload.highlights
        .map((h) => ({
          title: String(h.title || '').trim(),
          body: String(h.body || '').trim(),
        }))
        .filter((h) => h.title || h.body)
    : []

  const row = {
    id: 1,
    eyebrow: String(payload.eyebrow || '').trim() || DEFAULT_ABOUT.eyebrow,
    title: String(payload.title || '').trim() || DEFAULT_ABOUT.title,
    lead: String(payload.lead || '').trim(),
    body: String(payload.body || '').trim(),
    highlights,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(TABLES.SITE_ABOUT)
    .upsert(row, { onConflict: 'id' })
    .select()
    .maybeSingle()

  return { data: mapAbout(data), error }
}

/** Public: published FAQs only. */
export async function listPublishedFaqs() {
  const { data, error } = await supabase
    .from(TABLES.SITE_FAQS)
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (/does not exist|schema cache|site_faqs/i.test(error.message || '')) {
      return { data: [], error: null, fallback: true }
    }
    return { data: [], error }
  }
  return { data: (data || []).map(mapFaq), error: null }
}

/** Admin: all FAQs. */
export async function listAllFaqs() {
  const { data, error } = await supabase
    .from(TABLES.SITE_FAQS)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return { data: (data || []).map(mapFaq), error }
}

export async function createFaq({ question, answer, sortOrder = 0, published = true }) {
  const { data, error } = await supabase
    .from(TABLES.SITE_FAQS)
    .insert([
      {
        question: String(question || '').trim(),
        answer: String(answer || '').trim(),
        sort_order: Number(sortOrder) || 0,
        published: published !== false,
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .maybeSingle()
  return { data: mapFaq(data), error }
}

export async function updateFaq(id, patch) {
  const row = { updated_at: new Date().toISOString() }
  if (patch.question != null) row.question = String(patch.question).trim()
  if (patch.answer != null) row.answer = String(patch.answer).trim()
  if (patch.sortOrder != null) row.sort_order = Number(patch.sortOrder) || 0
  if (patch.published != null) row.published = Boolean(patch.published)

  const { data, error } = await supabase
    .from(TABLES.SITE_FAQS)
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle()
  return { data: mapFaq(data), error }
}

export async function deleteFaq(id) {
  const { error } = await supabase.from(TABLES.SITE_FAQS).delete().eq('id', id)
  return { error }
}
