/*
 * Demo seed (Modules 1 + 2).
 *
 * Populates the Medicines master catalog (lookups + medicines + barcodes +
 * price history) and the transactional stub tables (sales, purchase orders,
 * expenses, audit) so both the Dashboard and the Medicines module render live
 * data. Idempotent: wipes and re-inserts everything scoped to the demo pharmacy.
 *
 * Run: node prisma/seed.cjs   (or: npm run seed)
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHARMACY_ID = '9742c5a7-0977-4a8d-8438-d72e23a24c75';
const BRANCH_ID = 'fd67cdf4-8c4c-4229-87b9-7b7f93e189db';
const ADMIN_ID = '796d2b19-b1fe-487a-8fb8-34798d0f4667';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (d, hour = 12) => {
  const dt = new Date(now.getTime() - d * DAY);
  dt.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return dt;
};
const daysAhead = (d) => new Date(now.getTime() + d * DAY);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const UNITS = ['Box', 'Strip', 'Tablet', 'Capsule', 'Bottle', 'ml', 'Piece', 'Vial', 'Tube'];
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Device'];
const CATEGORIES = ['Analgesics', 'Antibiotics', 'Gastrointestinal', 'Respiratory', 'Vitamins & Supplements'];
const MANUFACTURERS = [
  ['GlaxoSmithKline', 'United Kingdom'],
  ['Abbott', 'United States'],
  ['Getz Pharma', 'Pakistan'],
  ['The Searle Company', 'Pakistan'],
  ['Martin Dow', 'Pakistan'],
];

// generic, brand, strength, dosageForm, category, manufacturer, base/purchase/sale units,
// cost, selling, mrp, stock, reorder, prescriptionRequired, barcode
const MEDICINES = [
  ['Paracetamol', 'Panadol', '500mg', 'Tablet', 'Analgesics', 'GlaxoSmithKline', ['Tablet', 'Box', 'Strip'], 14, 20, 22, 320, 50, false, '8964000101018'],
  ['Amoxicillin + Clavulanate', 'Augmentin', '625mg', 'Tablet', 'Antibiotics', 'GlaxoSmithKline', ['Tablet', 'Box', 'Strip'], 400, 550, 600, 8, 20, true, '8964000101025'],
  ['Ibuprofen', 'Brufen', '400mg', 'Tablet', 'Analgesics', 'Abbott', ['Tablet', 'Box', 'Strip'], 32, 45, 50, 0, 30, false, '8964000101032'],
  ['Paracetamol', 'Disprol', '120mg/5ml', 'Syrup', 'Analgesics', 'GlaxoSmithKline', ['ml', 'Box', 'Bottle'], 130, 180, 200, 140, 25, false, '8964000101049'],
  ['Omeprazole', 'Risek', '20mg', 'Capsule', 'Gastrointestinal', 'Getz Pharma', ['Capsule', 'Box', 'Strip'], 230, 320, 350, 15, 40, true, '8964000101056'],
  ['Mefenamic Acid', 'Ponstan Forte', '500mg', 'Tablet', 'Analgesics', 'Getz Pharma', ['Tablet', 'Box', 'Strip'], 62, 90, 100, 210, 30, false, '8964000101063'],
  ['Metronidazole', 'Flagyl', '400mg', 'Tablet', 'Antibiotics', 'The Searle Company', ['Tablet', 'Box', 'Strip'], 78, 110, 120, 0, 25, true, '8964000101070'],
  ['Paracetamol', 'Calpol', '120mg/5ml', 'Syrup', 'Analgesics', 'GlaxoSmithKline', ['ml', 'Box', 'Bottle'], 115, 160, 175, 12, 15, false, '8964000101087'],
  ['Salbutamol', 'Ventolin Inhaler', '100mcg', 'Inhaler', 'Respiratory', 'GlaxoSmithKline', ['Piece', 'Box', 'Piece'], 480, 650, 700, 85, 20, true, '8964000101094'],
  ['Amoxicillin', 'Amoxil', '500mg', 'Capsule', 'Antibiotics', 'GlaxoSmithKline', ['Capsule', 'Box', 'Strip'], 180, 250, 275, 190, 40, true, '8964000101100'],
  ['Nimesulide', 'Nims', '100mg', 'Tablet', 'Analgesics', 'The Searle Company', ['Tablet', 'Box', 'Strip'], 48, 70, 78, 60, 20, false, '8964000101117'],
  ['Multivitamin + Zinc', 'Surbex-Z', null, 'Tablet', 'Vitamins & Supplements', 'Abbott', ['Tablet', 'Box', 'Strip'], 300, 400, 430, 45, 15, false, '8964000101124'],
];

const PAYMENT_METHODS = ['CASH', 'CASH', 'CASH', 'CARD', 'CARD', 'MOBILE', 'WALLET'];

async function main() {
  console.log('Seeding demo data for pharmacy', PHARMACY_ID);

  // --- Clean (order matters: FKs) ------------------------------------------
  await prisma.sale.deleteMany({ where: { pharmacyId: PHARMACY_ID } }); // cascades items/payments/compliance
  await prisma.cashierSession.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.parkedSale.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.stockLedgerEntry.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.inventory.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.stockTransfer.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.stockReconciliation.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.medicineBatch.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.medicine.deleteMany({ where: { pharmacyId: PHARMACY_ID } }); // cascades barcodes/priceHistory/conversions
  await prisma.category.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.manufacturer.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.dosageForm.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.unit.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.purchaseOrder.deleteMany({ where: { pharmacyId: PHARMACY_ID } }); // cascades items/GRNs/payments
  await prisma.supplier.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.expense.deleteMany({ where: { pharmacyId: PHARMACY_ID } });
  await prisma.auditLog.deleteMany({ where: { pharmacyId: PHARMACY_ID } });

  // --- Settings: PKR + Pakistan timezone -----------------------------------
  await prisma.pharmacySettings.upsert({
    where: { pharmacyId: PHARMACY_ID },
    update: { currency: 'PKR', timezone: 'Asia/Karachi', expiryThresholdDays: 90 },
    create: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, currency: 'PKR', timezone: 'Asia/Karachi', expiryThresholdDays: 90 },
  });

  // --- Lookups -------------------------------------------------------------
  const unitMap = {};
  for (const name of UNITS) {
    const u = await prisma.unit.create({ data: { pharmacyId: PHARMACY_ID, name, symbol: name.slice(0, 3).toLowerCase() } });
    unitMap[name] = u.id;
  }
  const dosageMap = {};
  for (const name of DOSAGE_FORMS) {
    const d = await prisma.dosageForm.create({ data: { pharmacyId: PHARMACY_ID, name } });
    dosageMap[name] = d.id;
  }
  const categoryMap = {};
  for (const name of CATEGORIES) {
    const c = await prisma.category.create({ data: { pharmacyId: PHARMACY_ID, name } });
    categoryMap[name] = c.id;
  }
  const manufacturerMap = {};
  for (const [name, country] of MANUFACTURERS) {
    const mf = await prisma.manufacturer.create({ data: { pharmacyId: PHARMACY_ID, name, country } });
    manufacturerMap[name] = mf.id;
  }
  console.log('  lookups:', UNITS.length, 'units,', DOSAGE_FORMS.length, 'dosage forms,', CATEGORIES.length, 'categories,', MANUFACTURERS.length, 'manufacturers');

  // --- Medicines -----------------------------------------------------------
  const meds = [];
  let seq = 1;
  for (const [generic, brand, strength, dosage, category, manufacturer, units, cost, selling, mrp, stock, reorder, rx, barcode] of MEDICINES) {
    const [baseU, purchaseU, saleU] = units;
    const med = await prisma.medicine.create({
      data: {
        pharmacyId: PHARMACY_ID,
        branchId: BRANCH_ID,
        sku: `MED-${seq++}`,
        genericName: generic,
        brandName: brand,
        strength,
        dosageFormId: dosageMap[dosage],
        categoryId: categoryMap[category],
        manufacturerId: manufacturerMap[manufacturer],
        baseUnitId: unitMap[baseU],
        purchaseUnitId: unitMap[purchaseU],
        saleUnitId: unitMap[saleU],
        prescriptionRequired: rx,
        storageCondition: 'ROOM_TEMP',
        costPrice: cost,
        sellingPrice: selling,
        mrp,
        taxRatePercent: 0,
        reorderLevel: reorder,
        reorderQuantity: reorder * 2,
        currentStock: stock,
        status: 'ACTIVE',
        createdBy: ADMIN_ID,
        barcodes: { create: [{ pharmacyId: PHARMACY_ID, barcode, isPrimary: true }] },
        priceHistory: {
          create: [
            { pharmacyId: PHARMACY_ID, priceType: 'COST', oldValue: 0, newValue: cost, changedBy: ADMIN_ID, reason: 'Initial price' },
            { pharmacyId: PHARMACY_ID, priceType: 'SELLING', oldValue: 0, newValue: selling, changedBy: ADMIN_ID, reason: 'Initial price' },
          ],
        },
      },
    });
    meds.push({ id: med.id, price: selling, cost, stock });
  }
  console.log('  medicines:', meds.length);

  // --- Inventory backfill: aggregate row + OPENING_STOCK ledger (Module 5) --
  // currentStock === SUM(ledger) holds from the opening balance forward.
  for (const m of meds) {
    await prisma.inventory.create({ data: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, medicineId: m.id, batchId: null, currentStock: m.stock, lastMovementAt: daysAgo(30) } });
    await prisma.stockLedgerEntry.create({
      data: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, medicineId: m.id, direction: 'IN', quantity: m.stock, reasonCode: 'OPENING_STOCK', referenceModule: 'OPENING', referenceId: 'seed', unitCostAtTime: m.cost, balanceAfter: m.stock, performedBy: ADMIN_ID, notes: 'Opening stock' },
    });
  }
  console.log('  inventory rows + opening ledger:', meds.length);

  // --- Batches (expiry alerts) ---------------------------------------------
  const batchPlan = [[0, 12], [1, 22], [3, 8], [4, 55], [5, 78], [8, 40], [9, 120], [10, 150], [11, 400], [0, 500]];
  for (let i = 0; i < batchPlan.length; i++) {
    const [medIdx, days] = batchPlan[i];
    await prisma.medicineBatch.create({
      data: {
        pharmacyId: PHARMACY_ID,
        branchId: BRANCH_ID,
        medicineId: meds[medIdx].id,
        batchNumber: `B-2026${String(i + 1).padStart(3, '0')}`,
        quantity: randInt(20, 200),
        expiryDate: daysAhead(days),
      },
    });
  }
  console.log('  batches:', batchPlan.length);

  // --- Cashier session (historical, CLOSED) + Sales over last 30 days ------
  const session = await prisma.cashierSession.create({
    data: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, cashierId: ADMIN_ID, openingFloat: 5000, status: 'CLOSED', openedAt: daysAgo(30, 8), closedAt: daysAgo(0, 22), expectedCash: 0, actualCash: 0, variance: 0 },
  });
  let saleCount = 0;
  let itemCount = 0;
  let saleSeq = 1;
  for (let d = 30; d >= 0; d--) {
    const salesToday = d === 0 ? randInt(6, 10) : randInt(2, 6);
    for (let s = 0; s < salesToday; s++) {
      const lineCount = randInt(1, 4);
      const chosen = [];
      let grandTotal = 0;
      let totalCost = 0;
      const items = [];
      for (let l = 0; l < lineCount; l++) {
        const med = pick(meds);
        if (chosen.includes(med.id)) continue;
        chosen.push(med.id);
        const qty = randInt(1, 6);
        grandTotal += med.price * qty;
        totalCost += med.cost * qty;
        items.push({ medicineId: med.id, quantity: qty, unitPrice: med.price, unitCost: med.cost, lineTotal: med.price * qty });
      }
      if (!items.length) continue;
      const status = Math.random() < 0.04 ? 'VOIDED' : 'COMPLETED';
      await prisma.sale.create({
        data: {
          pharmacyId: PHARMACY_ID,
          branchId: BRANCH_ID,
          saleNumber: `SL-2026-${String(saleSeq++).padStart(6, '0')}`,
          cashierSessionId: session.id,
          cashierId: ADMIN_ID,
          saleDate: daysAgo(d, randInt(9, 21)),
          status,
          subTotal: grandTotal,
          grandTotal,
          totalCost,
          items: { create: items },
          payments: { create: [{ method: pick(PAYMENT_METHODS), amount: grandTotal, tenderedAmount: grandTotal }] },
        },
      });
      saleCount++;
      itemCount += items.length;
    }
  }
  console.log('  sales:', saleCount, '| sale items:', itemCount, '| 1 closed session');

  // --- Suppliers (stub for Module 7) ---------------------------------------
  const SUPPLIERS = [
    ['Muller & Phipps Pakistan', 30],
    ['United Distributors Ltd', 45],
    ['Pharma Traders', 15],
  ];
  const supplierIds = [];
  for (const [name, terms] of SUPPLIERS) {
    const s = await prisma.supplier.create({ data: { pharmacyId: PHARMACY_ID, name, contactPerson: 'Sales Desk', phone: '021-1234567', paymentTermsDays: terms } });
    supplierIds.push(s.id);
  }
  console.log('  suppliers:', supplierIds.length);

  // --- Purchase orders (Module 3 lifecycle) --------------------------------
  // status, orderAgoDays, paymentStatus, paidFraction, dueAgoDays (+past/overdue, -future, null=none)
  const poPlan = [
    ['DRAFT', 1, 'UNPAID', 0, null],
    ['PENDING_APPROVAL', 2, 'UNPAID', 0, null],
    ['APPROVED', 4, 'UNPAID', 0, -10],
    ['PARTIALLY_RECEIVED', 8, 'PARTIALLY_PAID', 0.3, 6],
    ['RECEIVED', 12, 'PAID', 1, -5],
    ['RECEIVED', 20, 'UNPAID', 0, 4],
  ];
  let poNum = 1;
  for (const [status, ago, paymentStatus, paidFraction, dueAgo] of poPlan) {
    const chosen = new Set();
    const lineMeds = [];
    while (lineMeds.length < randInt(2, 4)) {
      const m = pick(meds);
      if (!chosen.has(m.id)) { chosen.add(m.id); lineMeds.push(m); }
    }
    const received = status === 'RECEIVED';
    const partial = status === 'PARTIALLY_RECEIVED';
    const items = lineMeds.map((m) => {
      const qty = randInt(20, 100);
      const rq = received ? qty : partial ? Math.floor(qty * 0.6) : 0;
      return { medicineId: m.id, orderedQuantity: qty, receivedQuantity: rq, expectedUnitCost: m.cost, lineTotal: qty * m.cost };
    });
    const grandTotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const orderDate = daysAgo(ago);
    const approved = !['DRAFT', 'PENDING_APPROVAL'].includes(status);
    await prisma.purchaseOrder.create({
      data: {
        pharmacyId: PHARMACY_ID,
        branchId: BRANCH_ID,
        poNumber: `PO-2026-${String(poNum++).padStart(6, '0')}`,
        supplierId: pick(supplierIds),
        status,
        paymentStatus,
        orderDate,
        createdBy: ADMIN_ID,
        approvedBy: approved ? ADMIN_ID : null,
        approvedAt: approved ? orderDate : null,
        subTotal: grandTotal,
        grandTotal,
        amountPaid: Math.round(grandTotal * paidFraction * 100) / 100,
        dueDate: dueAgo === null ? null : new Date(now.getTime() - dueAgo * DAY),
        items: { create: items },
      },
    });
  }
  console.log('  purchase orders:', poPlan.length);

  // --- Expenses ------------------------------------------------------------
  const expensePlan = [['Rent', 120000, 18], ['Utilities', 35000, 14], ['Salaries', 250000, 10], ['Supplies', 18500, 6], ['Miscellaneous', 9200, 2]];
  for (const [category, amount, ago] of expensePlan) {
    await prisma.expense.create({ data: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, amount, category, expenseDate: daysAgo(ago) } });
  }
  console.log('  expenses:', expensePlan.length);

  // --- Audit events (activity feed) ----------------------------------------
  const activityPlan = [
    ['MEDICINE_CREATED', 'MEDICINE', 0], ['SALE_CREATED', 'SALE', 0], ['PURCHASE_RECEIVED', 'PURCHASE', 0],
    ['STOCK_ADJUSTED', 'STOCK_ADJUSTMENT', 1], ['MEDICINE_PRICE_CHANGED', 'MEDICINE', 1], ['RETURN_PROCESSED', 'RETURN', 1],
    ['SALE_CREATED', 'SALE', 2], ['USER_ADDED', 'USER', 2], ['EXPENSE_RECORDED', 'EXPENSE', 3],
    ['PURCHASE_CREATED', 'PURCHASE', 3], ['STOCK_ADJUSTED', 'STOCK_ADJUSTMENT', 4], ['SALE_CREATED', 'SALE', 4],
    ['MEDICINE_UPDATED', 'MEDICINE', 5], ['SALE_CREATED', 'SALE', 5], ['SUPPLIER_ADDED', 'SUPPLIER', 6],
  ];
  for (let i = 0; i < activityPlan.length; i++) {
    const [action, entityType, ago] = activityPlan[i];
    await prisma.auditLog.create({
      data: { pharmacyId: PHARMACY_ID, branchId: BRANCH_ID, userId: ADMIN_ID, action, entityType, entityId: `seed-${i}`, createdAt: daysAgo(ago, randInt(8, 20)), metadata: { source: 'seed' } },
    });
  }
  console.log('  activity events:', activityPlan.length);

  console.log('Seed complete ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
