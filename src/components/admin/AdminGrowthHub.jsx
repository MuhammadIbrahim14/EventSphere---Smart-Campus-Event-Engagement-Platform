/**
 * Admin — promo codes + sponsors (Phase 4) + public promo campaigns.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import { TABLES } from '@/constants/domain'
import { useRealtimeTables } from '@/hooks/useRealtimeTables'
import {
  createPromoCode,
  createSponsor,
  deleteSponsor,
  listAllSponsorsAdmin,
  listPromoCodes,
  updatePromoCode,
  updateSponsor,
} from '@/services/growth'

const emptyPromo = {
  code: '',
  discount_type: 'percent',
  value: 10,
  max_uses: 30,
  event_id: '',
  is_public: true,
  campaign_kind: 'sponsorship',
  campaign_headline: '',
  campaign_blurb: '',
  show_on_discover: true,
  show_on_event_detail: true,
  expires_at: '',
}

const emptySponsor = {
  name: '',
  logo_url: '',
  link_url: '',
  placement: 'event_detail',
  event_id: '',
}

export default function AdminGrowthHub({ setToast, events = [] }) {
  const [tab, setTab] = useState('promos')
  const [promos, setPromos] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [busy, setBusy] = useState(false)
  const [promoForm, setPromoForm] = useState(emptyPromo)
  const [sponsorForm, setSponsorForm] = useState(emptySponsor)

  const eventOptions = [...(events || [])].sort((a, b) =>
    String(a.title || '').localeCompare(String(b.title || '')),
  )

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([listPromoCodes(), listAllSponsorsAdmin()])
    if (p.error) setToast?.(p.error.message)
    if (s.error) setToast?.(s.error.message)
    setPromos(p.data || [])
    setSponsors(s.data || [])
  }, [setToast])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeTables([TABLES.PROMO_CODES, TABLES.SPONSORS], load, {
    channelName: 'es-admin-growth',
  })

  const addPromo = async () => {
    if (!String(promoForm.code || '').trim()) {
      setToast?.('Enter a promo code')
      return
    }
    const isSponsorship = promoForm.campaign_kind === 'sponsorship' || Boolean(promoForm.event_id)
    if (isSponsorship && !promoForm.event_id) {
      setToast?.('Pick which event this sponsorship discount applies to')
      return
    }
    setBusy(true)
    const payload = {
      ...promoForm,
      event_id: promoForm.event_id || null,
      campaign_kind: promoForm.event_id
        ? promoForm.campaign_kind || 'sponsorship'
        : 'standard',
      expires_at: promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null,
    }
    const { error } = await createPromoCode(payload)
    setBusy(false)
    if (error) {
      setToast?.(
        /event_id|campaign_kind|is_public|campaign_headline|column/i.test(error.message || '')
          ? `${error.message} — run supabase/eventsphere-promo-event.sql (and promo-campaign.sql if needed)`
          : error.message,
      )
    } else {
      const evTitle =
        eventOptions.find((e) => String(e.id) === String(promoForm.event_id))?.title || 'event'
      setToast?.(
        promoForm.is_public && promoForm.event_id
          ? `Sponsorship deal live on “${evTitle}” · first ${promoForm.max_uses || '∞'} students`
          : promoForm.is_public
            ? 'Public campaign live — students will see it on Discover'
            : 'Whisper promo saved (not shown in-app)',
      )
      setPromoForm(emptyPromo)
      await load()
    }
  }

  const addSponsor = async () => {
    if (!String(sponsorForm.name || '').trim() || !String(sponsorForm.logo_url || '').trim()) {
      setToast?.('Sponsor name and logo URL are required')
      return
    }
    if (!sponsorForm.event_id) {
      setToast?.('Pick which event this sponsor supports (or Campus-wide)')
      return
    }
    setBusy(true)
    const isCampusWide = sponsorForm.event_id === '__campus__'
    const { error } = await createSponsor({
      ...sponsorForm,
      event_id: isCampusWide ? null : sponsorForm.event_id,
      placement: isCampusWide
        ? sponsorForm.placement === 'event_detail'
          ? 'discover'
          : sponsorForm.placement
        : 'event_detail',
    })
    setBusy(false)
    if (error) {
      setToast?.(
        /event_id|column/i.test(error.message || '')
          ? `${error.message} — run supabase/eventsphere-sponsor-event.sql`
          : error.message,
      )
    } else {
      setToast?.(
        isCampusWide
          ? 'Campus-wide sponsor added (Discover)'
          : 'Event sponsor added — only shows on that event',
      )
      setSponsorForm(emptySponsor)
      await load()
    }
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Growth & monetization"
        title="Promo & sponsors"
        description="Create event sponsorship discounts (limited seats) and attach sponsors to a specific event."
      />
      <div className="chips" style={{ marginBottom: 16 }}>
        <button type="button" className={`chip ${tab === 'promos' ? 'active' : ''}`} onClick={() => setTab('promos')}>
          Promo & sponsorship deals
        </button>
        <button type="button" className={`chip ${tab === 'sponsors' ? 'active' : ''}`} onClick={() => setTab('sponsors')}>
          Sponsors
        </button>
      </div>

      {tab === 'promos' ? (
        <>
          <div className="surface" style={{ padding: 18, marginBottom: 16 }}>
            <div className="form-grid">
              <div>
                <label className="label">Code</label>
                <input
                  className="input"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="CAMPUS10"
                  data-testid="input-promo-code"
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={promoForm.discount_type}
                  onChange={(e) => setPromoForm((f) => ({ ...f, discount_type: e.target.value }))}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label">Value</label>
                <input
                  className="input"
                  type="number"
                  value={promoForm.value}
                  onChange={(e) => setPromoForm((f) => ({ ...f, value: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label">Max sponsored seats</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={promoForm.max_uses}
                  onChange={(e) => setPromoForm((f) => ({ ...f, max_uses: Number(e.target.value) }))}
                  placeholder="30"
                  data-testid="input-promo-max-uses"
                />
              </div>
              <div className="full">
                <label className="label">Applies to which event?</label>
                <select
                  className="input"
                  value={promoForm.event_id}
                  onChange={(e) => {
                    const id = e.target.value
                    const ev = eventOptions.find((x) => String(x.id) === String(id))
                    setPromoForm((f) => ({
                      ...f,
                      event_id: id,
                      campaign_kind: id ? 'sponsorship' : 'standard',
                      campaign_headline:
                        f.campaign_headline ||
                        (ev?.title ? `${ev.title} · sponsored discount` : f.campaign_headline),
                      campaign_blurb:
                        f.campaign_blurb ||
                        (id
                          ? 'Limited sponsored seats for early registrants — copy the code and apply at paid checkout.'
                          : f.campaign_blurb),
                    }))
                  }}
                  data-testid="select-promo-event"
                >
                  <option value="">— Campus-wide (any paid event) —</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title || 'Untitled'}
                      {ev.registrationClosesAt || ev.registration_closes_at
                        ? ' · reg closes set'
                        : ''}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Sponsorship deals should pick one event. Code auto-expires when that event’s registration closes
                  (or at the date below).
                </p>
              </div>
              <div>
                <label className="label">Hard expires (optional)</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={promoForm.expires_at}
                  onChange={(e) => setPromoForm((f) => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
              <div className="full">
                <label className="label">Campaign headline</label>
                <input
                  className="input"
                  value={promoForm.campaign_headline}
                  onChange={(e) => setPromoForm((f) => ({ ...f, campaign_headline: e.target.value }))}
                  placeholder="TechFest · first 30 students get 20% off"
                  data-testid="input-promo-headline"
                />
              </div>
              <div className="full">
                <label className="label">Campaign blurb</label>
                <textarea
                  className="input"
                  rows={2}
                  value={promoForm.campaign_blurb}
                  onChange={(e) => setPromoForm((f) => ({ ...f, campaign_blurb: e.target.value }))}
                  placeholder="Limited sponsored seats — copy the code and apply at paid checkout."
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(promoForm.is_public)}
                  onChange={(e) =>
                    setPromoForm((f) => ({
                      ...f,
                      is_public: e.target.checked,
                      campaign_kind: e.target.checked && f.event_id ? 'sponsorship' : f.campaign_kind,
                    }))
                  }
                  data-testid="checkbox-promo-public"
                />
                Public campaign (students see it)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(promoForm.show_on_discover)}
                  onChange={(e) => setPromoForm((f) => ({ ...f, show_on_discover: e.target.checked }))}
                  disabled={!promoForm.is_public}
                />
                Discover / dashboard
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(promoForm.show_on_event_detail)}
                  onChange={(e) => setPromoForm((f) => ({ ...f, show_on_event_detail: e.target.checked }))}
                  disabled={!promoForm.is_public}
                />
                That event’s detail page
              </label>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Tip: pick an event + max seats (e.g. 30) for sponsor discounts. Whisper-only: turn off “Public campaign”.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={addPromo}
              data-testid="button-create-promo"
            >
              <Plus size={14} /> Create promo
            </button>
          </div>
          <div className="table-wrap surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Event</th>
                  <th>Discount</th>
                  <th>Campaign</th>
                  <th>Seats</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => {
                  const softClosed =
                    p.events?.registration_closes_at &&
                    new Date(p.events.registration_closes_at).getTime() < Date.now()
                  const soldOut =
                    p.max_uses != null && Number(p.used_count || 0) >= Number(p.max_uses)
                  return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.code}</strong>
                      {p.campaign_kind === 'sponsorship' || p.event_id ? (
                        <div className="muted" style={{ fontSize: 10 }}>Sponsorship</div>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 140 }}>
                      {p.events?.title || (p.event_id ? 'Linked event' : <span className="muted">Campus-wide</span>)}
                    </td>
                    <td>{p.discount_type === 'percent' ? `${p.value}%` : `$${p.value}`}</td>
                    <td style={{ maxWidth: 160, fontSize: 12 }}>
                      {p.campaign_headline || <span className="muted">—</span>}
                    </td>
                    <td>
                      {p.used_count}/{p.max_uses ?? '∞'}
                      {soldOut ? <div className="muted" style={{ fontSize: 10 }}>Sold out</div> : null}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {p.is_public ? (
                        <>
                          Public
                          {p.show_on_discover ? ' · Discover' : ''}
                          {p.show_on_event_detail ? ' · Detail' : ''}
                        </>
                      ) : (
                        'Whisper'
                      )}
                    </td>
                    <td>
                      {!p.active
                        ? 'Off'
                        : softClosed
                          ? 'Expired (reg closed)'
                          : soldOut
                            ? 'Redeemed out'
                            : 'Active'}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={async () => {
                          await updatePromoCode(p.id, { active: !p.active })
                          await load()
                        }}
                      >
                        {p.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={async () => {
                          const { error } = await updatePromoCode(p.id, { is_public: !p.is_public })
                          if (error) setToast?.(error.message)
                          await load()
                        }}
                      >
                        {p.is_public ? 'Make whisper' : 'Make public'}
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="surface" style={{ padding: 18, marginBottom: 16 }}>
            <div className="form-grid">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={sponsorForm.name}
                  onChange={(e) => setSponsorForm((f) => ({ ...f, name: e.target.value }))}
                  data-testid="input-sponsor-name"
                />
              </div>
              <div className="full">
                <label className="label">Sponsors which event?</label>
                <select
                  className="input"
                  value={sponsorForm.event_id}
                  onChange={(e) => {
                    const v = e.target.value
                    setSponsorForm((f) => ({
                      ...f,
                      event_id: v,
                      placement: v === '__campus__' ? 'discover' : 'event_detail',
                    }))
                  }}
                  data-testid="select-sponsor-event"
                  required
                >
                  <option value="">Select event…</option>
                  <option value="__campus__">Campus-wide (Discover only)</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} {ev.status ? `(${ev.status})` : ''}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Event-linked sponsors appear only on that event’s partners strip — not on every event.
                </p>
              </div>
              <div className="full">
                <label className="label">Logo URL</label>
                <input
                  className="input"
                  value={sponsorForm.logo_url}
                  onChange={(e) => setSponsorForm((f) => ({ ...f, logo_url: e.target.value }))}
                  data-testid="input-sponsor-logo"
                />
              </div>
              <div>
                <label className="label">Link</label>
                <input
                  className="input"
                  value={sponsorForm.link_url}
                  onChange={(e) => setSponsorForm((f) => ({ ...f, link_url: e.target.value }))}
                />
              </div>
              {sponsorForm.event_id === '__campus__' ? (
                <div>
                  <label className="label">Campus placement</label>
                  <select
                    className="input"
                    value={sponsorForm.placement}
                    onChange={(e) => setSponsorForm((f) => ({ ...f, placement: e.target.value }))}
                  >
                    <option value="discover">Discover</option>
                    <option value="home">Home</option>
                    <option value="all">All global pages</option>
                  </select>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={addSponsor}
              data-testid="button-add-sponsor"
            >
              <Plus size={14} /> Add sponsor
            </button>
          </div>
          <div className="grid-3">
            {sponsors.map((s) => (
              <div key={s.id} className="surface" style={{ padding: 14, textAlign: 'center' }}>
                <img
                  src={s.logo_url}
                  alt={s.name}
                  style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }}
                />
                <p style={{ fontSize: 12, marginTop: 8 }}>
                  <strong>{s.name}</strong>
                </p>
                <p className="muted" style={{ fontSize: 10 }}>
                  {s.event_id
                    ? `Event: ${s.events?.title || s.event_id}`
                    : `Campus-wide · ${s.placement}`}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={async () => {
                      await updateSponsor(s.id, { active: !s.active })
                      await load()
                    }}
                  >
                    {s.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={async () => {
                      await deleteSponsor(s.id)
                      await load()
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
