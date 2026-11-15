import { headerKey, parseCsv } from "@/lib/csv";

/** Product list import in the browser (CSV or XLSX); nothing is uploaded until the draft is saved. */

export type ImportedProduct = { name: string; brand: string; articleNo: string; description: string };
export type ProductImport = { products: ImportedProduct[]; skipped: number } | { error: "unreadable" | "noNameColumn" };

const ALIASES: Record<keyof ImportedProduct, string[]> = {
  name: ["product", "produkt", "name", "productname", "produktname", "bezeichnung", "produktbezeichnung", "artikel"],
  brand: ["brand", "marke", "handelsmarke"],
  articleNo: ["articleno", "articlenumber", "artikelnr", "artikelnummer", "itemno", "sku", "ean", "gtin"],
  description: ["description", "beschreibung", "details"],
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function fromTable(table: unknown[][]): ProductImport {
  const [header, ...rows] = table;
  if (!header) return { error: "unreadable" };
  const keys = header.map((h) => headerKey(cellText(h)));
  const index = Object.fromEntries(
    (Object.keys(ALIASES) as (keyof ImportedProduct)[]).map((field) => [field, keys.findIndex((k) => ALIASES[field].includes(k))]),
  ) as Record<keyof ImportedProduct, number>;
  if (index.name < 0) return { error: "noNameColumn" };
  const get = (row: unknown[], field: keyof ImportedProduct, max: number) =>
    index[field] < 0 ? "" : cellText(row[index[field]]).slice(0, max);

  const products: ImportedProduct[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (row.every((c) => cellText(c) === "")) continue;
    const name = get(row, "name", 300);
    if (!name) {
      skipped++;
      continue;
    }
    products.push({ name, brand: get(row, "brand", 120), articleNo: get(row, "articleNo", 80), description: get(row, "description", 500) });
  }
  return { products, skipped };
}

export async function importProducts(file: File): Promise<ProductImport> {
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const { readSheet } = await import("read-excel-file/browser");
      return fromTable(await readSheet(file));
    }
    return fromTable(parseCsv(await file.text()));
  } catch {
    return { error: "unreadable" };
  }
}
