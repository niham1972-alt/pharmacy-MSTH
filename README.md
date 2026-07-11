# Pharmacy Management System — Modules 1–8 + 15–16 (Dashboard · Medicines · Purchases · Sales/POS · Inventory · Batch & Expiry · Suppliers · Customers · Audit Logs · Users & Roles)

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

## Module 5: Inventory / Stock Management

The **authoritative owner of stock**. Migration `20260705000000_inventory_module` adds `Inventory` (materialized aggregate), the append-only `StockLedgerEntry`, `StockTransfer`(+items) and `StockReconciliation`. Also adds a `Customer` stub (Module 8) for POS association.

**`InventoryService` is the stable internal contract** — the ONLY code permitted to mutate stock. Modules 3 (GRN) and 4 (sale/void) were rewired to call it instead of their own sync helpers. It's a `@Global` provider; inject it directly.

```ts
recordStockIn(params, tx?)   // + ledger IN, aggregate++, Medicine.currentStock mirror
recordStockOut(params, tx?)  // INSUFFICIENT_STOCK unless allowNegativeStock
getCurrentStock(params)
checkSufficientStock(params)
reverseStockMovement({ originalLedgerEntryId, ... }, tx?)  // offsetting entry, original untouched
```

Each mutating method runs in a transaction, takes a `SELECT … FOR UPDATE` lock on the medicine row (**do not remove — prevents concurrent decrements racing past zero**), writes an **immutable** ledger entry (`balanceAfter` snapshot for fast history), updates the `Inventory` aggregate, and mirrors the value into `Medicine.currentStock` so all existing reads keep working. Callers pass their own `tx` so stock changes are atomic with the GRN/sale. **Invariant, verified live: `Inventory.currentStock === SUM(ledger signed by direction)`.** Corrections never edit the ledger — they append an offsetting entry (used by sale void).

HTTP endpoints (base `/api/inventory`): `GET /` (list, cashier gets **no cost/valuation**), `/:medicineId` (+ batches), `/:medicineId/ledger` (movement history w/ clickable source links), `/summary`, `/reorder-suggestions`, `/valuation`, `POST/GET /reconciliation` (informational variance — never mutates stock; Module 11 actions it), `POST/GET /transfers` + `/:id/approve` + `/:id/receive` (stock moves only at receive, atomically OUT@source + IN@dest). Numbering `TRF-YYYY-NNNNNN` via advisory lock.

