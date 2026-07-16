// TEFAS'tan fon fiyat geçmişi çekme
// TEFAS resmi API'si: https://www.tefas.gov.tr/api/DB/BindHistoryInfo

import { FundData, FundPrice } from "./types";

const TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

interface TefasRow {
  TARIH: string; // epoch ms (string)
  FONKODU: string;
  FONUNVAN: string;
  FIYAT: number;
}

interface TefasResponse {
  data: TefasRow[];
}

function fmtDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

async function fetchChunk(
  code: string,
  start: Date,
  end: Date
): Promise<TefasRow[]> {
  const body = new URLSearchParams({
    fontip: "YAT",
    fonkod: code.toUpperCase(),
    bastarih: fmtDate(start),
    bittarih: fmtDate(end),
  });

  const res = await fetch(TEFAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Origin: "https://www.tefas.gov.tr",
      Referer: "https://www.tefas.gov.tr/TarihselVeriler.aspx",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`TEFAS isteği başarısız: HTTP ${res.status}`);
  }

  const json = (await res.json()) as TefasResponse;
  return json.data ?? [];
}

/**
 * Belirtilen fon kodu için son `months` aylık fiyat geçmişini çeker.
 * TEFAS tek istekte ~3 aylık veri verdiği için parça parça çekilir.
 */
export async function fetchFundHistory(
  code: string,
  months = 12
): Promise<FundData> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);

  // 80 günlük parçalara böl (TEFAS limiti ~90 gün)
  const chunks: { s: Date; e: Date }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 80);
    chunks.push({ s: new Date(cursor), e: chunkEnd > end ? new Date(end) : chunkEnd });
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  const results = await Promise.all(chunks.map((c) => fetchChunk(code, c.s, c.e)));
  const rows = results.flat();

  if (rows.length === 0) {
    throw new Error(`'${code}' için veri bulunamadı. Fon kodunu kontrol edin.`);
  }

  const map = new Map<string, FundPrice>();
  let title = code.toUpperCase();
  for (const r of rows) {
    // TEFAS epoch'u "/Date(1700000000000)/" formatında döndürür
    const epoch = Number(String(r.TARIH).replace(/[^0-9-]/g, ""));
    if (!Number.isFinite(epoch) || !r.FIYAT || r.FIYAT <= 0) continue;
    const d = isoDate(epoch);
    map.set(d, { date: d, price: r.FIYAT });
    if (r.FONUNVAN) title = r.FONUNVAN;
  }

  const prices = Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (prices.length < 30) {
    throw new Error(
      `'${code}' için yeterli veri yok (${prices.length} gün). En az 30 gün gerekli.`
    );
  }

  return { code: code.toUpperCase(), title, prices };
}
