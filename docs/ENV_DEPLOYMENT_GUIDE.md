# Environment And Deployment Guide

## Current architecture

This repository is a single Next.js codebase with one shared frontend and one shared route tree.

The active deployment mode is selected by environment variables:

- `NEXT_PUBLIC_APP_REGION`
- `APP_REGION`
- `NEXT_PUBLIC_DEPLOYMENT_REGION`

If the resolved value is `CN`:

- UI default language is Chinese
- auth provider is CloudBase
- database provider is CloudBase
- payment providers are WeChat Pay and Alipay
- primary domain is `https://morncontract.mornscience.top`

If the resolved value is `INTL`:

- UI default language is English
- auth provider is Supabase
- database provider is Supabase
- payment providers are Stripe and PayPal
- primary domain is `https://www.mornhub.quest`

## What `npm run dev` uses

Plain `npm run dev` now defaults to the CN profile for local development.

It does this by copying `.env.cn` into `.env.local` before starting Next.js.

That means:

- `npm run dev` -> CN
- `npm run dev:cn` -> CN
- `npm run dev:intl` -> INTL

Next.js actually reads `.env.local` at runtime. The `use-env` script makes sure the correct profile becomes the active `.env.local`.

## Canonical env files

- `.env.cn`
  - canonical CN deployment variables
  - for CloudBase deployment
- `.env.intl`
  - canonical INTL deployment variables
  - for Vercel deployment
- `.env.local`
  - active local runtime file
  - ignored by git

## CloudBase deployment for CN

When deploying the CN version to CloudBase:

1. Use the values from `.env.cn`
2. Fill those variables into the CloudBase environment variable panel
3. Make sure the region variables are:
   - `APP_REGION=CN`
   - `NEXT_PUBLIC_APP_REGION=CN`
   - `NEXT_PUBLIC_DEPLOYMENT_REGION=CN`
4. Make sure the app URL variables are:
   - `APP_URL=https://morncontract.mornscience.top`
   - `NEXT_PUBLIC_APP_URL=https://morncontract.mornscience.top`

## Vercel deployment for INTL

When deploying the INTL version to Vercel:

1. Use the values from `.env.intl`
2. Fill those variables into the Vercel environment variable panel
3. Make sure the region variables are:
   - `APP_REGION=INTL`
   - `NEXT_PUBLIC_APP_REGION=INTL`
   - `NEXT_PUBLIC_DEPLOYMENT_REGION=INTL`
4. Make sure the app URL variables are:
   - `APP_URL=https://www.mornhub.quest`
   - `NEXT_PUBLIC_APP_URL=https://www.mornhub.quest`

## Git safety

Real environment files are ignored by git:

- `.env.local`
- `.env.cn`
- `.env.intl`
- other real `.env*` files

Safe placeholder templates are versioned:

- `.env.cn.example`
- `.env.intl.example`

Before committing, run:

```powershell
npm run git:preflight
```

This blocks accidental staging of `.env` files.
