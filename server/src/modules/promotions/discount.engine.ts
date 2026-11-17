// Works out discounts for a cart (requirements 4.4). Pure: no database, so it is easy to test.
//
// The rules (business decisions, see the gap analysis):
//  1. Automatic promotions (product, category, seasonal) lower item prices. If several apply to
//     one item, the customer gets the biggest one. They never add up on the same item.
//  2. A discount code applies only to items that are NOT already discounted ("codes don't apply
//     to sale items"). Its minimum order is checked against the items total after automatic discounts.
//  3. All discounts are whole rupees, recorded per item, so refunds and reports stay exact.

export interface PricingLine {
  variantId: string;
  productId: string;
  categoryId: string;
  unitPrice: number;
  qty: number;
}

export interface PromotionRule {
  id: string;
  name: string;
  discountType: 'percent' | 'fixed';
  value: number;
  products: string[]; // both empty = whole store
  categories: string[];
  maxDiscount?: number; // percent codes
  minOrderTotal?: number; // codes
}

export interface PricedLine {
  variantId: string;
  gross: number; // unitPrice x qty
  discount: number;
  lineTotal: number; // gross - discount
  promotionId?: string;
  promotionName?: string;
}

export interface CodeResult {
  applied: boolean;
  promotionId: string;
  name: string;
  discount: number;
  message?: string; // why it did not apply
}

export interface PricedCart {
  lines: PricedLine[];
  itemsTotal: number; // before any discount
  discountTotal: number;
  subtotal: number; // after discounts (what the customer pays for items)
  code?: CodeResult;
}

export function inScope(rule: PromotionRule, line: PricingLine): boolean {
  if (rule.products.length === 0 && rule.categories.length === 0) return true;
  return rule.products.includes(line.productId) || rule.categories.includes(line.categoryId);
}

// An automatic promotion on one line: percent of the line, or rupees off each unit (never below 0)
export function automaticDiscount(rule: PromotionRule, line: PricingLine): number {
  if (rule.discountType === 'percent') return Math.round((line.unitPrice * line.qty * rule.value) / 100);
  return Math.min(rule.value, line.unitPrice) * line.qty;
}

// Splits a code discount over the eligible lines in proportion to their value (whole rupees;
// the rounding remainder goes to the biggest line so the parts always add up exactly)
function split(amount: number, lines: PricedLine[]): number[] {
  const total = lines.reduce((s, l) => s + l.gross, 0);
  const parts = lines.map((l) => Math.floor((amount * l.gross) / total));
  const remainder = amount - parts.reduce((s, p) => s + p, 0);
  let biggest = 0;
  lines.forEach((l, i) => {
    if (l.gross > lines[biggest]!.gross) biggest = i;
  });
  parts[biggest]! += remainder;
  return parts;
}

export function priceCart(input: PricingLine[], automatic: PromotionRule[], code?: PromotionRule): PricedCart {
  // 1. Automatic promotions: the best one per line
  const lines: PricedLine[] = input.map((line) => {
    const gross = line.unitPrice * line.qty;
    let best: { rule: PromotionRule; amount: number } | undefined;
    for (const rule of automatic) {
      if (!inScope(rule, line)) continue;
      const amount = Math.min(automaticDiscount(rule, line), gross);
      if (amount > 0 && (!best || amount > best.amount)) best = { rule, amount };
    }
    return {
      variantId: line.variantId,
      gross,
      discount: best?.amount ?? 0,
      lineTotal: gross - (best?.amount ?? 0),
      promotionId: best?.rule.id,
      promotionName: best?.rule.name,
    };
  });

  // 2. The discount code, on items that are not already discounted
  let codeResult: CodeResult | undefined;
  if (code) {
    const fail = (message: string): CodeResult => ({ applied: false, promotionId: code.id, name: code.name, discount: 0, message });
    const afterAutomatic = lines.reduce((s, l) => s + l.lineTotal, 0);
    const eligible = lines.filter((l, i) => l.discount === 0 && inScope(code, input[i]!));

    if (code.minOrderTotal && afterAutomatic < code.minOrderTotal) {
      codeResult = fail(`Add Rs ${code.minOrderTotal - afterAutomatic} more to use this code (minimum order Rs ${code.minOrderTotal})`);
    } else if (eligible.length === 0) {
      const anyInScope = input.some((l) => inScope(code, l));
      codeResult = fail(anyInScope ? 'This code cannot be used on items that are already on sale' : 'This code does not apply to the items in your cart');
    } else {
      const eligibleTotal = eligible.reduce((s, l) => s + l.gross, 0);
      let amount =
        code.discountType === 'percent' ? Math.round((eligibleTotal * code.value) / 100) : Math.min(code.value, eligibleTotal);
      if (code.maxDiscount !== undefined) amount = Math.min(amount, code.maxDiscount);

      split(amount, eligible).forEach((part, i) => {
        const line = eligible[i]!;
        line.discount = part;
        line.lineTotal = line.gross - part;
        line.promotionId = code.id;
        line.promotionName = code.name;
      });
      codeResult = { applied: true, promotionId: code.id, name: code.name, discount: amount };
    }
  }

  const itemsTotal = lines.reduce((s, l) => s + l.gross, 0);
  const discountTotal = lines.reduce((s, l) => s + l.discount, 0);
  return { lines, itemsTotal, discountTotal, subtotal: itemsTotal - discountTotal, code: codeResult };
}