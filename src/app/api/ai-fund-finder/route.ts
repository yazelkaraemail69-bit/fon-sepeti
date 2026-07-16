import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

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

/** Gerçek TEFAS'ta bulunan yaygın fon kodları ve kategorileri */
const TEFAS_FUNDS = [
  { code: "AFA", name: "Ak Portfolio Foreign Equities Fund", category: "Hisse" },
  { code: "ATA", name: "ATA Yatırım Fonu", category: "Karma" },
  { code: "BGA", name: "BGP Para Piyasası Fonu", category: "Para Piyasası" },
  { code: "BGP", name: "BGP Hisse Senedi Fonu", category: "Hisse" },
  { code: "BKT", name: "Birikim Katılım Fonu", category: "Katılım" },
  { code: "EAS", name: "East Capital Fonu", category: "Hisse" },
  { code: "HAN", name: "Halk Yatırım Fonu", category: "Karma" },
  { code: "HSA", name: "HSBC Portföy Yönetimi Fonu", category: "Karma" },
  { code: "IHE", name: "İş Portföy Hisse Senedi Fonu", category: "Hisse" },
  { code: "IIH", name: "İş Portföy IIH Fonu", category: "Değişken" },
  { code: "IIJ", name: "İş Portföy IIJ Fonu", category: "Değişken" },
  { code: "IIO", name: "İş Portföy IIO Fonu", category: "Değişken" },
  { code: "IIR", name: "İş Portföy IIR Fonu", category: "Değişken" },
  { code: "IPB", name: "İş Portföy Borçlanma Araçları Fonu", category: "Tahvil" },
  { code: "ISY", name: "İş Portföy Yabancı Fon", category: "Döviz" },
  { code: "KAT", name: "Katılım Portföy Fonu", category: "Katılım" },
  { code: "MAC", name: "Macquarie Türkiye Fonu", category: "Hisse" },
  { code: "MUA", name: "MUA Portföy Fonu", category: "Karma" },
  { code: "OZN", name: "Oyak Portföy Fonu", category: "Karma" },
  { code: "PPN", name: "Para Piyasası Fonu", category: "Para Piyasası" },
  { code: "RON", name: "RON Portföy Fonu", category: "Değişken" },
  { code: "SBN", name: "SBN Portföy Fonu", category: "Karma" },
  { code: "TCA", name: "TCA Portföy Fonu", category: "Karma" },
  { code: "TGE", name: "TGE Emtia Fonu", category: "Emtia" },
  { code: "TKF", name: "Türkiye Kira Sertifikaları Fonu", category: "Kira Sertifikası" },
  { code: "TRB", name: "TRB Portföy Fonu", category: "Değişken" },
  { code: "TTE", name: "TTE Teknoloji Fonu", category: "Hisse" },
  { code: "TTV", name: "TTV Portföy Fonu", category: "Karma" },
  { code: "TTY", name: "TTY Portföy Fonu", category: "Değişken" },
  { code: "TYZ", name: "TYZ Portföy Fonu", category: "Karma" },
  { code: "VKF", name: "VKF Portföy Fonu", category: "Değişken" },
  { code: "YAS", name: "YAS Portföy Fonu", category: "Hisse" },
  { code: "YDH", name: "YDH Portföy Fonu", category: "Karma" },
];

function buildPrompt(sector: string, details: string): string {
  const fundList = TEFAS_FUNDS.map(f => `${f.code} (${f.name}, ${f.category})`).join("\n");

  return `Sen Türkiye'deki TEFAS yatırım fonları konusunda uzman bir finansal danışmansın. Kullanıcının belirlediği sektör/özelliklere göre en uygun fonları öneriyorsun.

Kullanıcının talebi:
- Sektör/Özellik: ${sector}
- Ek detaylar: ${details}

SADECE aşağıdaki gerçek TEFAS fon listesinden seçim yap. KESİNLİKLE bu liste dışında fon kodu kullanma (uydurma fon yazma):

${fundList}

Görevin:
1. Bu kriterlere en uygun 3-6 fon seç (yukarıdaki listeden).
2. Her fon için kısa bir neden yaz.
3. Her fon için "Alınabilirlik Yüzdesi" (0-100) hesapla.
4. Kısa bir özet geç.

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