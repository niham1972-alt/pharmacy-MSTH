# Pharmacy Management System — Modules 1–4 (Dashboard · Medicines · Purchases · Sales/POS)

Enterprise Pharmacy Management Software, built module by module. This is **Module 1: Dashboard** — the role-aware operational landing screen. 17 other modules (Medicines, Sales/POS, Inventory, Batch & Expiry, Suppliers, Customers, Returns, Stock Adjustment, Barcode, Expenses, Reports, Audit Logs, Users & Roles, Backup & Restore, Settings, Purchases, ...) do not exist yet — the Dashboard depends on clearly-marked **stub** Prisma models for them (see `backend/prisma/schema.prisma`) that later modules will supersede.

## Stack

- **Backend**: NestJS + TypeScript, layered `controller → service → repository (Prisma)`
- **Database**: Supabase PostgreSQL via Prisma
- **Auth**: Supabase Auth (JWT, HS256) + RBAC guards
- **Frontend**: React 18 + TypeScript + Vite + Tailwind (dark mode from day one)
- **State**: TanStack Query (server state) + Zustand (global filters)
- **Realtime**: Supabase Realtime (alerts panel), with 60s-polling fallback
- **Cache**: Redis (optional — gracefully no-ops when disabled)

## Project layout

```
/backend    NestJS API (see backend/src/modules/dashboard)
/frontend   Vite + React app (see frontend/src/features/dashboard)
```

## Setup

### 1. Install dependencies (npm workspaces)

```bash
npm install
```

### 2. Configure environment variables

Copy the example env files and fill in your real Supabase project values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**`backend/.env`**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (Settings > Database) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_JWT_SECRET` | Settings > API > JWT Secret — verifies incoming tokens (HS256) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only, never expose to the frontend |
| `REDIS_ENABLED` | `true`/`false` — caching no-ops gracefully when `false` or unreachable |
| `REDIS_URL` | Redis connection string (only used when enabled) |
| `PORT` | API port (default `3000`) |
| `CORS_ORIGINS` | Comma-separated allowlist of frontend origins |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL, e.g. `http://localhost:3000/api` |
| `VITE_SUPABASE_URL` | Same Supabase project URL as the backend |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

> The JWT claims contract the Dashboard expects (until Module 16 — Users & Roles — formalizes it): `app_metadata: { role, pharmacyId, branchId, accessibleBranchIds }`. Configure this via a Supabase Auth Hook / DB trigger on your project.

### 3. Run database migrations against your Supabase project

```bash
cd backend
npx prisma migrate dev
```

### 4. Start both apps

```bash
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173
```

There's a temporary `/login` page (email/password via `supabase.auth.signInWithPassword`) so the Dashboard is reachable before the real Auth/Users & Roles module exists — replace it wholesale when that module lands.

## Tests

```bash
npm test                              # both workspaces
npm run test -w backend               # Jest unit tests
npm run test -w backend -- --config ./test/jest-e2e.json   # Supertest e2e (mocked Prisma, no DB needed)
npm run test -w frontend              # Vitest + React Testing Library
```

## API reference

