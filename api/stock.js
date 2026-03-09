export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });
  const key = process.env.FMP_API_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured on server" });
  const t = ticker.toUpperCase();
  const base = "https://financialmodelingprep.com/stable";
  try {
    const [quoteRes, profileRes, incomeRes, cashflowRes, balanceRes] = await Promise.all([
      fetch(`${base}/quote?symbol=${t}&apikey=${key}`),
      fetch(`${base}/profile?symbol=${t}&apikey=${key}`),
      fetch(`${base}/income-statement?symbol=${t}&limit=2&apikey=${key}`),
      fetch(`${base}/cash-flow-statement?symbol=${t}&limit=1&apikey=${key}`),
      fetch(`${base}/balance-sheet-statement?symbol=${t}&limit=1&apikey=${key}`),
    ]);
    const [quoteText, profileText, incomeText, cashflowText, balanceText] = await Promise.all([
      quoteRes.text(), profileRes.text(), incomeRes.text(), cashflowRes.text(), balanceRes.text(),
    ]);
    const allText = [quoteText, profileText, incomeText, cashflowText, balanceText].join(" ");
    if (allText.includes("Premium") || allText.includes("Upgrade") || allText.includes("subscription")) {
      return res.status(403).json({
        error: `"${t}" requires a premium FMP plan. Try AAPL, MSFT, NVDA, GOOGL, AMZN, META, JPM, or TSLA — these work on the free plan.`,
      });
    }
    const [quote, profile, income, cashflow, balance] = [quoteText, profileText, incomeText, cashflowText, balanceText].map(text => {
      try { return JSON.parse(text); } catch { return []; }
    });
    if (!Array.isArray(profile) || profile.length === 0) {
      return res.status(404).json({ error: `Ticker "${t}" not found. Check the symbol and try again.` });
    }
    res.status(200).json({ quote, profile, income, cashflow, balance });
  } catch (e) {
    res.status(500).json({ error: "Server error: " + e.message });
  }
}
