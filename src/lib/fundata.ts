// Alternatif veri kaynağı: fundata / hangikredi benzeri açık API'ler yerine
// TEFAS verilerini yansıtan halka açık kaynaklardan fon fiyat geçmişi çeker.
// Birincil: fonapi.co benzeri yok -> Yahoo Finance TEFAS fonlarını içermiyor.
// Kullanılan kaynak: https://ws.spk.gov.tr değil;
// fintables benzeri korumasız uç: https://api.fintables.com/funds/{code}/chart/

import { FundData, FundPrice } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface FintablesChartItem {
  date: string; // YYYY-MM-DD
  price: number;
}

interface FintablesChartResponse {
  results?: { data?: FintablesChartItem[]; title?: string } | FintablesChartItem[];
  data?: FintablesChartItem[];
  title?: string;
}

async function tryFintables(code: string, months: number): Promise<FundData | null> {
  try {
    const url = `https://api.fintables.com/funds/${code.toUpperCase()}/chart/?period=${
      months >= 36 ? "3y" : months >= 24 ? "2y" : months >= 12 ? "1y" : "6m"
    }`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FintablesChartResponse;

    let items: FintablesChartItem[] | undefined;
    if (Array.isArray(json.results)) items = json.results;
    else if (json.results?.data) items = json.results.data;
    else if (json.data) items = json.data;

    if (!items || items.length < 30) return null;

    const prices: FundPrice[] = items
      .filter((i) => i.price > 0 && i.date)
      .map((i) => ({ date: i.date.slice(0, 10), price: i.price }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (prices.length < 30) return null;

    return { code: code.toUpperCase(), title: code.toUpperCase(), prices };
  } catch {
    return null;
  }
}

export { tryFintables };
