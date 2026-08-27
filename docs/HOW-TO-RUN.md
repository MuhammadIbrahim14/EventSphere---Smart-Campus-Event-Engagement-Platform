# How to run + demo credentials (Phase D5)

## Assumptions

- Supabase Auth (Email); Confirm email preferably OFF for local demo.
- Roles: `user` (student UI), `organizer`, `admin` — signup always creates `user`.
- Apply SQL in order: see `supabase/README.md`.

## Commands

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

## Role credentials template

Create three accounts in the app, then:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_ADMIN@email.com';
update public.profiles set role = 'organizer' where email = 'YOUR_ORGANIZER@email.com';
```

| Role | Email | Password |
|------|-------|----------|
| Admin | _(fill)_ | _(fill)_ |
| Organizer | _(fill)_ | _(fill)_ |
| Student | _(fill)_ | _(fill)_ |

Do not commit real passwords.

## Multi-role demo (same browser)

Each **browser tab** keeps its own login. Open student / organizer / admin in separate tabs — logging into one no longer kicks out the others. Sign out only clears that tab.

## Remaining submit tasks

- Host frontend (Vercel/Netlify)
- Record mandatory demo video (.mp4)
