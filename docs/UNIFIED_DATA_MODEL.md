# Unified Data Model

This document locks the canonical fields used by the admin backend, user-facing product flows, and data migration scripts.

## Users

Required canonical fields:

- `id`
- `email`
- `name`
- `subscriptionPlan`
- `subscriptionStatus`

Optional governance fields:

- `avatar`
- `phone`
- `membershipExpiresAt`
- `region`
- `createdAt`
- `updatedAt`

Mapping rules:

- `role` remains an authorization field and should be stored with auth metadata or the user profile table, not duplicated into every domain record.
- `subscriptionPlan` only allows `free`, `pro`, `enterprise`.
- `subscriptionStatus` only allows `active`, `inactive`, `paused`, `cancelled`, `canceled`, `expired`.

## Contracts

Required canonical fields:

- `id`
- `userId`
- `title`
- `type`
- `status`
- `content`
- `parties`
- `signatures`
- `metadata`

Optional governance fields:

- `sourceType`
- `sourceContent`
- `analysisResult`
- `region`
- `createdAt`
- `updatedAt`

Mapping rules:

- Contract body payloads should be normalized into `content.document`.
- Search, archive, and operation logs should reference the canonical `id`.
- Contract status only allows `draft`, `pending`, `active`, `signed`, `completed`, `expired`, `cancelled`.

## Payments And Subscriptions

Subscription canonical fields:

- `id`
- `userId`
- `plan`
- `status`
- `price`
- `currency`
- `billingCycle`
- `paymentMethod`
- `currentPeriodEnd`
- `metadata`
- `createdAt`
- `updatedAt`

Payment canonical fields:

- `id`
- `userId`
- `amount`
- `currency`
- `status`
- `paymentMethod`
- `transactionId`
- `subscriptionId`
- `metadata`
- `createdAt`
- `updatedAt`

Mapping rules:

- Payment status only allows `pending`, `completed`, `failed`, `refunded`.
- Subscription plan and status must always be synchronized back to user metadata after admin edits.
- Legacy `orders` data can remain read-only compatibility data but must not be used as the primary write target.

## Company Profiles

Required canonical fields:

- `id`
- `userId`
- `companyName`
- `creditCode`
- `legalPerson`
- `address`

Optional governance fields:

- `profileName`
- `contactPerson`
- `contactPhone`
- `contactEmail`
- `status`
- `isDefault`
- `source`
- `ocrStatus`
- `licenseFileUrl`
- `metadata`
- `lastVerifiedAt`
- `createdAt`
- `updatedAt`

Mapping rules:

- `company_profiles` is multi-entity by design. `userId` is indexed, not unique.
- `isDefault` identifies the active profile for fast selection; only one default profile should exist per user after data repair.
- OCR ingestion writes to `source`, `ocrStatus`, and `licenseFileUrl`.

## Cleanup Baseline

The following legacy patterns should be removed or kept read-only:

- Duplicate user/payment adapters that bypass the unified model helpers.
- Prototype APIs that write to `orders` or one-off mock tables.
- Backup files and stale `.bak`, `.backup`, `.old` artifacts.
- Garbled admin copy and historical placeholder strings in current product paths.

## Required Artifacts

The locked governance artifacts in this repo are:

- `lib/data/unified-models.ts`
- `lib/database/cloudbase-schema.ts`
- `cloudbase-collections.json`
- `supabase/migrations/20260330_admin_audit_and_company_profile_governance.sql`
- `scripts/init-unified-governance.mjs`
