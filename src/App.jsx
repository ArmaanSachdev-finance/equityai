import { useState } from "react";

function fmt(n, d = 1) {
  if (n == null || isNaN(n)) return "N/A";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(d) + "T";
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(d)  + "B";
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(d)  + "M";
  return n.toFixed(d);
}
function pct(n)  { return n == null || isNaN(n) ? "N/A" : (n * 100).toFixed(1) + "%"; }
function usd(n)  { return n == null || isNaN(n) ? "N/A" : "$" + n.toFixed(2); }
function safe(n) { return typeof n === "number" && isFinite(n) ? n : null; }

function runDCF(fcf, shares, price, growth, wacc = 0.10, tg = 0.03, years = 5) {
  if (!fcf || !shares || fcf <= 0) return null;
  let pv = 0, cf = fcf;
  for (let i = 1; i <= years; i++) { cf *= (1 + growth); pv += cf / Math.pow(1 + wacc, i); }
  const tv = (cf * (1 + tg)) / (wacc - tg);
  pv += tv / Math.pow(1 + wacc, years);
  const implied = pv / shares;
  return { impliedPrice: implied, upside: ((implied - price) / price) * 100 };
}

function buildSensitivity(fcf, shares, price, growth) {
  return [0.02, 0.025, 0.03, 0.035, 0.04].map(tg => {
    const r = runDCF(fcf, shares, price, growth, 0.10, tg);
    return { tg: (tg * 100).toFixed(1) + "%", implied: r ? usd(r.impliedPrice) : "N/A", upside: r ? r.upside : null };
  });
}

