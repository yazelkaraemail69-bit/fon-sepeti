import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

interface PromptBuilderResponse {
  sector: string;
  details: string;
}

function buildPrompt(userInput: string): string {
  return `Sen bir yatırım danışmanı asistanısın. Kullanıcı yatırım hedefini doğal dille anlatıyor. Sen bunu yapılandırılmış bir prompt'a dönüştürmelisin.

Kullanıcının anlattığı hedef:
"""
${userInput}
"""

Görevin:
1. Kullanıcının hedefini analiz et
2. Çıkarım yapabileceğin bilgileri aşağıdaki alanlara doldur
3. SADECE aşağıdaki JSON formatında yanıt ver, ekstra metin yazma

Çıktı formatı:
{
  "sector": "Buraya kullanıcının bahsettiği sektör, fon türü veya yatırım alanını yaz. Örn: Teknoloji hisse fonları, Düşük riskli tahvil+bono fonları, Döviz bazlı fonlar, Karma fonlar...",
  "details": "Buraya kullanıcının hedefinden çıkardığın ek detayları yaz. Vade, risk toleransı, getiri beklentisi, aylık/TL miktar gibi bilgileri buraya ekle. Hiçbir şey çıkaramadıysan boş string bırak."
}

Örnekler:

Kullanıcı: "5 yıl vadeli, ayda 2000 TL biriktirebileceğim, orta riskli bir fon arıyorum. Teknoloji sektörüne yatırım yapmak istiyorum."
Yanıt: {"sector": "Teknoloji hisse fonları, orta risk", "details": "Vade: 5 yıl, aylık 2000 TL birikim, orta risk toleransı, teknoloji sektörü"}

Kullanıcı: "Emeklilik için düzenli gelir getirecek, düşük riskli fon lazım. Döviz bazlı olsun."
Yanıt: {"sector": "Düşük riskli döviz bazlı fonlar", "details": "Hedef: Emeklilik, düzenli gelir beklentisi, düşük risk, döviz bazlı"}

Kullanıcı: "Paramı altına yatırmak istiyorum ama kıymetli maden fonu mu yoksa altın fonu mu daha iyi bilmiyorum."
Yanıt: {"sector": "Altın ve kıymetli maden fonları", "details": "Kıymetli maden fonu ile altın fonu arasında kararsız, karşılaştırmalı öneri"}`;
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
    const userInput: string = body.input ?? "";

    if (!userInput || userInput.length < 5) {
      return NextResponse.json(
        { error: "Lütfen yatırım hedefinizi biraz daha detaylı anlatın (en az 5 karakter)." },
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
            content: buildPrompt(userInput),
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        {
          error: `AI servisi hatası (HTTP ${res.status}): ${txt.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: PromptBuilderResponse;
    try {
      parsed = JSON.parse(content) as PromptBuilderResponse;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as PromptBuilderResponse;
      } else {
        return NextResponse.json(
          { error: "AI yanıtı ayrıştırılamadı." },
          { status: 502 }
        );
      }
    }

    if (!parsed.sector || parsed.sector.length < 2) {
      return NextResponse.json(
        { error: "AI hedefinizi anlayamadı. Lütfen daha açık yazın." },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}