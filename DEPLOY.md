# EquityAI — Deployment Guide
## From zero to live website in ~20 minutes

---

## What you have
Your project folder looks like this:

```
equityai/
├── api/
│   └── stock.js          ← Your secret backend (hides your FMP key)
├── src/
│   ├── App.jsx            ← The entire frontend
│   └── main.jsx           ← React entry point
├── index.html
├── package.json
└── vite.config.js
```

---

## Step 1 — Get your free FMP API key (2 min)

1. Go to: https://financialmodelingprep.com/developer/docs
2. Click "Get my API KEY"
3. Sign up with your email (free, no credit card)
4. Copy your API key — it looks like: `aBcDeFgH1234567`
5. Save it somewhere — you'll need it in Step 4

---

## Step 2 — Create a GitHub account & upload the code (5 min)

1. Go to https://github.com and sign up (free)
2. Click the green **"New"** button to create a repository
3. Name it: `equityai`
4. Keep it **Public**
5. Click **"Create repository"**
6. On the next page, click **"uploading an existing file"**
7. Upload ALL your files — make sure to keep the folder structure:
   - `api/stock.js`
   - `src/App.jsx`
   - `src/main.jsx`
   - `index.html`
   - `package.json`
   - `vite.config.js`
8. Click **"Commit changes"**

---

## Step 3 — Deploy to Vercel (5 min)

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **"Add New Project"**
3. Find your `equityai` repository and click **"Import"**
4. Vercel will auto-detect it as a Vite project — don't change anything
5. Click **"Deploy"** — wait about 60 seconds
6. You'll get a URL like `equityai.vercel.app` 🎉

---

## Step 4 — Add your secret FMP API key to Vercel (2 min)

This is the important step — this is what hides your key from users.

1. In Vercel, go to your project dashboard
2. Click **"Settings"** (top menu)
3. Click **"Environment Variables"** (left sidebar)
4. Click **"Add New"**
5. Fill in:
   - **Name:** `FMP_API_KEY`
   - **Value:** paste your FMP key here
6. Click **"Save"**
7. Go back to your project and click **"Redeploy"** (so it picks up the new key)

---

## Step 5 — Test it!

Open your Vercel URL, type `AAPL`, hit Analyze.
It should fetch real live data within a few seconds.

---

## Your resume bullet point

> **EquityAI** | React, Vite, Vercel, Claude AI, FMP API | [your-url.vercel.app]  
> Built a full-stack AI equity research tool that fetches live financial data, runs automated DCF 
> valuations with sensitivity analysis, and generates institutional-grade analyst summaries using 
> the Claude API. Deployed on Vercel with a serverless backend to securely manage API keys.

---

## Troubleshooting

**"Function not found" error** → Make sure `api/stock.js` is in the right folder  
**"API key not configured"** → Double-check Step 4, then redeploy  
**Ticker not found** → FMP free tier supports most major US stocks. Try AAPL, MSFT, NVDA first  
**AI summary not loading** → The Claude API call runs from the browser — this is fine for a portfolio project

---

Good luck! This is genuinely impressive for a second-year AFM student. 🚀
