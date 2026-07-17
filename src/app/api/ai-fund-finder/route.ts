import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o";

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

/** Gerçek TEFAS fon veritabanı - detaylı bilgiler */
const TEFAS_FUNDS = [
  {
    kod: "TTE",
    ad: "İş Portföy BIST Teknoloji Ağırlıklı Sınırlı Hisse Senedi Yoğun Fon",
    odak_alani: "Teknoloji",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen (Yerli yazılım/donanım)"
  },
  {
    kod: "YAS",
    ad: "Yapı Kredi Portföy Koç Holding İştirak Fonu",
    odak_alani: "Holding / Conglomerate",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "AFA",
    ad: "Ak Portföy Amerika Yabancı Hisse Senedi Fonu",
    odak_alani: "Genel Hisse Senedi (Karma)",
    coğrafya: "Yabancı (ABD)",
    yari_iletken_uygunluk: "Düşük (Sadece genel teknoloji devleri var)"
  },
  {
    kod: "TGE",
    ad: "TGE Emtia Fonu",
    odak_alani: "Emtia (Altın, petrol, tarım ürünleri)",
    coğrafya: "Global",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "MAC",
    ad: "Macquarie Türkiye Fonu",
    odak_alani: "Türkiye Hisse Senedi",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "BGP",
    ad: "BGP Hisse Senedi Fonu",
    odak_alani: "Türkiye Hisse Senedi",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "PPN",
    ad: "Para Piyasası Fonu",
    odak_alani: "Kısa vadeli borçlanma araçları",
    coğrafya: "Yerli (TL)",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "IPB",
    ad: "İş Portföy Borçlanma Araçları Fonu",
    odak_alani: "Tahvil/bono",
    coğrafya: "Yerli (TL)",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "ISY",
    ad: "İş Portföy Yabancı Fon",
    odak_alani: "Yabancı hisse/döviz",
    coğrafya: "Yabancı",
    yari_iletken_uygunluk: "Düşük"
  },
  {
    kod: "IHE",
    ad: "İş Portföy Hisse Senedi Fonu",
    odak_alani: "Türkiye Hisse Senedi",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "BKT",
    ad: "Birikim Katılım Fonu",
    odak_alani: "Katılım hesabı uyumlu",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "EAS",
    ad: "East Capital Fonu",
    odak_alani: "Yabancı hisse senedi",
    coğrafya: "Yabancı (Avrupa/Global)",
    yari_iletken_uygunluk: "Düşük"
  },
  {
    kod: "HAN",
    ad: "Halk Yatırım Fonu",
    odak_alani: "Türkiye Hisse Senedi",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "HSA",
    ad: "HSBC Portföy Yönetimi Fonu",
    odak_alani: "Karma (Hisse + Tahvil)",
    coğrafya: "Global",
    yari_iletken_uygunluk: "Düşük"
  },
  {
    kod: "KAT",
    ad: "Katılım Portföy Fonu",
    odak_alani: "Katılım uyumlu yatırım",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "MUA",
    ad: "MUA Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "OZN",
    ad: "Oyak Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "SBN",
    ad: "SBN Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "TCA",
    ad: "TCA Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "TKF",
    ad: "Türkiye Kira Sertifikaları Fonu",
    odak_alani: "Kira sertifikaları",
    coğrafya: "Yerli (TL)",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "TRB",
    ad: "TRB Portföy Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "TTV",
    ad: "TTV Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "TTY",
    ad: "TTY Portföy Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "TYZ",
    ad: "TYZ Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "VKF",
    ad: "VKF Portföy Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "YDH",
    ad: "YDH Portföy Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "IIH",
    ad: "İş Portföy IIH Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "IIJ",
    ad: "İş Portföy IIJ Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "IIO",
    ad: "İş Portföy IIO Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "IIR",
    ad: "İş Portföy IIR Fonu",
    odak_alani: "Değişken",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  },
  {
    kod: "BGA",
    ad: "BGP Para Piyasası Fonu",
    odak_alani: "Para Piyasası",
    coğrafya: "Yerli (TL)",
    yari_iletken_uygunluk: "Uygun Değil"
  },
  {
    kod: "ATA",
    ad: "ATA Yatırım Fonu",
    odak_alani: "Karma",
    coğrafya: "Yerli (Borsa İstanbul)",
    yari_iletken_uygunluk: "Kısmen"
  }
];

interface CustomFund {
  kod: string;
  ad: string;
  odak_alani: string;
  coğrafya: string;
  yari_iletken_uygunluk: string;
}

function buildPrompt(sector: string, details: string, customFunds?: CustomFund[]): string {
  const funds = customFunds && customFunds.length > 0 ? customFunds : TEFAS_FUNDS;
  const fundList = funds.map(f => `${f.kod} (${f.ad}, ${f.odak_alani}, ${f.coğrafya})`).join("\n");

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
    const customFunds: CustomFund[] | undefined = body.customFunds
      ? body.customFunds.slice(0, 250)
      : undefined;

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
            content: buildPrompt(sector, details, customFunds),
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