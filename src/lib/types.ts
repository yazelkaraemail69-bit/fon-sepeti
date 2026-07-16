// Ortak tip tanımları

export interface FundPrice {
  date: string; // YYYY-MM-DD
  price: number;
}

export interface FundData {
  code: string;
  title: string;
  prices: FundPrice[];
}

export interface FundMetrics {
  code: string;
  title: string;
  totalReturn: number; // dönem toplam getirisi (%)
  annualizedReturn: number; // yıllıklandırılmış getiri (%)
  volatility: number; // yıllıklandırılmış volatilite (%)
  sharpe: number; // Sharpe oranı (risksiz faiz üzeri)
  maxDrawdown: number; // maksimum düşüş (%)
  dataPoints: number;
}

export interface CorrelationMatrix {
  codes: string[];
  matrix: number[][]; // [i][j] = korelasyon
}

export interface PortfolioSuggestion {
  codes: string[];
  weights: number[]; // toplamı 1
  expectedReturn: number; // yıllık (%)
  volatility: number; // yıllık (%)
  sharpe: number;
}

export interface AnalysisResult {
  metrics: FundMetrics[];
  correlation: CorrelationMatrix;
  currentPortfolio: PortfolioSuggestion | null;
  suggestions: PortfolioSuggestion[];
  redundantPairs: { a: string; b: string; corr: number; drop: string; reason: string }[];
  errors: { code: string; message: string }[];
}