All endpoints are under `/api/dashboard`, protected by `JwtAuthGuard` + `RolesGuard`, and return the standard envelope `{ success, data, message, meta? }` (errors: `{ success: false, data: null, message, errorCode }`).

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/summary` | KPI cards (role-redacted) | all (fields vary — see matrix) |
| GET | `/sales-trend` | Revenue/profit trend chart | all except `inventory_manager` |
| GET | `/top-selling` | Top medicines by qty/revenue | all except `cashier` |
| GET | `/alerts` | Low-stock / expiry / out-of-stock alerts | admin, pharmacist, inventory_manager, auditor |
| POST | `/alerts/:id/acknowledge` | Acknowledge an alert (audit-logged) | admin, pharmacist, inventory_manager |
| GET | `/activity-feed` | Recent activity (role-filtered) | all |
| GET | `/purchase-snapshot` | Pending purchase orders | admin, inventory_manager, accountant, auditor |
| GET | `/cash-summary` | Payment method breakdown | admin, cashier (own), accountant, auditor |
| GET / PUT | `/preferences` | Widget layout preferences | all |
| GET | `/export` | PDF snapshot — **Phase 2, stubbed** | admin, accountant |

`super_admin` has the same access as `admin` everywhere above.

## Module 2: Medicines / Products

The master catalog. **Supersedes the Module 1 `Medicine` stub** via the `20260704000000_medicines_module` migration — the Dashboard now reads real `Medicine` data (low-stock/top-selling resolve names via `COALESCE(brandName, genericName)`). `currentStock` is kept on `Medicine` as a **transitional** field until Inventory (Module 5) owns the live stock ledger.

Endpoints (envelope + RBAC identical to Module 1; list uses the pagination contract `{ page, limit, total, totalPages, data }`):

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/api/medicines` | Paginated list (search, filters, sort) | all (read) — `cashier` gets no `costPrice` |
| GET | `/api/medicines/search?q=` | Lean typeahead (name/generic/SKU/barcode) — POS-facing | all (read) |
| GET | `/api/medicines/:id` | Full detail + relations | all (read) |
| GET | `/api/medicines/:id/price-history` | Immutable price-change log | all except `cashier` |
| POST | `/api/medicines` | Create (duplicate + negative-margin guards) | admin, pharmacist, inventory_manager |
| PUT | `/api/medicines/:id` | Update (price change → atomic `PriceHistory`) | admin, pharmacist, inventory_manager |
| PATCH | `/api/medicines/:id/status` | Active / Inactive / Discontinued | admin, inventory_manager |
| POST | `/api/medicines/:id/archive` | Soft-delete (`isActive=false`) | admin, inventory_manager |
| DELETE | `/api/medicines/:id` | Hard-delete (blocked if sales/batch history) | admin |
| POST | `/api/medicines/check-duplicate` | Pre-save duplicate check | admin, pharmacist, inventory_manager |
| POST / DELETE | `/api/medicines/:id/barcodes[/:barcodeId]` | Manage barcodes (unique per pharmacy) | admin, inventory_manager |
| CRUD | `/api/medicine-{categories,manufacturers,dosage-forms,units}` | Lookup management (delete-guarded) | read: all · write: admin, inventory_manager |

Key business rules enforced **server-side**: `costPrice`/`margin` redacted from `cashier` responses (field omitted, not hidden); controlled-substance schedule auto-forces `prescriptionRequired = true`; price changes write immutable `PriceHistory` rows inside the same transaction as the update; hard-delete blocked when transactional history exists; lookup deletion blocked while referenced by any medicine (returns dependent count). Emits `medicine.created` / `medicine.updated` / `medicine.price-changed` / `medicine.status-changed` / `medicine.archived` for downstream modules.

Frontend: `frontend/src/pages/Medicines/*` (list, detail with Overview/Pricing/Price-History/Barcodes tabs, create/edit form, lookups management) + `frontend/src/features/medicines/*`. Sidebar nav now routes via `NavLink`.

## Module 3: Purchase Management

Full procurement lifecycle. **Supersedes the Module 1 `PurchaseOrder` stub** via the `20260704010000_purchases_module` migration, and adds a **`Supplier` stub** (restrict-on-delete FK, finalized in Module 7). The Dashboard's Purchase Snapshot + pending count now read real PO data.

**The GRN transaction is the core.** `GoodsReceiptsService.confirmGrn()` runs a single Prisma `$transaction` that: writes the GoodsReceipt + items → creates `MedicineBatch` rows (Module 6 seam) → increments stock (Module 5 seam) → updates `Medicine.costPrice` per costing rule + immutable `PriceHistory` (Module 2 seam) → advances PO/line received quantities & status → seeds the payable due date. Any failure rolls **all** of it back. Cross-module writes go through injected `*-sync` services (`integrations/`), never direct table writes.

Endpoints (base `/api/purchases`; **`cashier` gets 403 on every one** — the module is invisible to that role):