Frontend: `frontend/src/pages/Inventory/*` (list w/ summary cards + status badges + valuation, detail with Overview/Batches/Movement-History tabs, reorder suggestions with a **Create-PO deep-link** that pre-fills Module 3's form, reconciliation with variance).

## Module 6: Batch & Expiry Management

The **authoritative owner of batch identity + expiry logic + FEFO**. Migration `20260706000000_batch_expiry_module` **supersedes the Module 1 `MedicineBatch` stub** (adds `receivedQuantity`/`currentQuantity`/`status`/`isRecalled`/expiry-override/`sourceGrn*`) and adds append-only `BatchWriteOff` + `BatchRecall` (with `BatchStatus`, `RecallResolutionStatus` enums). `currentQuantity` is a **synchronized read-model** of Module 5's ledger — every quantity change here calls `InventoryService` in the *same transaction*, so it never drifts.

**`BatchesService` is the stable internal contract** (`@Global`) — Modules 3 (GRN) and 4 (sale/void) were rewired to call it, replacing their old `batch-sync`/`batch-fefo` seams (now deleted).

```ts
createOrAppendBatch(params, tx?)   // same medicine+batchNo+branch APPENDS; new number CREATES. Records stock IN (Module 5) internally.
getFefoAllocation(params)           // non-mutating draw-plan preview
allocateAndConsume(params, tx?)     // FEFO decision + Module 5 stock OUT in one tx — the sole sale-consumption path
reverseConsumption(params, tx?)     // sale void: restore batch qty + offsetting ledger IN
isBatchSellable({ batchId })        // THE single hard-block enforcement point
```

**Safety-critical invariant (verified live): expired and recalled batches are NEVER selectable for sale — not via automatic FEFO, not via manual override, not via a direct API call.** `allocateAndConsume` filters to `currentQuantity > 0 AND NOT isRecalled AND expiryDate > now`, ordered `expiryDate ASC, createdAt ASC` (deterministic FEFO). A manual `manualBatchId` pointing at an expired/recalled batch is rejected (`MANUAL_BATCH_NOT_SELLABLE`); an all-recalled/expired medicine fails cleanly with `INSUFFICIENT_SELLABLE_STOCK` (returns `available`), even when raw `Inventory.currentStock` shows enough total. A medicine that never had a batch falls back to a direct Module 5 stock-out (non-batch-tracked path). Status is tiered per Module 1's Dashboard colours (red <30d · orange 30–90d · yellow 90–180d), persisted for fast filtering and re-derived live on read.

HTTP endpoints (base `/api/batches`): `GET /` (filter/sort/paginate), `/:id` (detail + linked GRN + traceability sales + write-off/recall history), `/expiring?thresholdDays=` (tiered), `/expired`, `POST /write-off` + `GET /write-offs` (permanent compliance record, reason EXPIRY_WRITE_OFF via Module 5), `POST /:id/recall` (idempotent) + `GET /recalls` + `POST /recalls/:id/resolve` + `/recalls/:id/affected-sales`. `cashier` has **no** direct access (indirect via POS only); write-off = admin/inventory_manager, recall = admin/pharmacist.

Frontend: `frontend/src/pages/Batches/*` (list w/ status badges + day-tier chips, detail with traceability + Flag-Recall/Write-Off actions, tiered Expiring-Soon view, Expired-Stock multi-select write-off, Recalls with resolve + affected-sales). Shared `BatchStatusBadge`/`ExpiryChip` reuse Module 1's colour convention.

## Module 7: Suppliers Management

The **authoritative supplier/vendor master data**. Migration `20260707000000_suppliers_module` **supersedes the Module 3 `Supplier` stub** (`name`→`companyName`, adds `supplierType`/license/`paymentTermsCode`/`currency`/`bankAccountDetails`/`createdBy`) and adds `SupplierContact`, `SupplierAddress`, `SupplierDocument`, `SupplierMedicinePrice`, `MedicinePreferredSupplier` + `SupplierType` enum. `PurchaseOrder.supplierId` was already a real FK — the relation is now backed by the full model.

**Full CRUD + archive + guarded hard-delete** (blocked if any PO/template references it — mirrors Module 2's medicine guard). Sub-entities: contacts (at most one primary, auto-unset enforced server-side), addresses, compliance documents (with tiered license-expiry status), negotiated pricing (`SupplierMedicinePrice`, deterministic current-price resolution: latest `effectiveFrom ≤ now` with an open window), preferred suppliers (`MedicinePreferredSupplier`, consumed by Module 5 reorder → PO deep-link).

`SupplierPerformanceService` **reads Module 3's tables** (PO/GRN/payment) as read-only aggregations — total spend, on-time %, variance frequency, avg payment turnaround, per-supplier + all-suppliers payables — no duplicated storage, batched `groupBy` (no N+1). Archived suppliers with debt still surface in payables.

`bankAccountDetails` is **redacted** from API responses for anyone other than `admin`/`super_admin`/`accountant` (verified live: `inventory_manager` sees the profile but not banking). All writes audit-logged, with before/after diffs on financially-sensitive fields (`paymentTermsCode`, `bankAccountDetails`).

`paymentTermsCode` → net-days lives in one shared helper (`modules/suppliers/payment-terms.ts`), used by both Module 7 and Module 3's PO due-date calc. Module 3's PO/GRN/dashboard read paths expose a `name` alias (= `companyName`) so the existing Purchases UI works unchanged.

HTTP endpoints (base `/api/suppliers`): `GET /` (filter/sort/paginate), `/active` (picker), `/:id`, `POST /`, `PUT /:id`, `POST /:id/archive`, `DELETE /:id`, contacts/addresses/documents sub-routes, `/:id/pricing`, `/:id/performance`, `/:id/payables`, `/payables-summary`, `/needing-attention`, and `/api/medicine-preferred-suppliers`. `cashier` has zero access.

Frontend: `frontend/src/pages/Suppliers/*` (list w/ type/license/spend/outstanding, tabbed detail — Overview/Contacts/Documents/Pricing/Performance/Payables, sectioned create/edit form with a repeatable contacts editor, Needing-Attention view). **`SupplierPicker`** (`features/suppliers/components/`) is the shared searchable select — built here, **reused in Module 3's PO form** (excludes archived suppliers).

## Module 8: Customers / Patients

> ### ⚠️ Elevated privacy posture — read before touching this module
> This module handles **personal + health-adjacent data** (allergies, chronic conditions, prescriptions) and carries the **highest privacy sensitivity** in the system. Health data lives in a **separate table** (`CustomerHealthProfile`) behind a **separate service + controller** (`HealthProfileService` / `HealthProfileController`) gated to **admin/pharmacist only** — a cashier/accountant/auditor/inventory_manager hitting those routes gets a **403 at the guard**, not a field-redacted response. The default `GET /customers/:id` **never** includes health data (it only returns a `hasHealthProfile` boolean so the UI knows whether to offer the gated tab). Every health-profile **access** (not just change) is audit-logged (`HEALTH_PROFILE_VIEWED`). Do not add health fields to the general customer response or relax these role sets without understanding this.

Migration `20260708000000_customers_module` **supersedes the Module 4 `Customer` stub** (`phone` now required + unique; adds DOB/address/emergency-contact/consent/`isMergedInto`/`createdBy`) and adds `CustomerHealthProfile` (1:1), `PrescriptionRecord`, `CustomerTag`(+`Assignment`), `CustomerNote`. **`Sale.customerId` is now a real FK** to `Customer`.

- **Quick-add** (`POST /customers/quick-add`, cashier/admin/pharmacist) — name + phone, single-table insert for the POS. Exact-phone duplicate returns **409 `CUSTOMER_PHONE_EXISTS`** with a "search instead" message (no checkout friction). **Full create/edit** (admin/pharmacist) adds the richer profile.
- **`cashier` search** (`GET /customers/search`) is a genuinely **narrow, separate response shape** — `{ id, name, phone, hasPrescriptionOnFile }` only, never spend/health. Cashiers cannot hit `GET /customers` (403); they reach customers only via the POS selector.
- **Lifetime spend** is included only for admin/accountant/auditor (not pharmacist), computed live from Module 4 sales. Purchase history + medication summary are always **live from `Sale`** (never duplicated).
- **Merge** (`POST /customers/merge`, admin/pharmacist) is transactional: reassigns `Sale.customerId` (a documented cross-module write for identity merge), consolidates prescriptions/notes/tags (de-duped) + health profile, and marks the loser `isMergedInto` (irreversible). Re-merging a merged record → 400.
- Consent flags (`consentHealthDataStorage`, `consentMarketingContact`) are **tracking-only** in this version (not yet enforcement).

`CustomerSelector` / search built in Module 8, **reused by Module 4's POS** (repointed to `/customers/search` + `/customers/quick-add`). Frontend: `frontend/src/pages/Customers/*` (list w/ tags + gated spend, tabbed detail where the **🔒 Health Info tab is absent — not disabled — for unauthorised roles and never fetches**, sectioned create/edit form, side-by-side Merge tool).

## Module 16: Users & Roles (RBAC) — the security foundation

Migration `20260709000000_users_roles_rbac` (additions only — **no reset**) adds `User` (linked to Supabase Auth by `authUserId`), `UserRoleAssignment`, `UserBranchAccess`, `UserPermissionOverride`, `LoginActivity`, `StepUpVerification` + enums `SystemRole`/`UserStatus`/`StepUpStatus`.

### How JWT claims are populated & refreshed (read this before debugging "my permission change didn't take effect")
Every module's `@Roles()` guard reads **lowercase role claims from the verified JWT** (`app_metadata`) — a fast, per-request, no-DB-hit check via the canonical `backend/src/common/guards/roles.guard.ts` (this stays the one true guard; Module 16 does **not** move it — that would be pure churn across 18 modules). Module 16 is **authoritative for what those claims should say**: on invite / role change / branch change / suspend / deactivate, `UsersService` computes the claims (`AuthorizationService.computeClaims`) and **pushes them to Supabase Auth `app_metadata`** via the admin API (`SupabaseAdminService`). `SystemRole` (UPPERCASE DB enum) ↔ `PharmacyRole` (lowercase claim) map in one place (`permission-matrix.config.ts`). **Staleness bound:** a user's *existing* access token keeps its old claims until it naturally expires (Supabase default ~1h); suspend/deactivate also **revokes the refresh token** immediately (so no new token can be minted) and syncs `status` into the claims — the `jwt-auth.guard` rejects `SUSPENDED`/`DEACTIVATED` on the next request that carries the updated status. `super_admin`/`admin` cannot be the last active admin (guarded).

- **`AuthorizationService`** (`@Global`) — the central RBAC engine. `getEffectivePermissions(userId)` resolves a user's real access as **role defaults ∪ per-user grants − per-user revokes** (spec §3), from the central **permission registry** (`config/permission-matrix.config.ts` — one source of truth: `{ key, label, module, description, allowedRoles }` across every module). `hasPermission()` delegates to it. Results are **cached per user (5-min TTL) and invalidated on any role/override change**, so the per-request guard stays DB-free on a cache hit. `super_admin` always resolves to the full set and is **immune to revokes** (never lock out the top account). `/users/me` returns the caller's resolved permission keys, powering the foundational **`useCurrentUser().can(key)`** hook.
- **Granular per-user permissions (beyond roles)** — roles remain the fast, sensible default; on top, an admin can **grant** a capability the role lacks or **revoke** one it includes. `UserPermissionOverride.effect` is `GRANT | REVOKE` (migration `20260713000000`, additive). Enforcement is a real guard, not just UI: **`@RequirePermission('key')` + `PermissionsGuard`** (`common/`) check the *effective* set (cached), wired into representative endpoints — POS finalize (`sales.sell`), sale void (`sales.void`), inventory valuation/summary (`inventory.valuation.view`) — so a granted cashier can open inventory valuation and a revoked cashier is blocked from the till (verified E2E). `@Roles()` stays the baseline gate elsewhere; the guard falls back to the claim-role→matrix check for non-DB tokens. Every grant/revoke/reset is audited (`PERMISSION_OVERRIDE_GRANTED`/`_REMOVED`, CRITICAL, with the effect + reason). Frontend: a **Permissions tab** on the user detail page — every registry permission grouped by module + searchable, each with a toggle and a badge showing **why** it's on/off (*from role* / *granted (override)* / *revoked (override)* / *not granted*) and a **↺ reset** to drop the override back to the role default. The role tab now spells out that stacking multiple roles is cumulative and that broad access should come from the `admin`/`super_admin` role, not several narrow roles.
- **Lifecycle**: invite (creates the Supabase auth user + app record `PENDING_ACTIVATION`, syncs claims), `login-event` (activates + records `LoginActivity`), update, assign/remove role (**can't remove the last role**), grant/revoke branch (**non-super-admin keeps ≥1**), suspend/reactivate/deactivate + revoke-sessions.
- **Step-up (re-auth)** — `POST /auth/step-up/request` then `/:id/verify`: the elevated user enters their OWN password; the backend verifies it against Supabase **and re-checks their actual current role server-side** (never a stale claim) before approving. Requests expire after `STEP_UP_WINDOW_MS` (default 2 min). The reusable **`StepUpAuthModal` + `stepUpApi`** (`features/users`) are built here for Module 4 (discount/prescription) and Module 6 (write-off) elevated flows.
- **Permission Matrix view** (`super_admin` only, 403 for everyone else incl. admin) — read-only grid of every permission × role, rendered from the static config.

Frontend: `frontend/src/pages/Users/*` (list w/ role + status badges + Invite modal, tabbed detail — Roles & Branches / Permission Overrides / Login Activity with suspend/reactivate/deactivate/revoke actions, Permission Matrix, My Profile). Nav gated to admin/super_admin.

## Module 15: Audit Logs — the system-wide trail (integration-completion)

Every module already called `AuditLogService.record()`; this module makes that destination real. Migration `20260710000000_audit_logs_module` **supersedes the Module 1 `AuditLog` stub** with a **data-preserving** migration (audit history must never be wiped — it RENAMEs `userId`→`performedBy`, relaxes `branchId`/`entityId` to nullable, adds `performedByName`/`severity`/`ipAddress`/`userAgent`/`recordHash`/`previousHash` + the 5 investigation indexes) plus `AuditRetentionPolicy` + `AuditIntegrityCheck` + `AuditSeverity` enum.

**Action-naming convention: `MODULE_ENTITY_VERB`** (e.g. `MEDICINE_PRICE_CHANGED`, `SALE_VOIDED`, `BATCH_RECALLED`). Every action across Modules 1–8 + 16 is registered in `modules/audit-logs/config/action-registry.ts` with a human-readable label + default severity (`ROUTINE`/`SENSITIVE`/`CRITICAL`) — the single place new modules register their actions. Unregistered actions are still recorded (never dropped) and flagged with a `?` in the UI.

**`record()` design** (`common/audit/audit-log.service.impl.ts`, behind the interface every module imports): (1) **fail-safe** — the whole write is try/caught, so an audit failure is logged to app monitoring but NEVER propagates to break the caller's business transaction (callers invoke it *after* their tx commits); (2) `performedByName` denormalized from Module 16's `User` (5-min in-memory cache — no per-write DB lookup for a busy cashier); (3) severity from the registry unless the caller overrides.

**Tamper-evidence — per-pharmacy HMAC hash-chain** (chosen approach, documented for compliance): each record's `recordHash = HMAC(AUDIT_HASH_SECRET, previousHash + canonical content)`. Any retroactive DB edit changes that row's content hash and breaks every subsequent link. Writes are serialized per-pharmacy with a `pg_advisory_xact_lock` so concurrent writes don't fork the chain. `POST /audit-logs/integrity-check/run` walks the chain (skipping legacy pre-chain rows) and records the result; the UI shows a green "hash-chain intact" / red "chain break detected" banner. **Retention:** `AuditRetentionPolicy` (default 24 months detailed) is schema-ready; **there is no update/delete endpoint anywhere for audit records — that absence is the safeguard** (a correction is a new event, never an edit).

Endpoints (base `/api/audit-logs`, admin/auditor for the global log): `GET /` (filter/paginate), `/entity?entityType=&entityId=` (**broader roles** — mirrors the host module's entity access, powers embedded trails), `/user/:userId`, `/sensitive`, `/export` (CSV, 1-year cap), `/controlled-substance-report`, `/action-registry`, `/integrity-status`, `POST /integrity-check/run`. **`cashier` is fully excluded.**

**`AuditTrailTab` + `useEntityAuditTrail`** (`features/audit-logs`) is the reusable component **now embedded in Module 2 (Medicine), 6 (Batch) and 7 (Supplier) detail pages** — the shared infra those modules assumed. `MetadataDetailView` renders the common `{ before, after }` / `{ changes }` shapes as a clean diff. Frontend pages: Global log (filters + integrity banner + CSV export), Sensitive Events feed, User Activity.

## Module 18: Settings & System Configuration — the central config store (integration-completion)

The one place business rules live. Migration `20260711000000_settings_module` **adds** (no reset — pure additions) `SettingDefinition` (the in-code registry mirrored to the DB), `SettingValue` (pharmacy/branch overrides) and `SettingChangeHistory`, plus `SettingValueType`/`SettingScope` enums. Modules that used to hardcode constants (or read `process.env`) now read live values through `SettingsService.get()`.

**Key-naming convention: `module.category.settingName`** (e.g. `sales.discount.autoApprovedPercent`, `purchases.approval.thresholdAmount`, `dashboard.alerts.expiryTiers`). Every setting is declared once in `modules/settings/registry/core-settings.registry.ts` with its `valueType`, `defaultValue`, `validationRule` and `scope` — that registry is the single source of truth and is idempotently upserted into `SettingDefinition` at boot. Add a setting there and it gets a validated API + a type-driven UI control with zero bespoke code.

**Resolution chain (most specific wins):** branch override (`SettingValue` with `branchId = X`) → pharmacy-wide (`branchId = NULL`) → `SettingDefinition.defaultValue` from the registry. `scope: BRANCH` settings may be overridden per branch; `scope: PHARMACY` settings reject a `branchId` (`NOT_BRANCH_SCOPED`). Reads are cached in-process (5-min safety TTL) with **precise invalidation** on every `set`/`reset`, so a changed rule takes effect on the very next request. If the DB is momentarily unreachable, `get()` falls back to the registry default rather than throwing into a caller's hot path.
> ⚠️ Resolution reads use `OR: [{ branchId }, { branchId: null }]`, **not** `branchId: { in: [..., null] }` — Prisma compiles `in: [null]` to SQL `IN (NULL)`, which matches no rows and would silently return the default for every override. (Caught by the E2E; the only place this pattern appears.)

**Validation** is per-`valueType` (NUMBER min/max, ENUM allowedValues, STRING maxLength, JSON shape) plus cross-field rules: paired thresholds (`lessThanOrEqualKey`, e.g. cost-variance *warn* ≤ *block*) and ascending expiry tiers (`red < orange < yellow`, the canonical set shared with Module 6 Batches). Every change is written to `SettingChangeHistory` **and** the Module 15 audit trail as a `SENSITIVE` `SETTING_CHANGED` event.

**Live wiring (verified E2E):** Module 4 Sales reads `sales.discount.autoApprovedPercent` / `sales.allowNegativeStock` / `sales.voidWindowDays`; Module 3 Purchases reads the approval/tolerance/variance/costing settings via `PurchaseConfigService`. Changing the discount threshold to 50% lets a cashier's 10%-discount sale complete on the *next* request with no restart — the headline acceptance test.

Endpoints (base `/api/settings`): `GET /` (grouped, resolved, sensitive values masked), `GET /definitions`, `GET /:key` (+ `?branchId=`), `GET /:key/history`, `PUT /:key`, `POST /:key/reset`. **Read:** admin/super_admin/auditor. **Write:** admin/super_admin; `inventory_manager` is narrowed to Purchases-category settings only. Frontend: `pages/Settings/SettingsPage.tsx` — categorized nav + global search, `SettingField` renders the right control purely from `valueType` (toggle / number / select / text / `ExpiryTiersEditor` / `StringArrayEditor`), with save-on-blur, per-setting reset (↺) and a change-history modal.

## Module 10: Sales Returns — post-sale reversals (picks up where Module 4's void ends)

A **return is a new, separate transaction** that references the original `Sale`/`SaleItem` but never mutates them — only `Sale.status` transitions (`COMPLETED → PARTIALLY_RETURNED → FULLY_RETURNED`) via Module 4's own narrow `SalesService.markReturnStatus()`, preserving the sale's immutable historical figures. Migration `20260712000000_sales_returns_module` is **additive** (no reset): `SalesReturn`, `SalesReturnItem`, `StoreCreditBalance`, `StoreCreditLedgerEntry` + `RefundMethod`/`ConditionAssessment`/`ReturnReasonCode` enums. Cross-module references into Modules 4/8 are loose (no FK) to keep ownership boundaries clean.

**Fully transactional `createReturn()`** (`SalesReturnsService`): (1) authoritative re-check of eligibility under a per-sale advisory lock (`pg_advisory_xact_lock`) so two cashiers can't both slip past the remaining-quantity guard; (2) create `SalesReturn`/`SalesReturnItem`; (3) restore stock **only for `RESALEABLE`** lines via Module 6's `BatchService.restoreReturnedStock()` (reason `SALES_RETURN`, back into the *original batch* when still sellable — else restored to aggregate stock and `flaggedForReview` per spec §21); (4) `NOT_RESALEABLE` lines still refund but route to a quarantine/`RETURN_ITEM_QUARANTINED` trail instead of restocking; (5) status sync; (6) refund (cash/card recorded as a reference; **store credit** adjusts `StoreCreditBalance` + an append-only ledger in the same transaction); (7) audit + events. Any failure rolls the whole thing back.

**Safety-critical hard-blocks (server-side, at both the eligibility check *and* the authoritative create-time re-check):** controlled substances are **never** returnable (in code, not a setting); prescription items and named categories are blocked per Settings. Refunds are always computed from the sale's **snapshotted** `unitPrice`/discount/tax (proportional for partials), never current pricing. Store credit is gated to registered customers (walk-ins get a clear message).

**Elevated approval** for prescription/clinical returns reuses Module 16's step-up: a cashier's return that needs sign-off carries an APPROVED `StepUpVerification` id (`actionType: RETURN_APPROVAL`), which the service verifies server-side (status/action/recency) before recording `approvedBy`; an elevated processor self-approves. All actions audit-logged (`RETURN_CREATED` sensitive, `RETURN_APPROVAL_GRANTED`, `NON_RETURNABLE_ITEM_REJECTED`, `STORE_CREDIT_ISSUED`, …) — the primary guard against return fraud.

**Cross-branch returns** are allowed: stock is credited to the *processing* branch (where the item is physically handed back), not the original purchasing branch. Settings (Module 18, `Returns` category): `returns.eligibilityWindowDays`, `returns.nonReturnableCategories`, `returns.allowPrescriptionItemReturns`, `returns.cashierCanProcessResaleable`, `returns.approvalRequiredReasons`.

Endpoints (base `/api/sales-returns`): `GET /eligibility/:saleId`, `POST /`, `GET /` (paginated; **cashier auto-scoped to own-processed**), `GET /:id`, `GET /:id/receipt`, `GET /reports/by-medicine`, `GET /reports/by-reason`; plus `GET /api/customers/:id/store-credit` (cashier: balance only). **inventory_manager has no access.** Frontend: `pages/SalesReturns/*` — a guided `ProcessReturnPage` (sale lookup → per-line eligibility with inline reasons → condition/reason/qty editor → refund method + live summary → step-up gate → printable receipt), list, detail (linked to the original sale), and return-rate reports; a **"Return Items"** action is also surfaced on the Module 4 Sale detail page.

> Building this module surfaced — and the E2E fixed — a latent Module 18 bug: `SettingsService.invalidate()` cleared only the `pharmacy:_:key` cache entry on a pharmacy-wide change, leaving stale **branch-scoped** fall-through entries. Every returns read passes a `branchId`, so overrides silently had no effect until the next TTL. `invalidate()` now clears all scopes of the key. (This is exactly the "use Module 10 to verify Module 18's integration-completion" check the spec called for.)

## Module 9: Purchase Returns — stock back to the supplier (mirror of Module 10)

The pharmacy-side counterpart to Sales Returns, flowing **out** to the supplier against Module 3's `GoodsReceipt` (never mutated). Migration `20260714000000_purchase_returns_module` is **additive**: `PurchaseReturn`, `PurchaseReturnItem` + `PurchaseReturnSettlementStatus`/`PurchaseReturnReasonCode` enums. Cross-module refs into Modules 3/6/7 are loose (no FK).

**Transactional `createReturn()`** (`PurchaseReturnsService`): advisory-locked authoritative re-check of remaining-returnable qty (received − already-returned per GRN line), create records, then remove stock via Module 6's new `BatchService.recordSupplierReturnOut()` — which decrements the specific batch (resolved from the GRN item's `batchNumber`) and records a Module 5 `PURCHASE_RETURN` ledger OUT. **No resaleable branching** (the goods leave the pharmacy either way). Two guards: over-return (> GRN remaining) and, per spec §21, `INSUFFICIENT_BATCH_STOCK` when the batch no longer holds the units (can't return goods already sold).

**Settlement is financial-only and never re-triggers stock** (spec §11): `PENDING → CREDITED / PARTIALLY_CREDITED / REJECTED`, capturing the supplier's actual credited amount + credit-note reference, with the expected-vs-actual variance surfaced (Module 3's variance spirit, applied to the return side). `PARTIALLY_CREDITED` must be < expected; `REJECTED` restores nothing (the stock has physically gone). Expected credit auto-computes as `unitCost × qty` but is **overridable** (real supplier near-expiry agreements differ). Recall-driven lines (`QUALITY_RECALL`) carry a loose `relatedRecallId` link to Module 6's `BatchRecall` and are audited `QUALITY_RECALL_RETURN_LINKED` (CRITICAL).

Endpoints (base `/api/purchase-returns`): `GET /returnable-items/:grnId`, `POST /`, `GET /` (paginated), `GET /:id`, `GET /:id/document`, `GET /pending`, `PUT /:id/settlement`. **Roles (spec §13):** initiate/manage = admin/inventory_manager; view = + accountant/auditor; **settle = admin/accountant only**; **cashier & pharmacist have no access.** Frontend: `pages/PurchaseReturns/*` — `InitiateReturnPage` (GRN lookup → returnable lines with qty capped at min(remaining, in-stock) → reason/note → editable expected credit → printable Return-to-Supplier doc), list, detail (linked GRN + settlement form for accountants), pending-settlement aging view. A **"Return to Supplier"** action is surfaced on the Module 6 batch detail page (pre-fills the source GRN + batch — the return-instead-of-write-off path). Verified E2E: 17/17 (stock decrement across Modules 5+6, over-return + insufficient-stock guards, settlement validation + variance, full RBAC).

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
- **Sales/POS**: the POS screen supports editable cart lines, walk-in/registered **customer** selection (Module 8 stub: `/api/customers` search + quick-add), per-line **and** cart-level **discounts** (%/fixed) with an approval step-up over the 5% cap, **split/multi payments** with live "remaining to pay", **prescription** verify + **controlled-substance** compliance gates (disable Finalize until satisfied), live **stock + FEFO batch** transparency per line (from `/cart/price-check`), quick-pick tiles, barcode auto-refocus, server-persisted **park/resume**, a printable **receipt** modal, and a session-close **variance** summary. Cart math is one shared util (`cartCalculations.ts`) mirrored by the backend so displayed and charged totals never drift. Still deferred: receipt **PDF** generation, Redis hot-path price cache, and true offline-first.
- Cross-module stub tables (`Sale`, `Medicine`, `MedicineBatch`, `PurchaseOrder`, `Expense`, `AuditLog`, `PharmacySettings`) will be superseded by their owning module's authoritative schema — reconcile via `prisma migrate` when each module is built.
