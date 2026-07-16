import { NextRequest, NextResponse } from "next/server";
import { fetchFundHistory } from "@/lib/tefas";
import { analyzePortfolio, computeMetrics } from "@/lib/analytics";
import { AnalysisResult, FundData } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const codes: string[] = (body.codes ?? [])
      .map((c: string) => c.trim().toUpperCase())
      .filter((c: string) => /^[A-Z0-9]{2,6}$/.test(c));
    const months: number = Math.min(Math.max(body.months ?? 12, 3), 36);
    const weights: number[] | undefined = body.weights;

    if (codes.length < 2) {
      return NextResponse.json(
        { error: "En az 2 geçerli fon kodu girin." },
        { status: 400 }
      );
    }
    if (codes.length > 25) {
      return NextResponse.json(
        { error: "En fazla 25 fon analiz edilebilir." },
        { status: 400 }
      );
    }

    // Fonları paralel çek, hataları topla
    const results = await Promise.allSettled(
      codes.map((c) => fetchFundHistory(c, months))
    );

    const funds: FundData[] = [];
    const errors: { code: string; message: string }[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") funds.push(r.value);
      else
        errors.push({
          code: codes[i],
          message: r.reason?.message ?? "Bilinmeyen hata",
        });
    });

    if (funds.length < 2) {
      return NextResponse.json(
        {
          error: "Analiz için en az 2 fonun verisi çekilebilmeli.",
          errors,
        },
        { status: 422 }
      );
    }

    const metrics = funds.map(computeMetrics);

    // Başarısız fonlar varsa ağırlıkları hizala
    let alignedWeights: number[] | undefined = undefined;
    if (weights && weights.length === codes.length) {
      const okCodes = new Set(funds.map((f) => f.code));
      const filtered = codes
        .map((c, i) => ({ c, w: weights[i] }))
        .filter((x) => okCodes.has(x.c));
      const sum = filtered.reduce((a, b) => a + b.w, 0);
      if (sum > 0) alignedWeights = filtered.map((x) => x.w / sum);
    }

    const { correlation, currentPortfolio, suggestions, redundantPairs } =
      analyzePortfolio(funds, alignedWeights);

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
