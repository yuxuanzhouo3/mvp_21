# MornContract Auth Setup

## Current status

- Completed: region switching is now driven by `APP_REGION` / `NEXT_PUBLIC_APP_REGION`, with `CN` and `INTL` supported.
- Completed: CN version uses Chinese UI by default, INTL version uses English UI by default.
- Completed: auth session state now syncs the `auth-logged-in` cookie for both CloudBase and Supabase flows, so protected routes can work after login.
- Completed: login entry is unified at `/auth`, with `/login` and `/signup` redirecting to it.
- Completed: production build has been verified with `npm run build`.

## Login matrix

- CN:
  - Email + password registration
  - Email + password login
  - WeChat login entry and callback flow reserved for later credential injection
  - Backend target: CloudBase
- INTL:
  - Email + password registration/login via Supabase Auth
  - Google login via Supabase OAuth
  - Backend target: Supabase + Vercel-compatible Node deployment

## Credentials still needed from boss

- CN:
  - `NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`
  - `CLOUDBASE_SECRET_ID`
  - `CLOUDBASE_SECRET_KEY`
  - `NEXT_PUBLIC_WECHAT_APP_ID`
  - `WECHAT_APP_SECRET`
- INTL:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Supabase dashboard Google provider configuration

## Local switching

1. Copy `.env.cn` or `.env.intl` to `.env.local`.
2. Fill the real credentials.
3. Run `npm run dev`.

## Reference-project note

- `E:\xiangmu\code\mvp_25` was scanned during this migration task.
- That directory currently does not contain a reusable login implementation, so the migration work was completed by consolidating and repairing the auth stack already present in this repository.
