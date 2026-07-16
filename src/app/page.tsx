"use client";

import { useState } from "react";
import { AnalysisResult, PortfolioSuggestion } from "@/lib/types";

const COLORS = [
  "#4f8ef7",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
  "#e879f9",
  "#5eead4",
  "#fca5a5",
];

function corrColor(v: number): string {
  if (v >= 0.9) return "rgba(248,113,113,0.55)";
  if (v >= 0.7) return "rgba(248,113,113,0.35)";
  if (v >= 0.4) return "rgba(251,191,36,0.25)";
  if (v >= 0.1) return "rgba(139,155,184,0.15)";
  return "rgba(52,211,153,0.3)";
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SuggestionCard({
  s,
  best,
  title,
}: {
  s: PortfolioSuggestion;
  best?: boolean;
  title: string;
}) {
  return (
    <div className={`suggestion-card${best ? " best" : ""}`}>
      <h3>
        {best && <span style={{ color: "#34d399" }}>★</span>}
        {title}
      </h3>
      <div className="stat-row">
        <span>Beklenen Yıllık Getiri</span>
        <b className={s.expectedReturn >= 0 ? "pos" : "neg"}>
          %{fmt(s.expectedReturn)}
        </b>
      </div>
      <div className="stat-row">
        <span>Yıllık Volatilite (Risk)</span>
        <b>%{fmt(s.volatility)}</b>
      </div>
      <div className="stat-row">
        <span>Sharpe Oranı</span>
        <b>{fmt(s.sharpe, 2)}</b>
      </div>
      <div className="weight-bar">
        {s.codes.map((c, i) => (
          <div
            key={c}
            className="weight-seg"
            style={{
              width: `${s.weights[i] * 100}%`,
              background: COLORS[i % COLORS.length],
            }}
            title={`${c}: %${fmt(s.weights[i] * 100, 0)}`}
          >
            {s.weights[i] > 0.08 ? c : ""}
          </div>
        ))}
      </div>
      <ul className="weight-list">
        {s.codes.map((c, i) => (
          <li key={c}>
            <span>
              <span
                className="dot"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {c}
            </span>
            <span>%{fmt(s.weights[i] * 100, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** AI fon bulucu öneri tipi */
interface FundSuggestion {
  code: string;
  name: string;
  category: string;
  reason: string;
  availabilityScore: number;
}
interface AiFinderResult {
  suggestions: FundSuggestion[];
  summary: string;
  disclaimer: string;
}

type Source = "live" | "csv" | "url" | "ai-find";

export default function Home() {
  const [source, setSource] = useState<Source>("live");
  const [input, setInput] = useState("");
  const [months, setMonths] = useState(12);
  const [csvFiles, setCsvFiles] = useState<{ name: string; text: string }[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Fon Bulucu state
  const [aiFindSector, setAiFindSector] = useState("");
  const [aiFindDetails, setAiFindDetails] = useState("");
  const [aiFindResult, setAiFindResult] = useState<AiFinderResult | null>(null);
  const [aiFindLoading, setAiFindLoading] = useState(false);
  const [aiFindError, setAiFindError] = useState<string | null>(null);

  async function fetchAiComment(analysis: AnalysisResult) {
    setAiLoading(true);
    setAiError(null);
    setAiComment(null);
    try {
      const res = await fetch("/api/ai-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "AI yorumu alınamadı.");
        return;
      }
      setAiComment(data.comment);
    } catch {
      setAiError("AI servisine bağlanılamadı.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr: { name: string; text: string }[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      arr.push({ name: f.name, text });
    }
    setCsvFiles((prev) => [...prev, ...arr]);
  }

  async function analyze() {
    let endpoint = "/api/analyze";
    let payload: Record<string, unknown> = {};

    if (source === "live") {
      const codes = input
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (codes.length < 2) {
        setError("En az 2 fon kodu girin (örn: TTE, AFA, MAC).");
        return;
      }
      payload = { codes, months };
    } else if (source === "csv") {
      if (csvFiles.length === 0) {
        setError("En az bir CSV dosyası yükleyin.");
        return;
      }
      endpoint = "/api/analyze-data";
      payload = { csvTexts: csvFiles.map((f) => f.text) };
    } else if (source === "url") {
      const urls = urlInput
        .split(/\r?\n/)
        .map((u) => u.trim())
        .filter(Boolean);
      if (urls.length === 0) {
        setError("En az bir URL girin.");
        return;
      }
      endpoint = "/api/analyze-data";
      payload = { urls };
    } else {
      // AI Find - handled separately
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAiComment(null);
    setAiError(null);
    setAiFindResult(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analiz başarısız oldu.");
        return;
      }
      setResult(data);
      fetchAiComment(data);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function findFunds() {
    if (!aiFindSector || aiFindSector.length < 2) {
      setAiFindError("Lütfen bir sektör veya özellik belirtin.");
      return;
    }

    setAiFindLoading(true);
    setAiFindError(null);
    setAiFindResult(null);

    try {
      const res = await fetch("/api/ai-fund-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: aiFindSector, details: aiFindDetails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiFindError(data.error ?? "Fon bulunamadı.");
        return;
      }
      setAiFindResult(data as AiFinderResult);
    } catch {
      setAiFindError("Sunucuya bağlanılamadı.");
    } finally {
      setAiFindLoading(false);
    }
  }

  const sortedMetrics = result
    ? [...result.metrics].sort((a, b) => b.sharpe - a.sharpe)
    : [];

  function scoreColor(v: number): string {
    if (v >= 80) return "#34d399";
    if (v >= 60) return "#fbbf24";
    if (v >= 40) return "#fb923c";
    return "#f87171";
  }

  return (
    <div className="container">
      <h1>📊 Fon Sepeti Optimizasyonu</h1>
      <p className="subtitle">
        TEFAS fon kodlarınızı girin; getiri, risk ve korelasyon analiziyle daha
        az fonla daha verimli sepetler önerelim.
      </p>

      <div className="card">
        <h2>Fonlarınız</h2>

        <div className="tabs">
          <button
            className={`tab${source === "live" ? " active" : ""}`}
            onClick={() => setSource("live")}
          >
            🌐 Canlı TEFAS
          </button>
          <button
            className={`tab${source === "csv" ? " active" : ""}`}
            onClick={() => setSource("csv")}
          >
            📁 CSV Yükle
          </button>
          <button
            className={`tab${source === "url" ? " active" : ""}`}
            onClick={() => setSource("url")}
          >
            🔗 URL'den Çek
          </button>
          <button
            className={`tab${source === "ai-find" ? " active" : ""}`}
            onClick={() => setSource("ai-find")}
          >
            🤖 AI Fon Bul
          </button>
        </div>

        {source === "live" && (
          <>
            <textarea
              className="fund-input"
              style={{ textTransform: "uppercase" }}
              placeholder="Fon kodlarını virgül veya boşlukla ayırarak girin. Örn: TTE, AFA, MAC, YAS, IPB..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="input-row" style={{ marginTop: 12 }}>
              <label style={{ fontSize: 14, color: "var(--muted)" }}>
                Analiz dönemi:
              </label>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                <option value={6}>Son 6 ay</option>
                <option value={9}>Son 9 ay</option>
                <option value={12}>Son 12 ay</option>
                <option value={24}>Son 24 ay</option>
                <option value={36}>Son 36 ay</option>
              </select>
            </div>
            <p className="hint">
              Veriler TEFAS'tan canlı çekilmeye çalışılır. TEFAS bot
              koruması nedeniyle erişim engellenebilir; bu durumda CSV veya URL
              seçeneğini kullanın.
            </p>
          </>
        )}

        {source === "csv" && (
          <>
            <input
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ margin: "8px 0", color: "var(--muted)" }}
            />
            {csvFiles.length > 0 && (
              <ul className="weight-list" style={{ marginBottom: 8 }}>
                {csvFiles.map((f, i) => (
                  <li key={i}>
                    <span>📄 {f.name}</span>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--red)",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                      onClick={() =>
                        setCsvFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Kaldır ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="hint">
              TEFAS "Tarihsel Veriler" sayfasından dışa aktardığınız
              dosyaları yükleyin (tefas.gov.tr → Fon Verileri → Tarihsel
              Veriler → Excel/CSV indir). Desteklenen format: Tarih; Fon Kodu;
              Fon Adı; Fiyat — veya basit "tarih,kod,fiyat". Birden
              fazla dosya yükleyebilirsiniz; her fon için en az 30 günlük veri
              gerekir.
            </p>
          </>
        )}

        {source === "url" && (
          <>
            <textarea
              className="fund-input"
              style={{ textTransform: "none" }}
              placeholder={
                "Her satıra bir URL girin. CSV veya JSON döndüren adresler desteklenir.\nÖrn: https://ornek.com/fon-verileri.csv"
              }
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <p className="hint">
              URL'ler sunucu üzerinden çekilir. CSV (tarih,kod,fiyat) veya
              JSON ([{"{"}date, code, price{"}"}]) formatları otomatik tanınır.
            </p>
          </>
        )}

        {source === "ai-find" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                🎯 İstediğiniz sektör veya fon özelliklerini yazın
              </label>
              <textarea
                className="fund-input"
                style={{ minHeight: 50, textTransform: "none" }}
                placeholder="Örn: Teknoloji hisse fonları, savunma sanayi, döviz bazlı, düşük riskli tahvil fonları, temettü verimi yüksek..."
                value={aiFindSector}
                onChange={(e) => setAiFindSector(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                📝 Ek detaylar (opsiyonel)
              </label>
              <textarea
                className="fund-input"
                style={{ minHeight: 50, textTransform: "none" }}
                placeholder="Vade tercihiniz, risk toleransınız, minimum getiri beklentiniz..."
                value={aiFindDetails}
                onChange={(e) => setAiFindDetails(e.target.value)}
              />
            </div>
            <div className="input-row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={findFunds} disabled={aiFindLoading}>
                {aiFindLoading ? "AI araştırıyor..." : "🤖 AI ile Fon Bul"}
              </button>
            </div>
            <p className="hint">
              Yapay zeka, belirttiğiniz kriterlere en uygun TEFAS fonlarını önerir
              ve her fon için alınabilirlik yüzdesi hesaplar. Öneriler bilgilendirme
              amaçlıdır, yatırım tavsiyesi değildir.
            </p>
          </>
        )}

        {(source === "live" || source === "csv" || source === "url") && (
          <div className="input-row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={analyze} disabled={loading}>
              {loading ? "Analiz ediliyor..." : "Analiz Et"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {/* AI Fon Bul sonuçları */}
      {source === "ai-find" && aiFindError && (
        <div className="error-box">⚠ {aiFindError}</div>
      )}
      {source === "ai-find" && aiFindLoading && (
        <div className="loading">
          <div className="spinner" />
          Yapay zeka en uygun fonları araştırıyor...
        </div>
      )}
      {source === "ai-find" && aiFindResult && (
        <>
          <div className="card">
            <h2>🤖 AI Önerileri</h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--muted)",
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              {aiFindResult.summary}
            </p>
            <div className="suggestion-grid">
              {aiFindResult.suggestions.map((fund, i) => (
                <div key={i} className="suggestion-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <span className="badge" style={{ fontSize: 15 }}>
                        {fund.code}
                      </span>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text)",
                          marginTop: 4,
                        }}
                      >
                        {fund.name}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginBottom: 2,
                        }}
                      >
                        Alınabilirlik
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: scoreColor(fund.availabilityScore),
                        }}
                      >
                        %{fund.availabilityScore}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginBottom: 6,
                    }}
                  >
                    {fund.category}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--text)",
                      lineHeight: 1.5,
                    }}
                  >
                    {fund.reason}
                  </div>
                </div>
              ))}
            </div>
            <p
              className="hint"
              style={{ marginTop: 12, fontStyle: "italic" }}
            >
              {aiFindResult.disclaimer}
            </p>
          </div>
        </>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          TEFAS verileri çekiliyor ve portföy optimize ediliyor...
        </div>
      )}

      {result && (
        <>
          {result.errors.length > 0 && (
            <div className="warn-box">
              Bazı fonların verisi alınamadı:{" "}
              {result.errors.map((e) => `${e.code} (${e.message})`).join(", ")}
            </div>
          )}

          {/* Fon metrikleri */}
          <div className="card">
            <h2>Fon Karşılaştırması</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fon</th>
                    <th>Dönem Getirisi</th>
                    <th>Yıllık Getiri</th>
                    <th>Volatilite</th>
                    <th>Sharpe</th>
                    <th>Maks. Düşüş</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMetrics.map((m) => (
                    <tr key={m.code}>
                      <td>
                        <span className="badge">{m.code}</span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                          title={m.title}
                        >
                          {m.title.length > 35
                            ? m.title.slice(0, 35) + "…"
                            : m.title}
                        </span>
                      </td>
                      <td className={m.totalReturn >= 0 ? "pos" : "neg"}>
                        %{fmt(m.totalReturn)}
                      </td>
                      <td className={m.annualizedReturn >= 0 ? "pos" : "neg"}>
                        %{fmt(m.annualizedReturn)}
                      </td>
                      <td>%{fmt(m.volatility)}</td>
                      <td>
                        <b>{fmt(m.sharpe, 2)}</b>
                      </td>
                      <td className="neg">%{fmt(m.maxDrawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gereksiz fonlar */}
          {result.redundantPairs.length > 0 && (
            <div className="card">
              <h2>🔁 Birbirini Tekrar Eden Fonlar</h2>
              {result.redundantPairs.map((p, i) => (
                <div key={i} className="warn-box" style={{ marginBottom: 10 }}>
                  {p.reason}
                </div>
              ))}
            </div>
          )}

          {/* Öneriler */}
          <div className="card">
            <h2>💡 Önerilen Sepetler</h2>
            <div className="suggestion-grid">
              {result.currentPortfolio && (
                <SuggestionCard
                  s={result.currentPortfolio}
                  title={`Mevcut Sepetiniz (${result.currentPortfolio.codes.length} fon)`}
                />
              )}
              {result.suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  s={s}
                  best={i === 0}
                  title={`Öneri ${i + 1}: ${s.codes.length} fonluk sepet`}
                />
              ))}
            </div>
          </div>

          {/* AI Yorumu */}
          <div className="card">
            <h2>🤖 AI Portföy Değerlendirmesi</h2>
            {aiLoading && (
              <div className="loading" style={{ padding: "16px 0" }}>
                <div className="spinner" />
                Yapay zeka portföyünüzü değerlendiriyor...
              </div>
            )}
            {aiError && (
              <div className="warn-box">
                {aiError}{" "}
                <button
                  className="primary"
                  style={{ padding: "6px 14px", fontSize: 13, marginLeft: 8 }}
                  onClick={() => result && fetchAiComment(result)}
                >
                  Tekrar dene
                </button>
              </div>
            )}
            {aiComment && (
              <div
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  color: "var(--text)",
                }}
              >
                {aiComment.replace(/\*\*/g, "").replace(/^#+\s*/gm, "")}
              </div>
            )}
          </div>

          {/* Korelasyon matrisi */}
          <div className="card">
            <h2>Korelasyon Matrisi</h2>
            <p className="hint" style={{ marginBottom: 12 }}>
              Kırmızı = yüksek korelasyon (aynı hareket, çeşitlendirme yok).
              Yeşil = düşük/negatif korelasyon (iyi çeşitlendirme).
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    {result.correlation.codes.map((c) => (
                      <th key={c} style={{ textAlign: "center" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.correlation.codes.map((rowCode, i) => (
                    <tr key={rowCode}>
                      <th>{rowCode}</th>
                      {result.correlation.codes.map((colCode, j) => (
                        <td
                          key={colCode}
                          className="corr-cell"
                          style={{
                            background:
                              i === j
                                ? "transparent"
                                : corrColor(result.correlation.matrix[i][j]),
                          }}
                        >
                          {i === j
                            ? "—"
                            : fmt(result.correlation.matrix[i][j], 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="disclaimer">
            ⚠ Bu araç yalnızca bilgilendirme amaçlıdır ve yatırım tavsiyesi
            değildir. Analizler geçmiş fiyat verilerine dayanır; geçmiş
            performans gelecekteki getirilerin garantisi değildir. Sharpe oranı
            hesabında yıllık ~%30 risksiz getiri varsayılmıştır. Yatırım
            kararlarınızı vermeden önce profesyonel danışmanlık almanız
            önerilir.
          </p>
        </>
      )}
    </div>
  );
}