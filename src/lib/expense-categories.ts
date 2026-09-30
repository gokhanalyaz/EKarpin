/**
 * Vardiya kapatirken secilebilen sabit gider kategorileri. Arac sahibi,
 * her arac icin bunlardan hangilerinin soforun karsisina cikacagini
 * (vehicles.enabled_expense_categories) belirleyebilir.
 */
export type ExpenseCategoryKey =
  | 'oto_yikama'
  | 'durak_aidati'
  | 'hgs_otoyol'
  | 'tamir_bakim'
  | 'diger';

export type ExpenseCategoryDef = {
  key: ExpenseCategoryKey;
  label: string;
  /** Bu kategoride serbest metin aciklama da alinir mi? */
  hasNote?: boolean;
};

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { key: 'oto_yikama', label: 'Oto Yıkama' },
  { key: 'durak_aidati', label: 'Durak Aidatı' },
  { key: 'hgs_otoyol', label: 'HGS / Otoyol' },
  { key: 'tamir_bakim', label: 'Tamir ve Küçük Bakım' },
  { key: 'diger', label: 'Diğer', hasNote: true },
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryKey[] = EXPENSE_CATEGORIES.map((c) => c.key);

export type ExpenseItem = {
  category: ExpenseCategoryKey;
  amount: number;
  note?: string;
};

export function expenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function sumExpenseItems(items: ExpenseItem[] | null | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}
