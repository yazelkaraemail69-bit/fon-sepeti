// CSV / TEFAS Excel dışa aktarım dosyalarını ayrıştırma
// Desteklenen formatlar:
// 1) TEFAS "Tarihsel Veriler" dışa aktarımı: Tarih;Fon Kodu;Fon Adı;Fiyat;...
// 2) Genel format: tarih,kod,fiyat  veya  tarih;kod;fiyat
// 3) Tek fonluk: tarih,fiyat (fon kodu dosya adından/parametreden)

import { FundData, FundPrice } from "./types";

function parseTrNumber(s: string): number {
  // "1.234,567890" -> 1234.567890 | "0.123456" -> 0.123456
  const t = s.trim();
  if (!t) return NaN;
  if (t.includes(",")) {
    return parseFloat(t.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(t);
}

function parseDate(s: string): string | null {
  const t = s.trim();
  // DD.MM.YYYY veya DD/MM/YYYY
  let m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

/**
 * CSV metnini ayrıştırıp fon verilerine dönüştürür.
 * Birden fazla fon içerebilir (kod sütunu varsa).
 */
export function parseCsv(text: string): FundData[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("CSV dosyası boş veya çok kısa.");

  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";

  const header = lines[0].split(delimiter).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/"/g, "")
      .replace(/i̇/g, "i")
  );

  // Sütun indekslerini bul
  const dateIdx = header.findIndex((h) =>
    /tarih|date/.test(h)
  );
  const codeIdx = header.findIndex((h) =>
    /fon\s*kodu|kod|code|symbol/.test(h)
  );
  const priceIdx = header.findIndex((h) =>
    /fiyat|price|birim\s*pay/.test(h)
  );
  const titleIdx = header.findIndex((h) => /fon\s*ad|unvan|title|name/.test(h));

  const hasHeader = dateIdx !== -1 || priceIdx !== -1;
  const startLine = hasHeader ? 1 : 0;

  const dIdx = dateIdx !== -1 ? dateIdx : 0;
  const cIdx = codeIdx;
  const pIdx =
    priceIdx !== -1 ? priceIdx : cIdx !== -1 ? (cIdx === 1 ? 2 : 1) : 1;

  const fundMap = new Map<string, { title: string; prices: Map<string, FundPrice> }>();

  for (let i = startLine; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/"/g, "").trim());
    if (cols.length < 2) continue;

    const date = parseDate(cols[dIdx] ?? "");
    if (!date) continue;

    const price = parseTrNumber(cols[pIdx] ?? "");
    if (!Number.isFinite(price) || price <= 0) continue;

    const code =
      cIdx !== -1 && cols[cIdx] ? cols[cIdx].toUpperCase() : "FON";
    const title =
      titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : code;

    if (!fundMap.has(code)) {
      fundMap.set(code, { title, prices: new Map() });
    }
    fundMap.get(code)!.prices.set(date, { date, price });
  }

  const funds: FundData[] = [];
  for (const [code, v] of fundMap) {
    const prices = Array.from(v.prices.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    if (prices.length >= 30) {
      funds.push({ code, title: v.title, prices });
    }
  }

  if (funds.length === 0) {
    throw new Error(
      "CSV'den geçerli fon verisi çıkarılamadı. Format: Tarih;Fon Kodu;Fon Adı;Fiyat (TEFAS dışa aktarımı) veya tarih,kod,fiyat. Her fon için en az 30 günlük veri gerekli."
    );
  }

  return funds;
}
