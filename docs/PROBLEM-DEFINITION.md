# Problem definition & design specs (EventSphere)

## Problem

Campus events are often announced via noticeboards, WhatsApp groups, and informal lists. Students miss registrations, organizers struggle with capacity and attendance, and admins lack a single approval/reporting surface.

## Goal

A **centralized College Event Information System** where:

| Actor | Needs |
|-------|--------|
| Guest | Browse public info (About, FAQ, Gallery, Sitemap) |
| Student (`user`) | Discover approved events, register/cancel, passes/QR, feedback, certificates |
| Organizer | Create/manage events, attendance, media, announcements |
| Admin | Approve events, assign roles, analytics/CSV, system announcements |

## Design decisions

- **SPA**: React + Vite + wouter; EventSphere blue/midnight theme in `src/index.css`.
- **Backend**: Supabase Auth + Postgres RLS (no custom Express server required for domain APIs).
- **Roles**: Signup always `user`; organizer/admin assigned by admin only.
- **Capacity**: Enforced in DB RPC `register_for_event` (waitlist + promote on cancel).
- **Payments**: Out of scope — certificate **fee acknowledgment** only.
- **UI strategy**: Keep teammate EventSphere shells; wire live data (Phases A–C); polish extras (Phase D).

## Non-functional

- Mobile sidebar breakpoints already present.
- Secrets only in `.env` (gitignored).
- Public marketing pages remain guest-accessible without login.
