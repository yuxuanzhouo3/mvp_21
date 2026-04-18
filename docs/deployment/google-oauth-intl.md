# INTL Google OAuth Checklist

This project's international deployment uses Supabase Auth for Google sign-in.

## 1. App runtime variables

Make sure the INTL deployment environment has these values:

- `APP_URL` or `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended readiness-manifest variables for operations:

- `SUPABASE_GOOGLE_OAUTH_MANAGED=true`
- `SUPABASE_GOOGLE_OAUTH_CLIENT_ID`
- `SUPABASE_GOOGLE_OAUTH_CLIENT_SECRET`
- `SUPABASE_GOOGLE_OAUTH_CALLBACK_URL=https://<your-app-domain>/auth/callback`

Note:
`SUPABASE_GOOGLE_OAUTH_CALLBACK_URL` in this repository is used as the expected post-auth app callback URL for readiness checks. It is not the Google Console redirect URI.

## 2. Google Cloud Console

Create a Google OAuth client of type `Web application`.

Set:

- Authorized JavaScript origins: your app origin, for example `https://www.mornhub.quest`
- Authorized redirect URI: your Supabase project callback URL, for example `https://<project-ref>.supabase.co/auth/v1/callback`

For this workspace, if the INTL Supabase URL is `https://<project-ref>.supabase.co`, the Google redirect URI must use the same `<project-ref>`.

## 3. Supabase Dashboard

In `Authentication -> Providers -> Google`:

- Enable the Google provider
- Paste the Google client ID
- Paste the Google client secret

In `Authentication -> URL Configuration`:

- Set `Site URL` to the production app origin
- Add the app callback URL to the redirect allow list
- Example callback: `https://www.mornhub.quest/auth/callback`

## 4. Expected app behavior

The app starts Google login with:

- provider: `google`
- redirectTo: `https://<app-origin>/auth/callback`

If Google or Supabase returns an OAuth error, the callback page now surfaces the error text from the URL hash so configuration issues are visible to operators.

## 5. Common failure modes

- Google provider disabled in Supabase
- Google redirect URI configured as the app callback instead of the Supabase callback
- App origin mismatch, for example `mornhub.quest` vs `www.mornhub.quest`
- App callback missing from Supabase redirect allow list
- Wrong Google client ID or secret copied into Supabase
