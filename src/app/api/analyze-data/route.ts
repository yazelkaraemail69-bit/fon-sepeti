// CSV verisi veya URL'den çekilen veriyle analiz yapar (canlı TEFAS'a alternatif)
import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { analyzePortfolio, computeMetrics } from "@/lib/analytics";
import { AnalysisResult, FundData } from "@/lib/types";

export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fetchUrl(url: string): Promise<string> {
  const u = new URL(url); // geçersizse throw
  if (!/^https?:$/.test(u.protocol)) {
    throw new Error("Sadece http/https URL'leri desteklenir.");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,application/json,text/plain,*/*" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`URL'den veri alınamadı: HTTP ${res.status}`);
  return res.text();
}

/** JSON dizisini (ör. [{date, code, price}]) FundData'ya çevirmeyi dener */
function tryParseJson(text: string): FundData[] | null {
  try {
    const json = JSON.parse(text);
    const arr: unknown[] = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
      ? json.data
      : [];
    if (arr.length < 30) return null;

    const map = new Map<string, FundData>();
    for (const raw of arr) {
      const item = raw as Record<string, unknown>;
      const date = String(item.date ?? item.tarih ?? item.TARIH ?? "").slice(0, 10);
      const price = Number(item.price ?? item.fiyat ?? item.FIYAT);
      const code = String(
        item.code ?? item.kod ?? item.FONKODU ?? "FON"
      ).toUpperCase();
      if (!date || !Number.isFinite(price) || price <= 0) continue;
      if (!map.has(code)) map.set(code, { code, title: code, prices: [] });
      map.get(code)!.prices.push({ date, price });
    }
    const funds = Array.from(map.values())
      .map((f) => ({
        ...f,
        prices: f.prices.sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .filter((f) => f.prices.length >= 30);
    return funds.length > 0 ? funds : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const csvTexts: string[] = body.csvTexts ?? (body.csvText ? [body.csvText] : []);
    const urls: string[] = body.urls ?? (body.url ? [body.url] : []);

    const allFunds: FundData[] = [];
    const errors: { code: string; message: string }[] = [];

    // CSV içerikleri
    for (let i = 0; i < csvTexts.length; i++) {
      try {
        allFunds.push(...parseCsv(csvTexts[i]));
      } catch (e) {
        errors.push({
          code: `CSV-${i + 1}`,
          message: e instanceof Error ? e.message : "Ayrıştırma hatası",
        });
      }
    }

    // URL'ler
    for (const url of urls) {
      try {
        const text = await fetchUrl(url);
        const jsonFunds = tryParseJson(text);
        if (jsonFunds) {
          allFunds.push(...jsonFunds);
        } else {
          allFunds.push(...parseCsv(text));
        }
      } catch (e) {
        errors.push({
          code: url.slice(0, 50),
          message: e instanceof Error ? e.message : "URL hatası",
        });
      }
    }

    // Aynı kodlu fonları birleştir (tekrarları at)
    const merged = new Map<string, FundData>();
    for (const f of allFunds) {
      if (!merged.has(f.code)) {
        merged.set(f.code, f);
      } else {
        const existing = merged.get(f.code)!;
        const dateSet = new Map(existing.prices.map((p) => [p.date, p]));
        for (const p of f.prices) dateSet.set(p.date, p);
        existing.prices = Array.from(dateSet.values()).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      }
    }
    const funds = Array.from(merged.values());

    if (funds.length < 2) {
      return NextResponse.json(
        {
          error:
            "Analiz için en az 2 fonun verisi gerekli. CSV/URL içeriğini kontrol edin.",
          errors,
        },
        { status: 422 }
      );
    }

    const metrics = funds.map(computeMetrics);
    const { correlation, currentPortfolio, suggestions, redundantPairs } =
      analyzePortfolio(funds);

    const result: AnalysisResult = {
      metrics,
      correlation,
      currentPortfolio,
      suggestions,
      redundantPairs,
      errors,
    };

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
