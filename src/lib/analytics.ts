// Portföy analiz motoru: getiri, risk, korelasyon, optimizasyon

import {
  FundData,
  FundMetrics,
  CorrelationMatrix,
  PortfolioSuggestion,
} from "./types";

const TRADING_DAYS = 252;
// Türkiye için yaklaşık risksiz yıllık getiri (mevduat/para piyasası) - %30
const RISK_FREE_ANNUAL = 0.3;
const RISK_FREE_DAILY = Math.pow(1 + RISK_FREE_ANNUAL, 1 / TRADING_DAYS) - 1;

// ---------- Yardımcılar ----------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Ortak tarihlerdeki günlük getirileri hizala */
export function alignReturns(funds: FundData[]): {
  codes: string[];
  dates: string[];
  returns: number[][]; // [fon][gün]
} {
  // Tüm fonlarda ortak olan tarihler
  const dateSets = funds.map((f) => new Set(f.prices.map((p) => p.date)));
  const common = funds[0].prices
    .map((p) => p.date)
    .filter((d) => dateSets.every((s) => s.has(d)))
    .sort();

  const priceMaps = funds.map(
    (f) => new Map(f.prices.map((p) => [p.date, p.price]))
  );

  const returns: number[][] = funds.map(() => []);
  const retDates: string[] = [];

  for (let i = 1; i < common.length; i++) {
    const d0 = common[i - 1];
    const d1 = common[i];
    let valid = true;
    const dayReturns: number[] = [];
    for (let j = 0; j < funds.length; j++) {
      const p0 = priceMaps[j].get(d0)!;
      const p1 = priceMaps[j].get(d1)!;
      const r = p1 / p0 - 1;
      if (!Number.isFinite(r)) {
        valid = false;
        break;
      }
      dayReturns.push(r);
    }
    if (valid) {
      retDates.push(d1);
      dayReturns.forEach((r, j) => returns[j].push(r));
    }
  }

  return { codes: funds.map((f) => f.code), dates: retDates, returns };
}

// ---------- Metrikler ----------

export function computeMetrics(fund: FundData): FundMetrics {
  const prices = fund.prices.map((p) => p.price);
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i] / prices[i - 1] - 1);
  }

  const totalReturn = prices[prices.length - 1] / prices[0] - 1;
  const days = returns.length;
  const annualizedReturn = Math.pow(1 + totalReturn, TRADING_DAYS / days) - 1;
  const dailyVol = std(returns);
  const volatility = dailyVol * Math.sqrt(TRADING_DAYS);
  const meanDaily = mean(returns);
  const sharpe =
    dailyVol > 0
      ? ((meanDaily - RISK_FREE_DAILY) / dailyVol) * Math.sqrt(TRADING_DAYS)
      : 0;

  // Max drawdown
  let peak = prices[0];
  let maxDd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = p / peak - 1;
    if (dd < maxDd) maxDd = dd;
  }

  return {
    code: fund.code,
    title: fund.title,
    totalReturn: totalReturn * 100,
    annualizedReturn: annualizedReturn * 100,
    volatility: volatility * 100,
    sharpe,
    maxDrawdown: maxDd * 100,
    dataPoints: prices.length,
  };
}

// ---------- Korelasyon ----------

export function computeCorrelation(
  codes: string[],
  returns: number[][]
): CorrelationMatrix {
  const n = codes.length;
  const means = returns.map(mean);
  const stds = returns.map(std);
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      const len = Math.min(returns[i].length, returns[j].length);
      let cov = 0;
      for (let k = 0; k < len; k++) {
        cov += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      cov /= len - 1;
      const corr =
        stds[i] > 0 && stds[j] > 0 ? cov / (stds[i] * stds[j]) : 0;
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { codes, matrix };
}

// ---------- Kovaryans ----------

function covarianceMatrix(returns: number[][]): number[][] {
  const n = returns.length;
  const means = returns.map(mean);
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const len = Math.min(returns[i].length, returns[j].length);
      let c = 0;
      for (let k = 0; k < len; k++) {
        c += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      c /= len - 1;
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }
  return cov;
}

// ---------- Portföy hesabı ----------

function portfolioStats(
  weights: number[],
  meanDaily: number[],
  cov: number[][]
): { annRet: number; annVol: number; sharpe: number } {
  const n = weights.length;
  let ret = 0;
  for (let i = 0; i < n; i++) ret += weights[i] * meanDaily[i];

  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * cov[i][j];
    }
  }
  const dailyVol = Math.sqrt(Math.max(variance, 0));
  const annRet = Math.pow(1 + ret, TRADING_DAYS) - 1;
  const annVol = dailyVol * Math.sqrt(TRADING_DAYS);
  const sharpe =
    dailyVol > 0
      ? ((ret - RISK_FREE_DAILY) / dailyVol) * Math.sqrt(TRADING_DAYS)
      : 0;
  return { annRet: annRet * 100, annVol: annVol * 100, sharpe };
}

/**
 * Verilen fon alt kümesi için Sharpe'ı maksimize eden ağırlıkları bul.
 * Monte Carlo + yerel iyileştirme (basit ama etkili).
 */
