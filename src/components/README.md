# Component structure

```text
components/
├── admin/       AdminUsersLive (Supabase roles) + re-exports from App.tsx
├── auth/        SignupForm, VerifyForm + Landing/Login re-exports
├── organizer/   re-exports from EventSphere App.tsx
├── shared/      re-exports from App.tsx
├── student/     re-exports from App.tsx
└── ui/          shadcn primitives (optional; theme CSS is in index.css)
```

**Source of truth UI:** `src/App.tsx` + `src/index.css` (EventSphere blue theme).

**Auth:** Supabase via `AuthContext` — DB roles `user` → student panel, `organizer`, `admin`.
