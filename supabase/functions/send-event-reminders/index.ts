/**
 * Edge Function: send-event-reminders
 * Deploy: supabase functions deploy send-event-reminders
 * Schedule via pg_cron or Supabase cron every 15–30 minutes.
 *
 * Finds confirmed registrations for events starting in ~11–13 hours,
 * inserts student_notices (kind=event_reminder_12h) if not already sent.
 * Email delivery can be hooked to EmailJS / Resend from a separate worker.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const now = new Date()
    const from = new Date(now.getTime() + 11 * 60 * 60 * 1000)
    const to = new Date(now.getTime() + 13 * 60 * 60 * 1000)
    const fromDate = from.toISOString().slice(0, 10)
    const toDate = to.toISOString().slice(0, 10)

    const { data: events, error: evErr } = await supabase
      .from('events')
      .select('id, title, event_date, event_time, venue, status')
      .eq('status', 'approved')
      .gte('event_date', fromDate)
      .lte('event_date', toDate)

    if (evErr) throw evErr

    let created = 0
    for (const ev of events || []) {
      const startIso = `${ev.event_date}T${(ev.event_time || '09:00').slice(0, 5)}:00`
      const start = new Date(startIso)
      if (Number.isNaN(start.getTime())) continue
      const hours = (start.getTime() - now.getTime()) / 3600000
      if (hours < 11 || hours > 13) continue

      const { data: regs } = await supabase
        .from('registrations')
        .select('id, student_id')
        .eq('event_id', ev.id)
        .in('status', ['confirmed', 'pending'])

      for (const reg of regs || []) {
        const { data: existing } = await supabase
          .from('student_notices')
          .select('id')
          .eq('user_id', reg.student_id)
          .eq('event_id', ev.id)
          .eq('kind', 'event_reminder_12h')
          .maybeSingle()

        if (existing) continue

        const body = `Event: ${ev.title}\nDate: ${ev.event_date}\nTime: ${ev.event_time || 'TBA'}\nVenue: ${ev.venue || 'Campus'}\n\nYour event will start in 12 hours.`
        const { error: insErr } = await supabase.from('student_notices').insert({
          user_id: reg.student_id,
          event_id: ev.id,
          kind: 'event_reminder_12h',
          title: 'Your event will start in 12 hours',
          body,
          meta: { source: 'send-event-reminders', hours_window: [11, 13] },
        })
        if (!insErr) created += 1
      }
    }

    return new Response(JSON.stringify({ ok: true, notices_created: created }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
