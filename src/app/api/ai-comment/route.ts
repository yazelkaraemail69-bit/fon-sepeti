import { NextRequest, NextResponse } from "next/server";
import { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-001";

function buildPrompt(r: AnalysisResult): string {
  const metrics = r.metrics
    .map(
      (m) =>
        `- ${m.code} (${m.title}): dönem getirisi %${m.totalReturn.toFixed(
          1
        )}, yıllık getiri %${m.annualizedReturn.toFixed(
          1
        )}, volatilite %${m.volatility.toFixed(1)}, Sharpe ${m.sharpe.toFixed(
          2
        )}, maks. düşüş %${m.maxDrawdown.toFixed(1)}`
    )
    .join("\n");

  const cur = r.currentPortfolio
    ? `Mevcut portföy (${r.currentPortfolio.codes.length} fon): beklenen yıllık getiri %${r.currentPortfolio.expectedReturn.toFixed(
        1
      )}, volatilite %${r.currentPortfolio.volatility.toFixed(
        1
      )}, Sharpe ${r.currentPortfolio.sharpe.toFixed(2)}`
    : "Mevcut portföy bilgisi yok.";

  const sugg = r.suggestions
    .map(
      (s, i) =>
        `Öneri ${i + 1} (${s.codes.length} fon): ${s.codes
          .map((c, j) => `${c} %${(s.weights[j] * 100).toFixed(0)}`)
          .join(", ")} | beklenen getiri %${s.expectedReturn.toFixed(
          1
        )}, volatilite %${s.volatility.toFixed(1)}, Sharpe ${s.sharpe.toFixed(2)}`
    )
    .join("\n");

  const redundant =
    r.redundantPairs.length > 0
      ? r.redundantPairs.map((p) => `- ${p.reason}`).join("\n")
      : "Yüksek korelasyonlu çift bulunamadı.";

  return `Sen deneyimli bir Türk portföy analistisin. Aşağıda bir yatırımcının TEFAS fon portföyünün sayısal analizi var. Bu verilere dayanarak Türkçe, samimi ama profesyonel bir değerlendirme yaz.

FON METRİKLERİ:
${metrics}

MEVCUT PORTFÖY:
${cur}

OPTİMİZASYON ÖNERİLERİ:
${sugg}

YÜKSEK KORELASYONLU FONLAR:
${redundant}

Değerlendirmende şunlara değin:
1. Portföyün genel durumu (güçlü/zayıf yönler)
2. Hangi fonlar portföyü taşıyor, hangileri yük oluyor
3. Fon sayısını azaltmanın avantajları ve önerilen sepetlerden hangisinin neden mantıklı olduğu
4. Risk-getiri dengesi hakkında pratik tavsiyeler
5. Dikkat edilmesi gereken noktalar

Kısa paragraflar ve maddeler kullan. En fazla 400 kelime. Sonuna "Bu bir yatırım tavsiyesi değildir." notu ekle. Markdown formatında yaz.`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const analysis = (await req.json()) as AnalysisResult;
    if (!analysis?.metrics?.length) {
      return NextResponse.json(
        { error: "Geçerli analiz verisi gönderilmedi." },
        { status: 400 }
      );
    }

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(analysis) }],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `AI servisi hatası (HTTP ${res.status}): ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const comment: string =
      data.choices?.[0]?.message?.content ?? "Yorum üretilemedi.";

    return NextResponse.json({ comment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
