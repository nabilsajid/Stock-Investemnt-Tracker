# StockTracker - Modern Stock Investment Portfolio Tracker

A production-ready, responsive, decimal-safe personal stock investment tracker specifically tailored for the Bangladeshi stock market (**Dhaka Stock Exchange [DSE]** and **Chittagong Stock Exchange [CSE]**).

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Supabase PostgreSQL & Auth**, and **Recharts**.

---

## 🚀 Key Features

- **Bangladeshi Taka (BDT / ৳) & Asia/Dhaka Timezone**: Built-in support for Bangladeshi currency formatting, comma-grouping (Lakhs/Crores), and localized transaction dates.
- **Precision Financial Engine**: All financial math uses `decimal.js` (20 digits precision, `ROUND_HALF_UP`) to prevent floating-point inaccuracies.
- **Weighted-Average Cost Calculation**: Automatically recalculates acquisition averages including buying brokerage for multiple buys of the same stock.
- **Break-Even Minimum Selling Price**: Calculates the exact minimum share price needed to cover both purchase and selling brokerages:
  $$\text{Minimum Selling Price} = \frac{\text{Average Purchase Price}}{1 - \text{Selling Brokerage Rate}}$$
- **Partial Sales**: Accurately tracks realized profit/loss while strictly maintaining the remaining shares' acquisition cost basis.
- **Ledger Replay & Audit Engine**: Chronologically reconstructs positions, preventing invalid transactions (such as selling more shares than owned).
- **Manual Current Market Value**: Explicitly track market valuation without assuming fake prices or default values.
- **Cross-Device Cloud Sync**: Backed by Supabase PostgreSQL, Authentication, and Row-Level Security (RLS).
- **Modern Fintech UI/UX**: Responsive dashboard with KPI cards, asset allocation donut charts, P/L bar graphs, transaction history, and dark/light mode.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, PostCSS
- **UI Components**: Radix UI Primitives, Lucide Icons, class-variance-authority
- **Charts**: Recharts
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **Financial Math**: decimal.js
- **Testing**: Vitest

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested with Node v24)
- A Supabase account and project

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Update the keys with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Initialize Supabase Database
Run the migration script located at:
```
supabase/migrations/20261018000000_init_portfolio_tracker.sql
```
This migration will create the tables (`profiles`, `companies`, `transactions`, `market_prices`, `market_price_history`, `user_settings`), set up RLS policies, triggers, and enable Supabase Realtime.

### 4. Install Dependencies & Run Locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

Run the financial engine verification test suite:
```bash
npx vitest run
```

---

## 🚢 Deploying to Vercel

1. Push this repository to GitHub/GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. Under **Project Settings > Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel will automatically build the Next.js application.