| Method | Endpoint | Roles |
|---|---|---|
| GET | `/orders`, `/orders/:id` | admin, pharmacist, inventory_manager, accountant, auditor |
| POST/PUT | `/orders`, `/orders/:id` | admin, inventory_manager |
| POST | `/orders/:id/submit` (auto-approves under threshold), `/cancel` | admin, inventory_manager |
| POST | `/orders/:id/approve`, `/reject` | admin |
| POST/GET | `/grn`, `/grn/:id` (transactional receipt) | write: admin, inventory_manager · read: +pharmacist, accountant, auditor |
| POST | `/grn/:id/acknowledge-variance` | admin, inventory_manager |
| POST/GET | `/orders/:id/payments` | admin, accountant (record) · +auditor (read) |
| GET | `/pending-approvals` | admin · `/summary` | admin, inventory_manager, accountant, auditor |
| GET/POST | `/suppliers` (Module 7 stub) | read: all non-cashier · write: admin, inventory_manager |

Key rules enforced server-side: stock/cost mutate **only on GRN confirmation** (never PO create/approve); partial receipts tracked across multiple GRNs (`PARTIALLY_RECEIVED` → `RECEIVED`); batch # + expiry mandatory per line, future-dated unless a logged override; cost-variance soft-warn (>10%) / hard-block-with-ack (>50%); free/bonus units dilute weighted-average cost; over-receipt capped by tolerance; payments can't exceed outstanding; PO edits locked after `DRAFT`; race-safe `PO-YYYY-NNNNNN` / `GRN-YYYY-NNNNNN` numbering via `pg_advisory_xact_lock`; concurrent GRNs serialized with `SELECT … FOR UPDATE`. Costing rule + thresholds are env-configurable (`PO_COSTING_RULE`, `PO_AUTO_APPROVE_THRESHOLD`, `PO_OVER_RECEIPT_TOLERANCE_PCT`, `PO_VARIANCE_WARN_PCT`, `PO_VARIANCE_BLOCK_PCT`).

Frontend: `frontend/src/pages/Purchases/*` (PO list, detail with Line-Items/Receipts/Payments tabs + status-aware action bar, PO create form, GRN receive form, pending-approvals queue). `cashier` is blocked at the route (`PurchasesGate`) and hidden from nav.

## Module 4: Sales / POS Billing

The counter checkout. **Supersedes the Module 1 `Sale`/`SaleItem` stub** via the `20260704020000_sales_pos_module` migration and becomes the authoritative sales/profit source. Adds `SalePayment` (split payments), `SaleComplianceRecord`, `CashierSession`, `ParkedSale`. Because payment method moved off `Sale` onto `SalePayment`, the Dashboard's cash-summary was reworked to aggregate payments by method; the sales-trend query was also fixed to avoid a Sale⋈SaleItem revenue fan-out.

**Finalize is the transactional core.** `SalesService.finalize()` runs one Prisma `$transaction`: locks the medicine rows (`FOR UPDATE`) and re-checks stock → generates `SL-YYYY-NNNNNN` → creates Sale/SaleItem/SalePayment/SaleComplianceRecord (price/cost/tax **snapshotted**) → FEFO batch allocation (Module 6 seam) → stock decrement (Module 5 seam) → updates session totals. Any failure rolls all of it back; a retried request with the same `idempotencyKey` returns the first sale (no double charge).

Endpoints (base `/api/sales`):

| Method | Endpoint | Roles |
|---|---|---|
| POST/GET | `/sessions`, `/sessions/current`, `/sessions/:id/close` | cashier, pharmacist, admin (own) |
| GET | `/sessions`, `/sessions/:id` | admin, accountant, auditor (all) · owner |
| POST | `/cart/price-check` (advisory pre-flight) | cashier, pharmacist, admin |
| POST | `/` (finalize) | cashier, pharmacist, admin |
| GET | `/`, `/:id` | all readers — **cashier auto-scoped to own sales** |
| POST | `/:id/void` (same-day, reverses stock/batch/compliance) | admin, pharmacist |
| POST | `/discount-approval` (step-up auth for over-limit discount) | pharmacist, admin |
| POST/GET/DELETE | `/parked` | cashier, pharmacist, admin |

