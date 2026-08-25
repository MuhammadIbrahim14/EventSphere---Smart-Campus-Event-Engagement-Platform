# EventSphere — SRS Implementation Plan

**Source:** `College Event Management_Full-Stack App-SRS_final.pdf` (Aptech, v1.0)  
**Last updated:** 2026-08-25  
**Honest status:** UI shell ≈ done · Auth/roles ≈ done · **Dynamic data (DB + wire UI) = main remaining work**

---

## 0. How to use this file

1. Work **one phase at a time** (finish A before B).
2. Each feature has: **SRS need** · **Status** · **Where to add** · **How**.
3. Tick boxes `[ ]` → `[x]` as you complete.
4. Do **not** redesign EventSphere UI unless a screen is missing — prefer wiring existing screens in `src/App.tsx`.

### Current architecture (do not fight it)

| Piece | Location | Notes |
|--------|----------|--------|
| UI + routes (wouter) | `src/App.tsx` | Blue EventSphere theme; events still from `localStorage` seed |
| Theme CSS | `src/index.css` | Keep this; yellow `App.css` removed |
| Entry | `src/main.tsx` → AuthProvider → App |
| Auth | `src/context/AuthContext.jsx` | Supabase session + profile |
| Roles | `src/constants/roles.js` | DB `user` → UI `student` |
| Admin role assign | `src/components/admin/AdminUsersLive.jsx` | Real Supabase |
| API layer | `server/routes/*` + `src/services/*` | Extend same pattern |
| SQL | `supabase/*.sql` | Run in Supabase SQL Editor |

### Your instinct vs reality

| You think | Reality |
|-----------|---------|
| “UI complete, only DB left” | **Mostly true** for screens. |
| | Events / registrations / attendance / gallery / feedback are still **demo** (`eventSeed` + `useStore` / localStorage). |
| | Some SRS pages are **missing** (About, Contact, FAQ, Sitemap, Media Gallery as real module, fee form). |

**Start here after auth:** Phase A (database) → Phase B (wire App.tsx to Supabase).

---

## 1. SRS motive (one paragraph)

Campus events aaj noticeboards / chats pe scatter hote hain → missed updates, low turnout, manual chaos. **EventSphere** ek centralized full-stack system hai jahan guest browse kare, student register/attend/feedback/certificate le, organizer events manage kare, admin approve + users + reports handle kare — paperless aur role-based.

### Four SRS roles (map to our app)

| SRS name | Our system | Access |
|----------|------------|--------|
| Normal Student (Visitor) | Guest (not logged in) | Public browse only |
| Participant | DB role `user` → UI `/student/*` | Register, dashboard, etc. |
| Organizer | DB role `organizer` → `/organizer/*` | Only if admin assigns |
| Admin | DB role `admin` → `/admin/*` | Full control |

---

## 2. Progress snapshot

| Area | % | Notes |
|------|---|--------|
| Auth + OTP + profiles | ~90% | Add dept / enrolment / mobile on profile |
| Role guards + admin assign organizer | ~95% | Done |
| EventSphere UI screens | ~85% | Demo data; a few pages missing |
| Events DB + live CRUD | ~5% | Only demo seed |
| Registrations / capacity / waitlist | ~5% | UI mock |
| Attendance / QR / certificates | ~5% | UI mock |
| Gallery / feedback / announcements (real) | ~5% | Mostly mock |
| Sitemap / About / Contact / FAQ | 0% | Not built |
| Docs + video + zip deliverables | 0% | End of project |
| **Overall vs SRS** | **~30–35%** | Foundation solid; core domain pending |

---

## Phase A — Database foundation (START HERE)

**Goal:** Supabase mein real tables + RLS. UI abhi change mat karo zyada — pehle schema.

**Status: IMPLEMENTED in repo (2026-08-25).**  
**You must still RUN** `supabase/eventsphere-core.sql` in Supabase SQL Editor.

### A1. Extend `profiles` (Participant registration fields)

- [x] Add columns: `mobile`, `department`, `enrollment_no` (`eventsphere-core.sql`)
- [ ] Update signup form to collect them (**Phase B**)

