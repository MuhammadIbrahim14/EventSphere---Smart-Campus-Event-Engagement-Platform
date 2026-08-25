# Server routes (API layer)

Vite + Supabase SPA — **no Express process**. Organized CRUD helpers.

| File | Phase | Ops |
|------|-------|-----|
| `routes/profiles.js` | Auth | GET profiles, PUT role |
| `routes/items.js` | Demo | Items CRUD |
| `routes/auth.js` | Auth | Role home helpers |
| `routes/events.js` | **A** | Events list/create/update/status |
| `routes/registrations.js` | **A** | register/cancel RPCs |
| `routes/attendance.js` | **A** | Mark / list |
| `routes/feedback.js` | **A** | Submit / list |
| `routes/certificates.js` | **A** | Issue / fee ack |
| `routes/media.js` | **A** | Gallery |
| `routes/announcements.js` | **A** | Broadcasts |
| `routes/venues.js` | **A** | Venues + saved events |

`src/services/*` re-exports these. **App.tsx is not wired yet (Phase B).**
