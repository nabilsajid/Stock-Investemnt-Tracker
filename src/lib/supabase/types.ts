export type ExchangeType = 'DSE' | 'CSE';
export type TransactionType = 'BUY' | 'SELL';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  exchange: ExchangeType;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  company_id: string;
  type: TransactionType;
  date: string;
  quantity: number;
  price_per_share: number;
  gross_amount: number;
  brokerage_rate: number;
  brokerage_amount: number;
  net_amount: number;
  cost_basis_of_sold: number | null;
  realized_profit_loss: number | null;
  pre_sale_avg_cost: number | null;
  additional_charges: number;
  additional_charges_note: string | null;
  notes: string | null;
  sequence: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  company?: Company;
}

export interface MarketPrice {
  id: string;
  user_id: string;
  company_id: string;
  price: number;
  updated_at: string;
}

export interface MarketPriceHistory {
  id: string;
  user_id: string;
  company_id: string;
  price: number;
  recorded_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  default_buying_brokerage_rate: number;
  default_selling_brokerage_rate: number;
  currency: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

// Computed holding type - derived from transactions
export interface Holding {
  company: Company;
  totalSharesPurchased: number;
  totalSharesSold: number;
  availableShares: number;
  weightedAverageCost: string;
  breakEvenPrice: string;
  remainingCostBasis: string;
  cumulativePurchaseCost: string;
  totalRealizedPL: string;
  totalBrokerage: string;
  marketPrice: MarketPrice | null;
  currentMarketValue: string | null;
  unrealizedPL: string | null;
  unrealizedPLPercent: string | null;
}

// Portfolio summary type
export interface PortfolioSummary {
  totalSharesPurchased: string;
  totalSharesSold: string;
  totalAvailableShares: string;
  cumulativePurchaseCost: string;
  remainingInvestmentCostBasis: string;
  currentMarketValue: string | null;
  totalRealizedProfitLoss: string;
  totalUnrealizedProfitLoss: string | null;
  totalBrokeragePaid: string;
  holdingsCount: number;
}