### A2. Core tables

- [x] `events`, `registrations`, `attendance`, `feedback`, `certificates`
- [x] `media_gallery`, `venues`, `announcements`, `saved_events`
- [x] `calendar_sync`, `event_share_log` (schema ready)
- [x] Waitlist via `registrations.status = waitlist`
- [x] RPCs: `register_for_event`, `cancel_registration`, `seats_available`

### A3. RLS rules

- [x] Policies in `eventsphere-core.sql`
- [ ] Run SQL in Supabase + verify with 3 test accounts

### A4. Seed data (optional)

- [ ] Optional later — no hardcoded seed in Phase A (avoids fake data in DB)

### Reusable code added (not wired to UI yet)

| File | Purpose |
|------|---------|
| `src/constants/domain.js` | Table names + enums (no string hardcoding) |
| `src/lib/eventMappers.js` | DB ↔ UI mappers |
| `server/routes/events.js` (+ registrations, attendance, …) | API layer |
| `src/services/*.js` | Thin re-exports for Phase B |

**Phase A exit criteria:** Tables exist · RLS tested · Admin can still assign roles · No UI break.  
→ Next: **Phase B** (wire `App.tsx` to these services).

---

## Phase B — API layer + wire UI (make it dynamic)

**Goal:** `App.tsx` localStorage events → Supabase. Auth already works.

**Status (repo):** Core wiring done via `useEventSphereData` + services. Run `supabase/eventsphere-core.sql` in Supabase if not already applied.

### B1. Services / server routes

Add files (same pattern as `server/routes/items.js`):

- [x] `server/routes/events.js` — list, get, create, update, delete, approve/reject  
- [x] `server/routes/registrations.js` — register, cancel, list by event / by student  
- [x] `server/routes/attendance.js` — mark, list  
- [x] `server/routes/feedback.js`  
- [x] `server/routes/certificates.js`  
- [x] `server/routes/media.js`  
- [x] `server/routes/announcements.js`  
- [x] Re-export from `src/services/*.js`

**How:** Each function returns `{ data, error }` from `supabase.from(...).select/insert/update/delete`.

### B2. Replace demo state in `App.tsx`

Today:

```js
// Phase B: useEventSphereData() — not localStorage eventSeed
const { events, saved, registrations, actions } = useEventSphereData();
```

Do this instead:

- [x] `useEffect` on mount → `getEvents()` / `getMyRegistrations()`  
- [x] Keep local state for UI speed, but **source of truth = Supabase**  
- [x] After create/register/approve → refetch or patch state from response  
- [x] Theme may stay in localStorage (OK)

**Where to change:** `function App()` and handlers inside `CreateEvent`, `EventBrowser`, `Detail`, `GenericPage` (approvals), `AdminUsersLive` (already live).

### B3. Map UI fields ↔ DB columns

| UI (`App.tsx` event object) | DB column |
|-----------------------------|-----------|
| id | id |
| title | title |
| description | description |
| category | category |
| date | event_date |
| time | event_time |
| venue | venue |
| organizer | join profiles.full_name |
| capacity | capacity |
| registrations | count(*) from registrations confirmed |
| status | status (`Approved` UI ↔ `approved` DB — normalize in service) |

- [x] Add small mapper `src/lib/eventMappers.js` so UI labels stay pretty.

### B4. Role flows (must work end-to-end)

- [ ] **Guest:** `/` + public event list/detail (approved only) without login *(Phase C public pages)*  
- [x] **Student:** register → row in `registrations`; cancel before cutoff  
- [x] **Organizer:** create → `pending`; edit own; see registrants  
- [x] **Admin:** `/admin/approvals` updates `status` to approved/rejected  
- [x] Capacity: if full → waitlist status (no silent overbook) *(RPC in SQL)*

**Phase B exit criteria:** Refresh browser → events still there (not only localStorage). Organizer create → admin approve → student sees event → can register.

---

## Phase C — SRS high-value features (after B works)

Work in this order.

