// api/stock.js
// This file runs on Vercel's servers — your FMP_API_KEY is never exposed to users

export default async function handler(req, res) {
  // Allow requests from your own site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  const key = process.env.FMP_API_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured on server" });

  const t = ticker.toUpperCase();
  const base = "https://financialmodelingprep.com/api/v3";

  try {
    const [profile, income, cashflow, balance, quote, ratios] = await Promise.all([
      fetch(`${base}/profile/${t}?apikey=${key}`).then(r => r.json()),
      fetch(`${base}/income-statement/${t}?limit=2&apikey=${key}`).then(r => r.json()),
      fetch(`${base}/cash-flow-statement/${t}?limit=1&apikey=${key}`).then(r => r.json()),
      fetch(`${base}/balance-sheet-statement/${t}?limit=1&apikey=${key}`).then(r => r.json()),
      fetch(`${base}/quote/${t}?apikey=${key}`).then(r => r.json()),
      fetch(`${base}/ratios-ttm/${t}?apikey=${key}`).then(r => r.json()),
    ]);

    if (!profile?.length) {
      return res.status(404).json({ error: `Ticker "${t}" not found. Check the symbol and try again.` });
    }

    // Return all raw data to the frontend
    res.status(200).json({ profile, income, cashflow, balance, quote, ratios });

  } catch (e) {
    res.status(500).json({ error: "Failed to fetch financial data. Please try again." });
  }
}
