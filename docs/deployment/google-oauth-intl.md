# INTL Google OAuth Deployment (Reproducible)

This document is the deployment contract for Google OAuth in the `INTL` region.
It replaces one-off dashboard-only setup with a repeatable environment-driven flow.

## Required Environment Variables

Set these in the INTL deployment environment:

- `NEXT_PUBLIC_DEPLOYMENT_REGION=INTL`
- `APP_URL` (for example `https://www.mornhub.quest`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_GOOGLE_OAUTH_MANAGED=true`
- `SUPABASE_GOOGLE_OAUTH_CLIENT_ID`
- `SUPABASE_GOOGLE_OAUTH_CLIENT_SECRET`
- `SUPABASE_GOOGLE_OAUTH_CALLBACK_URL`

`SUPABASE_GOOGLE_OAUTH_CALLBACK_URL` must equal `${APP_URL}/auth/callback`.

## Rollout Steps

1. Create or update a Google OAuth client in Google Cloud.
2. Add `${APP_URL}/auth/callback` to authorized redirect URIs.
3. Rotate/update `SUPABASE_GOOGLE_OAUTH_CLIENT_ID` and `SUPABASE_GOOGLE_OAUTH_CLIENT_SECRET` in deployment secrets.
4. Set `SUPABASE_GOOGLE_OAUTH_MANAGED=true` and `SUPABASE_GOOGLE_OAUTH_CALLBACK_URL=${APP_URL}/auth/callback`.
5. Apply the same client ID/secret in Supabase Auth provider settings (or your existing Supabase automation).
6. Deploy and verify readiness endpoint.

## Verification

After deployment:

1. Request `GET /api/auth/config`.
2. Confirm:
   - `oauthReadiness.providers.google.status === "ready"`
   - `oauthReadiness.providers.google.checks.envConfigured === true`
   - `oauthReadiness.providers.google.checks.dashboardProviderVerified === true`
   - `oauthReadiness.providers.google.expectedCallbackUrl === ${APP_URL}/auth/callback`

If status is `dashboard_check_required`, deployment metadata is incomplete or callback does not match.
