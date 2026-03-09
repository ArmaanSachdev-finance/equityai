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
    const [quote, profile, income, cashflow, balance] = await Promise.all([
      quoteRes.json(), profileRes.json(), incomeRes.json(), cashflowRes.json(), balanceRes.json(),
    ]);
    if (!Array.isArray(profile) || profile.length === 0) {
      return res.status(404).json({ error: `Ticker "${t}" not found. Try AAPL, MSFT, or NVDA.` });
    }
    res.status(200).json({ quote, profile, income, cashflow, balance, ratios: [] });
  } catch (e) {
    res.status(500).json({ error: "Server error: " + e.message });
  }
}