**Status (repo):** Core Phase C wired additively (public pages, QR passes, attendance ops, gallery upload, feedback, certificates, announcements, CSV, signup profile fields). Run `eventsphere-phase-c.sql` for Storage.

### C1. Public / guest pages

- [x] About Us  
- [x] Contact Us  
- [x] FAQs  
- [x] Sitemap page + link on Landing (`Landing` in `App.tsx`)  
- [x] Media Gallery page (filter by category / year / event)

**Where:** New routes in `AppRouter` Switch, e.g. `/about`, `/contact`, `/faq`, `/sitemap`, `/gallery` — all **public** (no login).  
**How:** Simple pages using existing `.surface` / `.page-head` classes from `index.css`.

### C2. Participant completeness

- [x] Signup: department, enrollment_no, mobile → profiles  
- [x] Dashboard: real registered / saved counts from DB  
- [x] Cancel registration (cutoff rule on event or global)  
- [x] Notifications list from `announcements` + registration reminders (email optional via EmailJS)  
- [x] Bookmark/saved events table OR profile JSON — prefer `saved_events(user_id, event_id)`  
- [x] Feedback form after `attendance.attended = true`  
- [x] Certificate: show download if issued; **fee acknowledgment form** (no payment gateway)

### C3. Organizer completeness

- [x] Dashboard metrics from DB counts  
- [ ] Create event with banner upload (Supabase Storage bucket `event-media`) *(upload helper ready; banner field on create can be Phase D polish)*  
- [ ] Edit / cancel / reschedule → optional EmailJS notify registrants  
- [x] Registration list + approve/reject if event requires approval  
- [x] Attendance: mark manual first; then QR (see C5)  
- [x] Upload gallery media to Storage + `media_gallery` rows  
- [x] Announcements to own event participants

### C4. Admin completeness

- [x] Live analytics (counts queries)  
- [x] Event approve/reject/request changes  
- [ ] Content moderation hooks (hide feedback / media flag)  
- [x] System-wide announcements  
- [x] Export reports CSV first (Excel-friendly); PDF later if time

### C5. QR attendance (SRS required)

- [x] On confirm registration → generate payload `eventId:studentId:token`  
- [x] Student “My Passes” shows QR (library e.g. `qrcode.react`)  
- [x] Organizer scanner page (camera or paste code) → insert/update `attendance`  
- [x] Attendance report table for organizer/admin

### C6. Capacity + waitlist + live slots

- [x] Enforce in **DB** (trigger or RPC `register_for_event`) so two users can’t overbook  
- [x] Show seats left on event cards  
- [x] On cancel → promote oldest waitlist → confirmed + notify

**Phase C exit criteria:** Demo video could already cover guest → student → organizer → admin happy path with real data.

---

## Phase D — Nice / remaining SRS + polish

**Status (repo):** D1–D3 wired on event detail (`.ics`, social share + logs, peer reviews). D5 starter docs added. Demo video + hosting remain team submit tasks.

### D1. Calendar integration

- [x] “Add to calendar” → download `.ics` (title, dtstart, location)  
- [x] Optional `calendar_sync` log table

### D2. Social share

- [x] Share buttons: WhatsApp / Twitter / Facebook / copy link  
- [x] Prefilled text: title + date + URL  
- [x] Optional `event_share_log`

### D3. Reviews module extras

- [x] Rate components (venue, coordination…) — extra columns or JSON *(already in feedback table + StudentFeedback)*  
- [x] View peer reviews on event detail (approved events only)

### D4. Non-functional checklist

- [x] Mobile responsive pass (sidebar already has breakpoints)  
- [x] Loading / empty / error states on every data screen *(gallery/reviews/announcements; extend as needed)*  
- [x] No secrets in repo (`.env` gitignored)  
- [ ] Fast loads (avoid fetching everything on every nav if possible) *(optional follow-up)*

### D5. Project deliverables (SRS §1.9) — submit time

