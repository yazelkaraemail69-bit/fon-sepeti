import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash";

interface FundSuggestion {
  code: string;
  name: string;
  category: string;
  reason: string;
  availabilityScore: number; // 0-100
}

interface FundFinderResponse {
  suggestions: FundSuggestion[];
  summary: string;
  disclaimer: string;
}

function buildPrompt(sector: string, details: string): string {
  return `Sen Türkiye'deki TEFAS yatırım fonları konusunda uzman bir finansal danışmansın. Kullanıcının belirlediği sektör/özelliklere göre en uygun fonları öneriyorsun.

Kullanıcının talebi:
- Sektör/Özellik: ${sector}
- Ek detaylar: ${details}

Görevin:
1. Bu kriterlere en uygun 5-8 TEFAS fon kodunu ve ismini öner.
2. Her fon için kısa bir neden (neden bu fon uygun) yaz.
3. Her fon için bir "Alınabilirlik Yüzdesi" (0-100 arası) hesapla. Bu puan şu kriterlere göre olsun:
   - Fonun sektörle uyumu (en önemli)
   - Fon büyüklüğü ve likiditesi (bildiğin kadarıyla)
   - Risk profili uyumu
   - Getiri potansiyeli
4. Kısa bir özet geç.

Kesinlikle sadece gerçek TEFAS fon kodlarını kullan (örn: TTE, AFA, MAC, YAS, IPB, HSA, BGP, TGE, IIH, IIJ, TKF, BKT, EAS, ATA, BGA, HAN, IHE, IIO, IIR, ISY, KAT, MUA, OZN, PPN, RON, SBN, TCA, TGE, TRB, TTV, TTY, TYZ, VKF, YAS, YDH gibi).

YANITINI SADECE JSON OLARAK VER, ekstra metin yazma. Şu formatı kullan:
{
  "suggestions": [
    {
      "code": "FON_KODU",
      "name": "Fon Adı",
      "category": "Fon Kategorisi (Hisse/Para Piyasası/Döviz/Altın/Karma/Değişken)",
      "reason": "Bu fonun neden uygun olduğu",
      "availabilityScore": 85
    }
  ],
  "summary": "Kısa bir değerlendirme özeti (2-3 cümle)",
  "disclaimer": "Bu bir yatırım tavsiyesi değildir."
}`;
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

    const body = await req.json();
    const sector: string = body.sector ?? "";
    const details: string = body.details ?? "";

    if (!sector || sector.length < 2) {
      return NextResponse.json(
        { error: "Lütfen bir sektör veya özellik belirtin." },
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
        messages: [
          {
            role: "user",
            content: buildPrompt(sector, details),
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        {
          error: `AI servisi hatası (HTTP ${res.status}): ${txt.slice(
            0,
            200
          )}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content: string =
      data.choices?.[0]?.message?.content ?? "{}";

    let parsed: FundFinderResponse;
    try {
      parsed = JSON.parse(content) as FundFinderResponse;
    } catch {
      // JSON parse hatası -> içinden JSON çıkarmayı dene
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as FundFinderResponse;
      } else {
        return NextResponse.json(
          { error: "AI yanıtı ayrıştırılamadı." },
          { status: 502 }
        );
      }
    }

    if (!parsed.suggestions || parsed.suggestions.length === 0) {
      return NextResponse.json(
        { error: "AI uygun fon bulamadı. Farklı kriterler deneyin." },
        { status: 404 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}