Server-side (never bypassable): payment sum must equal grand total exactly; prescription-required lines rejected without `prescriptionVerifiedBy` (`PRESCRIPTION_NOT_VERIFIED`); controlled substances rejected without a compliance record (`COMPLIANCE_RECORD_MISSING`); FEFO batch selection is automatic (manual override is elevated + audited); concurrent last-unit sales caught by row lock (`STOCK_CHANGED_SINCE_CHECK`); discounts above the auto-allowed % need elevated approval; void only within the configurable window. Env-configurable: `POS_AUTO_DISCOUNT_PCT`, `ALLOW_NEGATIVE_STOCK`, `POS_VOID_WINDOW_DAYS`, `SESSION_VARIANCE_THRESHOLD`. Cart math lives in `cart-calculations.util.ts`, mirrored byte-for-byte by the frontend's `cartCalculations.ts`.

Frontend: `frontend/src/pages/POS/*` (session-gated POS screen — local-first Zustand cart, search-to-add, live totals, cash tender/change, prescription step-up verify, finalize + receipt; session close with variance) and `frontend/src/pages/Sales/*` (history list — cashier-scoped — + detail with void).

## Role-permission matrix

| Widget | super_admin/admin | pharmacist | inventory_manager | cashier | accountant | auditor |
|---|---|---|---|---|---|---|
| KPI Cards | all | no profit | stock-focused only | sales only | financial only | all |
| Sales Trend + Profit | ✅ | revenue only | ❌ | own sales, no profit | ✅ | ✅ |
| Top Selling | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Low Stock/Expiry Alerts | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Activity Feed | ✅ | filtered | filtered | own actions only | filtered | ✅ |
| Purchase Snapshot | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Cash Summary | ✅ (all) | ❌ | ❌ | own shift | ✅ (all) | ✅ (all) |
| Quick Actions | all actions | sale/medicine | purchase | sale only | ❌ | ❌ |

This is enforced on the **backend** (RolesGuard + per-field redaction in `DashboardService`) — the frontend's role gating (`features/dashboard/utils/rolePermissions.ts`) is a UX optimization only and is never the sole enforcement point.

## What's intentionally deferred

- **PDF export** (`GET /dashboard/export`) — scaffolded, returns a "coming soon" response. Full implementation needs Puppeteer + Supabase Storage (Phase 2).
- **Materialized view for the trend chart** — the repository currently uses a parameterized raw SQL join; swapping in a nightly-refreshed `daily_sales_summary` view is a one-line change in `dashboard.repository.ts` when data volume warrants it.
- **Real Auth/Users & Roles module** — `frontend/src/shared/auth/LoginPage.tsx` is temporary scaffolding.
- **Medicines: bulk CSV import/export, image upload, `pg_trgm` GIN search index** — deferred. Search uses `ILIKE` today; swapping in a trigram `similarity()` predicate is a one-line change in `medicines.repository.ts` when SKU volume warrants it.
- **Purchases: PO/GRN PDF generation, invoice attachment upload, PO templates, PO amendment** — scaffolded/stubbed (`/orders/:id/pdf`, `/grn/:id/pdf` return "coming soon"; `PurchaseOrderTemplate`/`PurchaseAttachment` models exist). PO line items lock after `DRAFT` (documented limitation — amend via cancel + recreate).
- **Sales/POS: receipt PDF, customer association (Module 8), Redis hot-path price cache, offline-first** — deferred. `ParkedSale` model + park/resume API exist; receipt is an in-app confirmation for now. Controlled-substance compliance capture is wired server-side (rejects without a record) but the demo catalog has no controlled items, so the modal isn't exercised.
- Cross-module stub tables (`Sale`, `Medicine`, `MedicineBatch`, `PurchaseOrder`, `Expense`, `AuditLog`, `PharmacySettings`) will be superseded by their owning module's authoritative schema — reconcile via `prisma migrate` when each module is built.
