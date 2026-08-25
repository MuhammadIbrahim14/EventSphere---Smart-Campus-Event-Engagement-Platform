# Flowcharts / DFD (text)

## Level-0 context

```text
[Student/Guest/Organizer/Admin]
        │  HTTPS
        ▼
   EventSphere SPA
        │  Supabase client
        ▼
   Supabase (Auth + Postgres RLS + Storage)
```

## Registration flow (student)

```text
Discover approved event
    → View detail
    → Confirm register
    → RPC register_for_event
         ├─ seats > 0 → confirmed (or pending if approval required)
         └─ seats = 0 → waitlist (if enabled)
    → My Passes (QR payload)
```

## Event publish flow (organizer → admin)

```text
Organizer create (draft|pending)
    → Admin Approvals
    → status = approved
    → Visible on student Discover
```

## Attendance flow

```text
Student shows QR (ES|eventId|studentId|token)
    → Organizer Attendees → paste / mark
    → attendance row (method=qr|manual)
    → Student may submit feedback
```

## Data stores (DFD-style)

| Store | Contents |
|-------|----------|
| D1 Profiles | identity + role |
| D2 Events | catalogue + status |
| D3 Registrations | bookings / waitlist |
| D4 Attendance | presence |
| D5 Media | gallery URLs |
| D6 Announcements | campus signals |
