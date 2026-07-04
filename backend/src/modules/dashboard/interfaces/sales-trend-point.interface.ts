/** `profit` is omitted entirely for roles without profit visibility (cashier, inventory_manager access is blocked earlier). */
export interface SalesTrendPoint {
  date: string;
  revenue: number;
  profit?: number;
}

export interface TopSellingItem {
  medicineId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}
