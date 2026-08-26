/**
 * Admin — promo codes + sponsors (Phase 4).
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { EsPageChrome } from '@/components/design-system'
import {
  createPromoCode,
  createSponsor,
  deleteSponsor,
  listAllSponsorsAdmin,
  listPromoCodes,
  updatePromoCode,
  updateSponsor,
} from '@/services/growth'

export default function AdminGrowthHub({ setToast }) {
  const [tab, setTab] = useState('promos')
  const [promos, setPromos] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [busy, setBusy] = useState(false)
  const [promoForm, setPromoForm] = useState({
    code: '',
    discount_type: 'percent',
    value: 10,
    max_uses: 50,
  })
  const [sponsorForm, setSponsorForm] = useState({
    name: '',
    logo_url: '',
    link_url: '',
    placement: 'all',
  })

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

  const addPromo = async () => {
    setBusy(true)
    const { error } = await createPromoCode(promoForm)
    setBusy(false)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Promo code created')
      setPromoForm({ code: '', discount_type: 'percent', value: 10, max_uses: 50 })
      await load()
    }
  }

  const addSponsor = async () => {
    setBusy(true)
    const { error } = await createSponsor(sponsorForm)
    setBusy(false)
    if (error) setToast?.(error.message)
    else {
      setToast?.('Sponsor added')
      setSponsorForm({ name: '', logo_url: '', link_url: '', placement: 'all' })
      await load()
    }
  }

  return (
    <>
      <EsPageChrome
        eyebrow="Growth & monetization"
        title="Promo & sponsors"
        description="Discount coupons for checkout and sponsorship logo strips across the campus orbit."
      />
      <div className="chips" style={{ marginBottom: 16 }}>
        <button type="button" className={`chip ${tab === 'promos' ? 'active' : ''}`} onClick={() => setTab('promos')}>
          Promo codes
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
                <input className="input" value={promoForm.code} onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value }))} placeholder="CAMPUS10" />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={promoForm.discount_type} onChange={(e) => setPromoForm((f) => ({ ...f, discount_type: e.target.value }))}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label">Value</label>
                <input className="input" type="number" value={promoForm.value} onChange={(e) => setPromoForm((f) => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Max uses</label>
                <input className="input" type="number" value={promoForm.max_uses} onChange={(e) => setPromoForm((f) => ({ ...f, max_uses: Number(e.target.value) }))} />
              </div>
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={addPromo}>
              <Plus size={14} /> Create promo
            </button>
          </div>
          <div className="table-wrap surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Uses</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.code}</strong></td>
                    <td>{p.discount_type === 'percent' ? `${p.value}%` : `$${p.value}`}</td>
                    <td>{p.used_count}/{p.max_uses ?? '∞'}</td>
                    <td>{p.active ? 'Active' : 'Off'}</td>
                    <td>
                      <button type="button" className="btn btn-quiet" onClick={async () => { await updatePromoCode(p.id, { active: !p.active }); await load() }}>
                        {p.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
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
                <input className="input" value={sponsorForm.name} onChange={(e) => setSponsorForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="full">
                <label className="label">Logo URL</label>
                <input className="input" value={sponsorForm.logo_url} onChange={(e) => setSponsorForm((f) => ({ ...f, logo_url: e.target.value }))} />
              </div>
              <div>
                <label className="label">Link</label>
                <input className="input" value={sponsorForm.link_url} onChange={(e) => setSponsorForm((f) => ({ ...f, link_url: e.target.value }))} />
              </div>
              <div>
                <label className="label">Placement</label>
                <select className="input" value={sponsorForm.placement} onChange={(e) => setSponsorForm((f) => ({ ...f, placement: e.target.value }))}>
                  <option value="all">All pages</option>
                  <option value="home">Home</option>
                  <option value="discover">Discover</option>
                  <option value="event_detail">Event detail</option>
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={addSponsor}>
              <Plus size={14} /> Add sponsor
            </button>
          </div>
          <div className="grid-3">
            {sponsors.map((s) => (
              <div key={s.id} className="surface" style={{ padding: 14, textAlign: 'center' }}>
                <img src={s.logo_url} alt={s.name} style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }} />
                <p style={{ fontSize: 12, marginTop: 8 }}><strong>{s.name}</strong></p>
                <p className="muted" style={{ fontSize: 10 }}>{s.placement}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  <button type="button" className="btn btn-quiet" onClick={async () => { await updateSponsor(s.id, { active: !s.active }); await load() }}>
                    {s.active ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={async () => { await deleteSponsor(s.id); await load() }}>
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
