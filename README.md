# Advance RFQ — Super Admin (Platform) Backend

Standalone Node/Express + TypeScript service that powers the **Super Admin / SaaS
platform** module. Tenant procurement APIs (RFQs, suppliers, quotes, orders) stay
in the main backend (`advanceRfq-be`) and are **never** touched here.

> **Hard security rule:** these APIs only ever expose company metadata, plans,
> subscriptions, usage counts, and billing. No RFQ / supplier / quote / price /
> approval / order data is imported or returned.

## Architecture — shared DB, separate service

| Service            | Port (default) | Responsibility                                    |
| ------------------ | -------------- | ------------------------------------------------- |
| `advanceRfq-be`    | 3005           | RFQs, suppliers, branches, tenant users, **login**|
| `platform-be` (this)| 4005          | Companies, plans, subscriptions, billing, dashboard|

Both services connect to the **same PostgreSQL database** (`advance_rfq`) and use
the **same `JWT_SECRET`**, so a Super Admin who logs in through the main backend
carries a token this service can verify.

- This service **owns** `plans`, `subscriptions`, `platform_payments`,
  `platform_audit_logs`, and the lifecycle columns added to `companyDetails`.
- It **reads/limited-writes** `companyDetails`, `users`, `roles`, and only
  **counts** `branches`.

### Login flow (no second login here)

There is **one** login: `POST {BASE}/users/login` on the main backend. The Super
Admin is a normal `users` row with role **System Admin** (slug `super-admin`) and
`companyId = null`. The FE stores that token and calls `{BASE}/platform/*`; this
service verifies the shared-secret token and confirms the Super Admin role.

## Quick start

```bash
cp .env.example .env      # then set JWT_SECRET + DB creds to MATCH the main backend
npm install
npm run db:migrate        # idempotent — safe even if tenant BE already created the tables
npm run seed              # plans + roles + Super Admin user
npm run dev               # http://localhost:4005
```

Health check: `GET http://localhost:4005/api/health`

Default seeded Super Admin (override via env):

- Email: `superadmin@potatobazaar.com`
- Password: `SuperAdmin@123`

## Routing the frontend to this service

The FE uses a single `NEXT_PUBLIC_API_BASE_URL` for both `/users/login` and
`/platform/*`. Pick one:

- **(A) Reverse proxy (prod):** nginx routes `.../api/platform/*` to this service
  (port 4005) and everything else to the main backend (port 3005). No FE change.
- **(B) Separate FE base (local dev):** add `NEXT_PUBLIC_PLATFORM_API_BASE_URL`
  and point `lib/api/services/platform-service.ts` (or `BaseService`) at it for
  `/platform/*` calls. Login keeps using `NEXT_PUBLIC_API_BASE_URL`.

Full platform paths are under `/api` (e.g. `GET /api/platform/dashboard`).

## API surface

All `/platform/*` routes require a Super Admin Bearer token.

```
GET    /api/platform/dashboard
GET    /api/platform/companies
POST   /api/platform/companies
GET    /api/platform/companies/:id
PUT    /api/platform/companies/:id
POST   /api/platform/companies/:id/suspend
POST   /api/platform/companies/:id/activate
POST   /api/platform/companies/:id/archive
DELETE /api/platform/companies/:id                     (soft delete)
POST   /api/platform/companies/:id/reset-admin-password
GET    /api/platform/plans
GET    /api/platform/plans/:id
GET    /api/platform/subscriptions
GET    /api/platform/companies/:companyId/subscription
POST   /api/platform/companies/:companyId/subscription/change-plan
POST   /api/platform/companies/:companyId/subscription/renew
POST   /api/platform/companies/:companyId/subscription/cancel
POST   /api/platform/billing/checkout
POST   /api/platform/billing/verify
POST   /api/platform/billing/webhook/razorpay          (signature-verified, no auth)
POST   /api/platform/billing/webhook/stripe            (signature-verified, no auth)
```

List endpoints return `{ success, message, data, pagination }`. Single/action
endpoints return `{ success, message, data }`. All fields are camelCase, matching
the FE `types/platform.ts`.

## Billing

Razorpay + Stripe are integrated via their official SDKs. When provider keys are
absent (local dev), checkout returns a valid **dev session** so the FE flow still
works; `POST /platform/billing/verify` (or the webhooks) then flips the
subscription to `active` and records a `platform_payments` row.

Configure `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` and
`STRIPE_SECRET_KEY/WEBHOOK_SECRET` in `.env` for live payments.

## Coordination with the other repos

- **Main backend** keeps the `companyDetails` lifecycle columns + read-only
  plan/subscription models + `tenantPlanService` (enforces plan limits and blocks
  suspended/archived/deleted tenants at login). Do **not** re-run a duplicate
  table-creating migration there — this repo owns it. This migration is
  idempotent (existence checks) so a shared dev DB won't conflict.
- **Frontend** — choose routing option A or B above.

## Environment

See `.env.example`. Critical: `JWT_SECRET` and the `DB_*` values **must be
identical** to the main backend so tokens verify and both services hit the same
database.

## Scripts

| Script                | Purpose                              |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Dev server (ts-node-dev, respawn)    |
| `npm run build`       | Compile TypeScript to `dist/`        |
| `npm start`           | Run compiled server                  |
| `npm run typecheck`   | `tsc --noEmit`                       |
| `npm run db:migrate`  | Run migrations (idempotent)          |
| `npm run seed`        | Seed plans + roles + Super Admin     |
```
