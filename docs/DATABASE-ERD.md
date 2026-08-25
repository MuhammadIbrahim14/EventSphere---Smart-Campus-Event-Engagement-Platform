# Database design (ERD overview)

Source of truth: `supabase/eventsphere-core.sql` (+ auth `profiles` from `schema.sql`).

```text
auth.users
    │ 1:1
    ▼
profiles (role: user|organizer|admin, mobile, department, enrollment_no)
    │
    ├──< events (organizer_id) >── venues (optional venue_id)
    │       │
    │       ├──< registrations (student_id, status)
    │       ├──< attendance (student_id, method qr|manual)
    │       ├──< feedback (ratings + comments)
    │       ├──< certificates (fee_acknowledged, url)
    │       ├──< media_gallery (file_url, file_type)
    │       ├──< saved_events
    │       ├──< announcements (optional event_id)
    │       ├──< calendar_sync
    │       └──< event_share_log
```

## Key enums

| Table | Field | Values |
|-------|--------|--------|
| events | status | draft, pending, approved, rejected, cancelled |
| registrations | status | confirmed, cancelled, waitlist, pending |
| attendance | method | qr, manual |

## Capacity rules

- `register_for_event(p_event_id)` — security definer; no overbook when waitlist off.
- `cancel_registration` promotes oldest waitlist row when a confirmed seat frees.

## Storage

- Bucket `event-media` (Phase C) for gallery/banner uploads.