function optimizeWeights(
  meanDaily: number[],
  cov: number[][],
  iterations = 8000
): { weights: number[]; sharpe: number } {
  const n = meanDaily.length;
  let bestW = new Array(n).fill(1 / n);
  let bestS = portfolioStats(bestW, meanDaily, cov).sharpe;

  // Rastgele arama
  for (let it = 0; it < iterations; it++) {
    const raw = Array.from({ length: n }, () => Math.random());
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = raw.map((x) => x / sum);
    const s = portfolioStats(w, meanDaily, cov).sharpe;
    if (s > bestS) {
      bestS = s;
      bestW = w;
    }
  }

  // Yerel iyileştirme
  let step = 0.05;
  for (let round = 0; round < 6; round++) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (bestW[j] < step) continue;
          const w = [...bestW];
          w[i] += step;
          w[j] -= step;
          const s = portfolioStats(w, meanDaily, cov).sharpe;
          if (s > bestS) {
            bestS = s;
            bestW = w;
            improved = true;
          }
        }
      }
    }
    step /= 2;
  }

  return { weights: bestW, sharpe: bestS };
}

/** Alt küme seçimi: hedef fon sayısı k için en iyi kombinasyonu bul (greedy geri eleme) */
function selectSubset(
  codes: string[],
  meanDaily: number[],
  cov: number[][],
  k: number
): PortfolioSuggestion {
  let active = codes.map((_, i) => i);

  // Greedy: her adımda çıkarılması Sharpe'ı en çok artıran (veya en az düşüren) fonu çıkar
  while (active.length > k) {
    let bestSharpe = -Infinity;
    let bestRemove = -1;
    for (const rem of active) {
      const subset = active.filter((i) => i !== rem);
      const subMean = subset.map((i) => meanDaily[i]);
      const subCov = subset.map((i) => subset.map((j) => cov[i][j]));
      // Hızlı değerlendirme için düşük iterasyon
      const { sharpe } = optimizeWeights(subMean, subCov, 1500);
      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestRemove = rem;
      }
    }
    active = active.filter((i) => i !== bestRemove);
  }

  // Final: seçilen alt küme için tam optimizasyon
  const subMean = active.map((i) => meanDaily[i]);
  const subCov = active.map((i) => active.map((j) => cov[i][j]));
  const { weights } = optimizeWeights(subMean, subCov, 10000);
  const stats = portfolioStats(weights, subMean, subCov);

  // Ağırlığı %2'nin altındaki fonları at ve yeniden normalize et
  const filtered: { idx: number; w: number }[] = [];
  weights.forEach((w, i) => {
    if (w >= 0.02) filtered.push({ idx: active[i], w });
  });
  const wSum = filtered.reduce((a, b) => a + b.w, 0);
  const finalCodes = filtered.map((f) => codes[f.idx]);
  const finalWeights = filtered.map((f) => f.w / wSum);

  // Filtrelenmiş set ile istatistikleri yeniden hesapla
  const fIdx = filtered.map((f) => f.idx);
  const fMean = fIdx.map((i) => meanDaily[i]);
  const fCov = fIdx.map((i) => fIdx.map((j) => cov[i][j]));
  const finalStats = portfolioStats(finalWeights, fMean, fCov);

  return {
    codes: finalCodes,
    weights: finalWeights,
    expectedReturn: finalStats.annRet,
    volatility: finalStats.annVol,
    sharpe: finalStats.sharpe,
  };
}

// ---------- Ana analiz ----------

export function analyzePortfolio(
  funds: FundData[],
  currentWeights?: number[]
): {
  correlation: CorrelationMatrix;
  currentPortfolio: PortfolioSuggestion | null;
  suggestions: PortfolioSuggestion[];
  redundantPairs: { a: string; b: string; corr: number; drop: string; reason: string }[];
} {
  const { codes, returns } = alignReturns(funds);
  const correlation = computeCorrelation(codes, returns);
  const cov = covarianceMatrix(returns);
  const meanDaily = returns.map(mean);

  // Mevcut portföy (eşit ağırlık veya kullanıcı ağırlıkları)
  const n = codes.length;
  const curW =
    currentWeights && currentWeights.length === n
      ? currentWeights
      : new Array(n).fill(1 / n);
  const curStats = portfolioStats(curW, meanDaily, cov);
  const currentPortfolio: PortfolioSuggestion = {
    codes,
    weights: curW,
    expectedReturn: curStats.annRet,
    volatility: curStats.annVol,
    sharpe: curStats.sharpe,
  };

  // Yüksek korelasyonlu (gereksiz) çiftler
  const redundantPairs: { a: string; b: string; corr: number; drop: string; reason: string }[] = [];
  const annRet = (i: number) =>
    (Math.pow(1 + meanDaily[i], TRADING_DAYS) - 1) * 100;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (correlation.matrix[i][j] > 0.9) {
        const dropIdx = annRet(i) >= annRet(j) ? j : i;
        redundantPairs.push({
          a: codes[i],
          b: codes[j],
          corr: correlation.matrix[i][j],
          drop: codes[dropIdx],
          reason: `${codes[i]} ve ${codes[j]} %${(
            correlation.matrix[i][j] * 100
          ).toFixed(0)} korelasyonla neredeyse aynı hareket ediyor. Getirisi düşük olan ${codes[dropIdx]} çıkarılabilir.`,
        });
      }
    }
  }

  // Öneriler: farklı hedef fon sayıları için optimal sepetler
  const targets = [...new Set([
    Math.min(2, n),
    Math.min(4, n),
    Math.min(6, n),
    Math.min(8, n),
  ])].filter((k) => k >= 2 && k < n);

  const suggestions = targets.map((k) =>
    selectSubset(codes, meanDaily, cov, k)
  );

  // Sharpe'a göre sırala
  suggestions.sort((a, b) => b.sharpe - a.sharpe);

  return { correlation, currentPortfolio, suggestions, redundantPairs };
}