async function fetchCompanyData(ticker) {
  const t = ticker.toUpperCase();
  const res = await fetch(`/api/stock?ticker=${t}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch data.");
  const { profile, income, cashflow, balance, quote, ratios } = data;
  const p = profile[0] || {}, inc = income[0] || {}, incPrev = income[1] || {};
  const cf = cashflow[0] || {}, bal = balance[0] || {}, q = quote[0] || {}, r = ratios[0] || {};
  const revenue = safe(inc.revenue), revenuePrev = safe(incPrev.revenue);
  const ebit = safe(inc.operatingIncome), netIncome = safe(inc.netIncome);
  const ebitda = safe(inc.ebitda), fcfVal = safe(cf.freeCashFlow);
  const totalDebt = safe(bal.totalDebt), equity = safe(bal.totalStockholdersEquity);
  const shares = safe(p.sharesOutstanding) || safe(q.sharesOutstanding);
  const price = safe(q.price) || safe(p.price), marketCap = safe(p.mktCap);
  const pe = safe(r.peRatioTTM) || safe(q.pe), evEbitda = safe(r.enterpriseValueMultipleTTM);
  if (!price) throw new Error(`No price data for "${t}". It may be delisted or not on FMP.`);
  const revenueGrowth = revenue && revenuePrev ? (revenue - revenuePrev) / revenuePrev : null;
  const ebitMargin = revenue && ebit ? ebit / revenue : null;
  const netMargin = revenue && netIncome ? netIncome / revenue : null;
  const debtEquity = totalDebt && equity ? totalDebt / equity : null;
  return {
    name: p.companyName, ticker: t, industry: p.industry || p.sector || "—",
    price, marketCap, shares, revenue, revenuePrev, ebit, netIncome, ebitda,
    fcf: fcfVal, totalDebt, equity, pe, evEbitda,
    metrics: { revenueGrowth, ebitMargin, netMargin, debtEquity, fcf: fcfVal, pe, evEbitda },
  };
}

async function generateSummary(data, dcf) {
  const { ticker, name, metrics: m } = data;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{ role: "user", content: `You are a senior equity research analyst. Write a concise, professional equity research commentary for ${ticker} (${name}).
Financial Data: Revenue Growth: ${pct(m.revenueGrowth)}, EBIT Margin: ${pct(m.ebitMargin)}, Net Margin: ${pct(m.netMargin)}, P/E: ${m.pe ? m.pe.toFixed(1)+"x" : "N/A"}, EV/EBITDA: ${m.evEbitda ? m.evEbitda.toFixed(1)+"x" : "N/A"}, D/E: ${m.debtEquity ? m.debtEquity.toFixed(2) : "N/A"}, FCF: ${m.fcf ? "$"+fmt(m.fcf) : "N/A"}${dcf ? `, DCF: ${usd(dcf.impliedPrice)} (${dcf.upside>0?"+":""}${dcf.upside.toFixed(1)}% vs current)` : ""}.
Write 3-4 sentences on business quality, valuation, and key risks. Be specific. Sound like a real Wall Street analyst. End with one clear investment takeaway.` }],
    }),
  });
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "Summary unavailable.";
}

const MetricCard = ({ label, value, sub, highlight }) => (
  <div style={{ background: highlight ? "rgba(251,191,36,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${highlight ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#6b7280", textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
    <span style={{ fontSize: 21, fontWeight: 700, color: highlight ? "#fbbf24" : "#f3f4f6", letterSpacing: "-0.02em" }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{sub}</span>}
  </div>
);

const Badge = ({ text, color }) => {
  const c = { green: ["rgba(34,197,94,0.15)", "#4ade80", "rgba(34,197,94,0.3)"], red: ["rgba(239,68,68,0.15)", "#f87171", "rgba(239,68,68,0.3)"], yellow: ["rgba(251,191,36,0.15)", "#fbbf24", "rgba(251,191,36,0.3)"] }[color] || ["rgba(255,255,255,0.1)", "#9ca3af", "rgba(255,255,255,0.2)"];
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", background: c[0], color: c[1], border: `1px solid ${c[2]}`, fontFamily: "monospace" }}>{text}</span>;
};

export default function App() {
  const [ticker, setTicker] = useState("");
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const suggested = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "JPM", "TSLA", "SHOP", "V", "BRK-B", "UBER"];

  async function run(inputTicker) {
    const t = (inputTicker || ticker).toUpperCase().trim();
    if (!t) return;
    setLoading(true); setReport(null); setAiSummary(""); setError(null);
    try {
      setStage("Fetching live financial data…");
      const data = await fetchCompanyData(t);
      setStage("Running DCF model…");
      await new Promise(r => setTimeout(r, 250));
      const growth = data.metrics.revenueGrowth ? Math.min(Math.max(data.metrics.revenueGrowth, 0.02), 0.30) : 0.07;
      const dcf = data.fcf > 0 ? runDCF(data.fcf, data.shares, data.price, growth) : null;
      const sensitivity = data.fcf > 0 ? buildSensitivity(data.fcf, data.shares, data.price, growth) : null;
      setLoading(false); setReport({ data, dcf, sensitivity });
      setAiLoading(true); setStage("Generating AI analyst summary…");
      const summary = await generateSummary(data, dcf);
      setAiSummary(summary); setAiLoading(false);
    } catch (e) {
      setError(e.message || "Something went wrong."); setLoading(false); setAiLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;} body{background:#080c14;}
        input:focus{outline:none;border-color:rgba(251,191,36,0.5)!important;box-shadow:0 0 0 3px rgba(251,191,36,0.07);}
        .chip:hover{background:rgba(251,191,36,0.15)!important;border-color:rgba(251,191,36,0.4)!important;color:#fbbf24!important;cursor:pointer;}
        .btn:hover:not(:disabled){background:#f59e0b!important;transform:translateY(-1px);box-shadow:0 8px 24px rgba(251,191,36,0.25);}
        .btn:disabled{opacity:0.45;cursor:not-allowed;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}} .fade-up{animation:fadeUp 0.4s ease forwards;}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 0.8s linear infinite;display:inline-block;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} .pulse{animation:pulse 1.6s ease infinite;}
        .sens-row:hover td{background:rgba(251,191,36,0.04)!important;}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#080c14", fontFamily: "'Sora', sans-serif", color: "#f3f4f6", paddingBottom: 80 }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◈</div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>EquityAI</span>
            <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(251,191,36,0.1)", color: "#fbbf24", borderRadius: 4, letterSpacing: "0.1em", fontFamily: "monospace" }}>LIVE DATA</span>
          </div>
          <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace" }}>FMP + CLAUDE AI</span>
        </div>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "52px 24px 0" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#fbbf24", marginBottom: 18, fontFamily: "monospace" }}>AI EQUITY RESEARCH — ANY TICKER, NO SIGNUP</div>
            <h1 style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14 }}>
              Institutional research.<br />
              <span style={{ background: "linear-gradient(90deg,#fbbf24,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Any stock. Instantly.</span>
            </h1>
            <p style={{ color: "#6b7280", fontSize: 15, maxWidth: 500, margin: "0 auto", lineHeight: 1.75 }}>Live financials, DCF valuation, sensitivity analysis, and an AI analyst summary — for any publicly traded company. No signup required.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "26px", marginBottom: 32 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && run()} placeholder="Enter any ticker: AAPL, SHOP, UBER…"
                style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 20px", color: "#f3f4f6", fontSize: 18, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", transition: "all 0.2s" }} />
              <button className="btn" onClick={() => run()} disabled={loading || aiLoading || !ticker}
                style={{ background: "#fbbf24", color: "#000", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Sora',sans-serif", whiteSpace: "nowrap" }}>
                {loading ? "Fetching…" : "Analyze →"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", marginRight: 4 }}>Try:</span>
              {suggested.map(t => (
                <button key={t} className="chip" onClick={() => { setTicker(t); run(t); }}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "#9ca3af", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontFamily: "monospace", fontWeight: 500, transition: "all 0.2s" }}>{t}</button>
              ))}
            </div>
          </div>
          {loading && <div style={{ textAlign: "center", padding: "56px 0" }}><div className="spin" style={{ fontSize: 26, marginBottom: 14, color: "#fbbf24" }}>⟳</div><div className="pulse" style={{ fontSize: 13, color: "#6b7280", fontFamily: "monospace" }}>{stage}</div></div>}
          {error && <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "18px 22px", color: "#f87171", fontFamily: "monospace", fontSize: 13, lineHeight: 1.7 }}>⚠ {error}</div>}
          {report && (() => {
            const { data, dcf, sensitivity } = report;
            const m = data.metrics;
            const upsideColor = dcf ? (dcf.upside > 5 ? "green" : dcf.upside < -5 ? "red" : "yellow") : "yellow";
            return (
              <div className="fade-up">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 26, padding: "22px 26px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 7 }}>{data.industry} · {data.ticker}</div>
                    <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>{data.name}</h2>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "monospace" }}>{usd(data.price)}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Live Market Price</div>
                    {dcf && <div style={{ marginTop: 10, display: "flex", gap: 7, justifyContent: "flex-end", flexWrap: "wrap" }}><Badge text={`DCF: ${usd(dcf.impliedPrice)}`} color="yellow" /><Badge text={`${dcf.upside > 0 ? "+" : ""}${dcf.upside.toFixed(1)}% upside`} color={upsideColor} /></div>}
                  </div>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#6b7280", fontFamily: "monospace", marginBottom: 13 }}>KEY METRICS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 11 }}>
                    <MetricCard label="Revenue" value={"$" + fmt(data.revenue)} sub={m.revenueGrowth != null ? `YoY: ${pct(m.revenueGrowth)}` : "Growth: N/A"} />
                    <MetricCard label="EBIT Margin" value={pct(m.ebitMargin)} sub={`EBITDA: $${fmt(data.ebitda)}`} />
                    <MetricCard label="Net Margin" value={pct(m.netMargin)} sub={`Net Income: $${fmt(data.netIncome)}`} />
                    <MetricCard label="P/E Ratio" value={data.pe ? data.pe.toFixed(1) + "x" : "N/A"} sub="Price / Earnings" />
                    <MetricCard label="EV / EBITDA" value={data.evEbitda ? data.evEbitda.toFixed(1) + "x" : "N/A"} sub="Enterprise multiple" />
                    <MetricCard label="Debt / Equity" value={m.debtEquity != null ? m.debtEquity.toFixed(2) : "N/A"} sub={`Debt: $${fmt(data.totalDebt)}`} />
                    <MetricCard label="Free Cash Flow" value={"$" + fmt(data.fcf)} sub={data.fcf > 0 ? "Positive FCF ✓" : "Negative FCF ✗"} highlight={data.fcf > 0} />
                    <MetricCard label="Market Cap" value={"$" + fmt(data.marketCap)} sub={data.industry} />
                  </div>
                </div>
                {dcf && sensitivity && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 22 }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px" }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#6b7280", fontFamily: "monospace", marginBottom: 16 }}>DCF VALUATION</div>
                      {[["Current Price", usd(data.price)], ["Implied Value", usd(dcf.impliedPrice)], ["Upside / Downside", `${dcf.upside > 0 ? "+" : ""}${dcf.upside.toFixed(1)}%`], ["Free Cash Flow", "$" + fmt(data.fcf)], ["Revenue Growth", pct(m.revenueGrowth)]].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{l}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: l.includes("Upside") ? (dcf.upside > 0 ? "#4ade80" : "#f87171") : "#f3f4f6" }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 10, color: "#374151", fontFamily: "monospace", lineHeight: 1.7, marginTop: 4 }}>5yr FCF projection · WACC 10% · FCF-based</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px" }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#6b7280", fontFamily: "monospace", marginBottom: 16 }}>SENSITIVITY ANALYSIS</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr>{["Terminal Growth", "Implied Value", "Upside"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 10, color: "#6b7280", fontFamily: "monospace", paddingBottom: 10, letterSpacing: "0.08em" }}>{h}</th>)}</tr></thead>
                        <tbody>{sensitivity.map((row, i) => (
                          <tr key={i} className="sens-row" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "9px 0", fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>{row.tg}</td>
                            <td style={{ padding: "9px 8px", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{row.implied}</td>
                            <td style={{ padding: "9px 0" }}><span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: row.upside != null ? (row.upside > 0 ? "#4ade80" : "#f87171") : "#6b7280" }}>{row.upside != null ? (row.upside > 0 ? "+" : "") + row.upside.toFixed(1) + "%" : "N/A"}</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                {!dcf && <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, padding: "14px 20px", fontSize: 13, color: "#f87171", fontFamily: "monospace", marginBottom: 22 }}>⚠ DCF not available — {data.ticker} reported negative or unavailable free cash flow.</div>}
                <div style={{ background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 14, padding: "24px 26px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#fbbf24", fontFamily: "monospace" }}>AI ANALYST SUMMARY</div>
                    <span style={{ fontSize: 10, padding: "3px 9px", background: "rgba(251,191,36,0.1)", color: "#fbbf24", borderRadius: 4, fontFamily: "monospace" }}>claude-sonnet-4</span>
                  </div>
                  {aiLoading ? <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", fontFamily: "monospace", fontSize: 13 }}><span className="spin">⟳</span><span className="pulse">Writing analyst summary…</span></div>
                    : <p style={{ fontSize: 15, lineHeight: 1.85, color: "#d1d5db" }}>{aiSummary}</p>}
                </div>
                <div style={{ marginTop: 20, fontSize: 10, color: "#374151", textAlign: "center", fontFamily: "monospace", lineHeight: 1.9 }}>For educational purposes only · Not financial advice · Data via Financial Modeling Prep · Always do your own research</div>
              </div>
            );
          })()}
          {!report && !loading && !error && (
            <div style={{ textAlign: "center", padding: "70px 0", color: "#374151" }}>
              <div style={{ fontSize: 44, marginBottom: 18, opacity: 0.25 }}>◈</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.12em" }}>ENTER A TICKER TO BEGIN — NO SIGNUP REQUIRED</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