- [x] Problem definition + design specs doc → `docs/PROBLEM-DEFINITION.md`  
- [x] Flowcharts / DFD → `docs/FLOWS.md`  
- [x] Database design (ERD) → `docs/DATABASE-ERD.md`  
- [x] Test data + SQL scripts → `supabase/eventsphere-seed.sql` (+ core scripts)  
- [x] ReadMe: assumptions + how to run + **credentials for all roles** → `docs/HOW-TO-RUN.md` (+ project README if present)  
- [ ] Hosted URL (Vercel/Netlify + Supabase) preferred  
- [ ] **Mandatory demo video (.mp4)** of full flows  
- [x] Sitemap on homepage  
- [x] Mention any AI-generated images in docs  

**Phase D remaining for team:** host frontend + record demo video.

---

## Phase order (cheat sheet)

```text
NOW →  A: SQL tables + RLS
    →  B: services + replace localStorage in App.tsx
    →  C: gallery, feedback, QR, certificates, public pages, capacity
    →  D: .ics, share, reports export, docs, video, host
```

**Do not start** with certificates/QR/docs while events are still localStorage.

---

## Missing UI screens (add only if not in App.tsx)

Check App routes first; add only if absent:

| Screen | Suggested path | Public? |
|--------|----------------|---------|
| About | `/about` | Yes |
| Contact | `/contact` | Yes |
| FAQ | `/faq` | Yes |
| Sitemap | `/sitemap` | Yes |
| Gallery | `/gallery` | Yes |
| Organizer QR scan | `/organizer/attendance` (enhance existing) | No |
| Certificate fee form | modal on student passes / event detail | No |

**How to add a public page:**

1. Create component function in `App.tsx` OR `src/pages/public/About.jsx`  
2. In `AppRouter` `<Switch>`: `<Route path="/about" component={About} />`  
3. Add link on `Landing`  
4. Keep in `publicPaths` if guests must open without login  

---

## File checklist (create / touch)

| File | Phase | Purpose |
|------|-------|---------|
| `supabase/eventsphere-core.sql` | A | All domain tables + RLS |
| `supabase/eventsphere-seed.sql` | A | Demo events |
| `server/routes/events.js` | B | Event API |
| `server/routes/registrations.js` | B | Register / cancel |
| `src/services/events.js` | B | Re-export |
| `src/lib/eventMappers.js` | B | UI ↔ DB |
| `src/App.tsx` | B–C | Replace `useStore` events |
| `src/components/auth/SignupForm.jsx` | C | Extra profile fields |
| Public pages | C | About / Contact / FAQ / Sitemap / Gallery |
| Storage bucket `event-media` | C | Banners + gallery |
| Docs folder | D | SRS deliverables |

---

## Testing matrix (every phase)

| # | Test | Pass? |
|---|------|-------|
| 1 | Guest opens `/`, sees approved events | |
| 2 | Signup → OTP → lands `/student/dashboard` | |
| 3 | Student cannot open `/organizer` or `/admin` | |
| 4 | Admin assigns organizer → user can open `/organizer` | |
| 5 | Organizer creates event → status pending | |
| 6 | Admin approves → guest/student see it | |
| 7 | Student registers → capacity decreases | |
| 8 | Full event → waitlist | |
| 9 | Cancel → waitlist promotes | |
| 10 | Attendance mark → certificate eligible | |
| 11 | Sign out → guest home `/` | |

---

## Out of scope (SRS itself says so)

- Real payment gateway for certificates (only collect/acknowledge fee details)  
- Copying AI-generated **code** (images OK if credited)

---

## Recommended next action (this week)

1. Create & run **`supabase/eventsphere-core.sql`** (Phase A).  
2. Build **`server/routes/events.js`** + list/create/approve.  
3. In **`App.tsx`**, load events from Supabase instead of `eventSeed` / `useStore`.  
4. Only then touch gallery / QR / docs.

When Phase A+B are done, overall SRS completion should jump from ~35% toward **~60–70%**.

---

## Quick status legend for team

| Tag | Meaning |
|-----|---------|
| DONE | Working with real auth/DB |
| UI-ONLY | Screen exists, demo/local data |
| TODO | Not built |
| LATER | Phase D / optional polish |
