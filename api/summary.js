export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { ticker, name, metrics, dcf } = req.body;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "Anthropic API key not configured" });
  const fmt = (n, d = 1) => { if (n == null || isNaN(n)) return "N/A"; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + "B"; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M"; return n.toFixed(d); };
  const pct = n => n == null || isNaN(n) ? "N/A" : (n * 100).toFixed(1) + "%";
  const usd = n => n == null || isNaN(n) ? "N/A" : "$" + n.toFixed(2);
  const prompt = `You are a senior equity research analyst. Write a concise, professional equity research commentary for ${ticker} (${name}).
Financial Data:
- Revenue Growth (YoY): ${pct(metrics.revenueGrowth)}
- EBIT Margin: ${pct(metrics.ebitMargin)}
- Net Margin: ${pct(metrics.netMargin)}
- P/E Ratio: ${metrics.pe ? metrics.pe.toFixed(1) + "x" : "N/A"}
- EV/EBITDA: ${metrics.evEbitda ? metrics.evEbitda.toFixed(1) + "x" : "N/A"}
- Debt/Equity: ${metrics.debtEquity ? metrics.debtEquity.toFixed(2) : "N/A"}
- Free Cash Flow: ${metrics.fcf ? "$" + fmt(metrics.fcf) : "N/A"}
${dcf ? `- DCF Implied Value: ${usd(dcf.impliedPrice)} (${dcf.upside > 0 ? "+" : ""}${dcf.upside.toFixed(1)}% vs current price)` : "- DCF: Not available"}
Write 3-4 sentences covering: business quality, valuation, and key risks. Be specific. Sound like a real Wall Street analyst. End with one clear investment takeaway.`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    const summary = data.content?.map(b => b.text || "").join("") || "Summary unavailable.";
    res.status(200).json({ summary });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate summary: " + e.message });
  }
}
