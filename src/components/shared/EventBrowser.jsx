import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { Archive, ChevronDown, ChevronUp, ListFilter, Plus, Search } from 'lucide-react'
import { EVENT_CATEGORIES, EVENT_STATUS } from '@/constants/domain'
import { EsEventCard, EsPageChrome } from '@/components/design-system'
import OrganizerEventManage from '@/components/ops/OrganizerEventManage'
import PromoCampaignBanner from '@/components/shared/PromoCampaignBanner'
import SponsorStrip from '@/components/shared/SponsorStrip'
import { getEventPhase, isEventEnded } from '@/lib/eventDate'
import { listCategories } from '@/services/categories'

function EmptyState({ title, message, action }) {
  return (
    <div className="empty es-empty">
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  )
}

function normCat(c) {
  return String(c || '')
    .trim()
    .toLowerCase()
}

function phaseRank(phase) {
  if (phase === 'live') return 0
  if (phase === 'starting_soon') return 1
  if (phase === 'upcoming') return 2
  if (phase === 'unknown') return 3
  return 4 // ended last
}

function matchesSearch(event, term) {
  const q = String(term || '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const blob = `${event.title || ''} ${event.organizer || ''} ${event.venue || ''} ${event.category || ''} ${event.description || ''}`.toLowerCase()
  return blob.includes(q)
}

function sortEvents(list, sort) {
  const rows = [...(list || [])]
  if (sort === 'Most Popular') {
    return rows.sort((a, b) => (b.registrations || 0) - (a.registrations || 0))
  }
  if (sort === 'Newest') {
    return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }
  // Recommended + Upcoming: live/soon first, then soonest date
  return rows.sort((a, b) => {
    const pa = getEventPhase(a)
    const pb = getEventPhase(b)
    const pr = phaseRank(pa) - phaseRank(pb)
    if (pr !== 0) return pr
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
}

/**
 * Discover / My events / Admin event library.
 * Active events front-and-center; ended archived in a collapsible box.
 */
export default function EventBrowser({ role, events, saved = [], setToast, go, actions }) {
  const [path] = useLocation()
  const initialQ = (() => {
    try {
      const q = path.includes('?') ? new URLSearchParams(path.split('?')[1]).get('q') : ''
      return q || ''
    } catch {
      return ''
    }
  })()

  const [term, setTerm] = useState(initialQ)
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('Recommended')
  const [statusFilter, setStatusFilter] = useState('All')
  const [catList, setCatList] = useState([...EVENT_CATEGORIES])
  const [manage, setManage] = useState(null)
  const [endedOpen, setEndedOpen] = useState(false)

  useEffect(() => {
    if (initialQ) setTerm(initialQ)
  }, [initialQ])

  useEffect(() => {
    ;(async () => {
      const { data, error } = await listCategories()
      if (!error && data?.length) {
        setCatList(data.map((c) => c.name))
        return
      }
      const fromEvents = Array.from(
        new Set((events || []).map((e) => e.category).filter(Boolean)),
      )
      if (fromEvents.length) setCatList([...new Set([...EVENT_CATEGORIES, ...fromEvents])])
    })()
  }, [events])

  const source = useMemo(() => {
    let list = events || []
    if (role === 'student') {
      list = list.filter((e) => e.status === 'Approved' || e.status === EVENT_STATUS.APPROVED)
    }
    return list
  }, [events, role])

  const baseFiltered = useMemo(() => {
    return source.filter((e) => {
      if (!matchesSearch(e, term)) return false
      if (category !== 'All' && normCat(e.category) !== normCat(category)) return false
      if (role !== 'student' && statusFilter !== 'All') {
        const st = String(e.status || '')
        if (st !== statusFilter) return false
      }
      return true
    })
  }, [source, term, category, statusFilter, role])

  const { activeEvents, endedEvents } = useMemo(() => {
    const active = []
    const ended = []
    for (const e of baseFiltered) {
      if (isEventEnded(e)) ended.push(e)
      else active.push(e)
    }
    return {
      activeEvents: sortEvents(active, sort),
      endedEvents: sortEvents(ended, 'Newest'),
    }
  }, [baseFiltered, sort])

  const clearFilters = () => {
    setTerm('')
    setCategory('All')
    setStatusFilter('All')
    setSort('Recommended')
  }

  const edit = (event) => setManage({ mode: 'edit', event })
  const remove = (event) =>
    setManage({
      mode: 'delete',
      event: typeof event === 'object' ? event : events.find((e) => e.id === event),
    })
  const postpone = (event) => setManage({ mode: 'postpone', event })
  const cancelEv = (event) => setManage({ mode: 'cancel', event })

  const duplicate = async (event) => {
    const { error } = await actions.duplicateEvent(event)
    setToast(error ? error.message : 'Event duplicated as a draft')
  }
  const publish = async (id) => {
    const { error } = await actions.setStatus(id, EVENT_STATUS.PENDING)
    setToast(error ? error.message : 'Event submitted for admin approval')
  }
  const onSave = async (id) => {
    const { saved: nowSaved, error } = await actions.toggleSave(id)
    if (error) setToast(error.message)
    else setToast(nowSaved ? 'Event saved to your orbit' : 'Removed from saved events')
  }

  const cardProps = (e) => ({
    event: e,
    saved: saved.includes(e.id),
    onSave,
    onOpen: (id) => go(`/${role}/event/${id}`),
    role,
    onEdit: edit,
    onDelete: remove,
    onDuplicate: duplicate,
    onPublish: publish,
    onPostpone: postpone,
    onCancel: cancelEv,
  })

  const title =
    role === 'organizer' ? 'My events' : role === 'student' ? 'Discover events' : 'Event library'
  const eyebrow =
    role === 'organizer' ? 'Event operations' : role === 'student' ? 'Campus directory' : 'Campus directory'
  const description =
    role === 'organizer'
      ? 'Live and upcoming first — past events stay in the archive below.'
      : 'Find what’s next on campus. Past events are tucked into the archive.'

  return (
    <>
      <EsPageChrome
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          role === 'organizer' ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => go('/organizer/create-event')}
              data-testid="button-create-event"
            >
              <Plus size={15} /> Create event
            </button>
          ) : null
        }
      />

      <SponsorStrip placement="discover" />
      {role === 'student' ? (
        <PromoCampaignBanner placement="discover" events={events} setToast={setToast} go={go} />
      ) : null}

      <div className="surface es-event-filters" style={{ padding: 14, marginBottom: 18 }} data-testid="event-filters">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="search" style={{ flex: '1 1 200px', minWidth: 160 }}>
            <Search size={15} />
            <input
              className="input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search title, venue, organizer…"
              aria-label="Search events"
              data-testid="input-event-search"
            />
          </div>
          <select
            className="input"
            style={{ width: 160 }}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort events"
            data-testid="select-event-sort"
          >
            <option value="Recommended">Recommended</option>
            <option value="Upcoming">Upcoming first</option>
            <option value="Newest">Newest date</option>
            <option value="Most Popular">Most popular</option>
          </select>
          {role !== 'student' ? (
            <select
              className="input"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              data-testid="select-event-status"
            >
              <option value="All">All statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Rejected">Rejected</option>
            </select>
          ) : null}
          <ListFilter size={16} className="muted" aria-hidden />
        </div>

        <div className="chips" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`chip ${category === 'All' ? 'active' : ''}`}
            onClick={() => setCategory('All')}
            data-testid="button-filter-all"
          >
            All categories
          </button>
          {catList.map((c) => (
            <button
              type="button"
              className={`chip ${normCat(category) === normCat(c) ? 'active' : ''}`}
              onClick={() => setCategory(c)}
              key={c}
              data-testid={`button-filter-${String(c).toLowerCase().replace(/\s+/g, '-')}`}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="muted" style={{ fontSize: 11, margin: '10px 0 0' }}>
          Showing <strong>{activeEvents.length}</strong> live/upcoming
          {endedEvents.length ? (
            <>
              {' '}
              · <strong>{endedEvents.length}</strong> past in archive
            </>
          ) : null}
          {(term || category !== 'All' || statusFilter !== 'All') && (
            <>
              {' '}
              ·{' '}
              <button type="button" className="btn btn-quiet" style={{ padding: '2px 8px', fontSize: 11 }} onClick={clearFilters}>
                Clear filters
              </button>
            </>
          )}
        </p>
      </div>

      {activeEvents.length ? (
        <div className="grid-3 stagger" data-testid="active-events-grid">
          {activeEvents.map((e) => (
            <EsEventCard key={e.id} {...cardProps(e)} />
          ))}
        </div>
      ) : (
        <div className="surface">
          <EmptyState
            title={endedEvents.length ? 'No upcoming events match' : 'No events in this orbit'}
            message={
              endedEvents.length
                ? 'Try clearing filters — or open the past events archive below.'
                : 'Try another search or loosen your filters.'
            }
            action={
              <button className="btn" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        </div>
      )}

      {endedEvents.length > 0 ? (
        <div className="surface es-ended-archive" style={{ marginTop: 18, padding: 0 }} data-testid="ended-events-archive">
          <button
            type="button"
            className="es-ended-archive__toggle"
            onClick={() => setEndedOpen((o) => !o)}
            aria-expanded={endedOpen}
            data-testid="button-toggle-ended-events"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Archive size={16} />
              <span>
                <strong>Past / ended events</strong>
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  {endedEvents.length} hidden from the main grid
                </span>
              </span>
            </span>
            {endedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {endedOpen ? (
            <div className="grid-3" style={{ padding: '0 14px 16px' }} data-testid="ended-events-grid">
              {endedEvents.map((e) => (
                <EsEventCard key={e.id} {...cardProps(e)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {manage ? (
        <OrganizerEventManage
          key={`${manage.mode}-${manage.event?.id}`}
          mode={manage.mode}
          event={manage.event}
          actions={actions}
          setToast={setToast}
          onClose={() => setManage(null)}
          onSwitchMode={(m) => setManage({ mode: m, event: manage.event })}
        />
      ) : null}
    </>
  )
}
