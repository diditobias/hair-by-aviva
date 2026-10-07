# Hair by Aviva

Public website + owner admin portal + optional client accounts, powered by one Supabase project.

## Connections

| Service | Resource |
|--------|----------|
| GitHub | https://github.com/diditobias/hair-by-aviva |
| Supabase | Project **Hair by Aviva** (`xmofejcerbjjjlzarebe`) |
| Netlify | https://hair-by-aviva.netlify.app |

## Stack

- Vite + React + TypeScript + React Router
- Supabase Auth, Postgres, RLS
- Netlify static hosting (`dist`)

## Setup

1. Copy `.env.example` to `.env.local` and fill Hair by Aviva Supabase URL + anon key only.
2. Apply migrations in `supabase/migrations/` to project `xmofejcerbjjjlzarebe` (Supabase SQL editor or CLI linked to that project).
3. Create Aviva’s auth user in Supabase Auth (do not enable public admin signup).
4. Run `supabase/seed_owner.sql` (with her email) to set `profiles.role = 'owner'`.
5. `npm install` then `npm run dev`.

## Apps

| Surface | Routes | Purpose |
|--------|--------|---------|
| Public site | `/`, `/services`, `/gallery`, `/book`, … | Discover → trust → book |
| Admin portal | `/admin/*` | Owner management (staff only) |
| Client account | `/account` | Optional; own bookings only |

Admin login is at `/admin/login` and is not linked from the main public nav.

## Security

- Roles: `owner`, `admin`, `client`
- `/admin/*` requires staff role (checked in UI + RLS)
- Clients cannot read `admin_notes`, other clients, or escalate roles
- Public booking/enquiry go through security-definer RPCs
- Never commit service-role keys
