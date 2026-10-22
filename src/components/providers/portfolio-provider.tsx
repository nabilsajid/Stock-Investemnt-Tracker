'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Company, Transaction, MarketPrice, UserSettings, Holding, PortfolioSummary } from '@/lib/supabase/types';
import { calculatePurchase, calculateWeightedAverage, calculateMinimumSellingPrice, calculateSale, calculateUnrealized, calculatePortfolioTotals } from '@/lib/financial/calculator';
import { replayLedger, validateTransactionEdit, validateTransactionDelete } from '@/lib/financial/ledger-replay';
import type { RawTransaction } from '@/lib/financial/ledger-replay';
import { toDecimal, isZero, round2, round4, ZERO } from '@/lib/financial/decimal';
import type { User } from '@supabase/supabase-js';

interface PortfolioContextType {
  // Auth
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Data
  companies: Company[];
  transactions: Transaction[];
  marketPrices: MarketPrice[];
  settings: UserSettings | null;
  holdings: Holding[];
  portfolioSummary: PortfolioSummary;

  // Actions
  addPurchase: (data: {
    companyName: string;
    symbol: string;
    exchange: 'DSE' | 'CSE';
    quantity: number;
    pricePerShare: number;
    date: string;
    brokerageRate: number;
  }) => Promise<void>;
  addSale: (data: {
    companyId: string;
    quantity: number;
    pricePerShare: number;
    date: string;
    brokerageRate: number;
  }) => Promise<void>;
  updateMarketPrice: (companyId: string, price: number) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  editTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const defaultSummary: PortfolioSummary = {
  totalSharesPurchased: '0',
  totalSharesSold: '0',
  totalAvailableShares: '0',
  cumulativePurchaseCost: '0',
  remainingInvestmentCostBasis: '0',
  remainingGrossCostBasis: '0',
  currentMarketValue: null,
  totalRealizedProfitLoss: '0',
  totalGrossRealizedProfitLoss: '0',
  totalUnrealizedProfitLoss: null,
  totalGrossUnrealizedProfitLoss: null,
  totalBrokeragePaid: '0',
  holdingsCount: 0,
};

const DEMO_USER: User = {
  id: 'usr_demo_001',
  app_metadata: {},
  user_metadata: { full_name: 'Tanvir Ahmed (Demo)' },
  aud: 'authenticated',
  created_at: '2026-09-01T00:00:00.000Z',
  email: 'demo@investor.bd',
} as unknown as User;

const INITIAL_DEMO_COMPANIES: Company[] = [
  { id: 'cmp_1', user_id: 'usr_demo_001', name: 'Grameenphone Ltd.', symbol: 'GP', exchange: 'DSE', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 'cmp_2', user_id: 'usr_demo_001', name: 'Square Pharmaceuticals Ltd.', symbol: 'SQURPHARMA', exchange: 'DSE', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 'cmp_3', user_id: 'usr_demo_001', name: 'BRAC Bank PLC', symbol: 'BRACBANK', exchange: 'DSE', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 'cmp_4', user_id: 'usr_demo_001', name: 'British American Tobacco Bangladesh', symbol: 'BATBC', exchange: 'DSE', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 'cmp_5', user_id: 'usr_demo_001', name: 'Beximco Pharmaceuticals Ltd.', symbol: 'BEXIMCO', exchange: 'DSE', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
];

const INITIAL_DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn_1',
    user_id: 'usr_demo_001',
    company_id: 'cmp_1',
    type: 'BUY',
    date: '2026-10-01',
    quantity: 100,
    price_per_share: 245.5,
    gross_amount: 24550,
    brokerage_rate: 0.005,
    brokerage_amount: 122.75,
    net_amount: 24672.75,
    cost_basis_of_sold: null,
    realized_profit_loss: null,
    pre_sale_avg_cost: null,
    additional_charges: 0,
    additional_charges_note: null,
    notes: 'Initial position acquisition on DSE',
    sequence: 1,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 'txn_2',
    user_id: 'usr_demo_001',
    company_id: 'cmp_2',
    type: 'BUY',
    date: '2026-10-05',
    quantity: 150,
    price_per_share: 218.0,
    gross_amount: 32700,
    brokerage_rate: 0.005,
    brokerage_amount: 163.5,
    net_amount: 32863.5,
    cost_basis_of_sold: null,
    realized_profit_loss: null,
    pre_sale_avg_cost: null,
    additional_charges: 0,
    additional_charges_note: null,
    notes: 'Long-term pharma core position',
    sequence: 1,
    created_at: '2026-10-05T00:00:00Z',
    updated_at: '2026-10-05T00:00:00Z',
  },
  {
    id: 'txn_3',
    user_id: 'usr_demo_001',
    company_id: 'cmp_1',
    type: 'SELL',
    date: '2026-10-10',
    quantity: 40,
    price_per_share: 272.0,
    gross_amount: 10880,
    brokerage_rate: 0.005,
    brokerage_amount: 54.4,
    net_amount: 10825.6,
    cost_basis_of_sold: 9869.1,
    realized_profit_loss: 956.5,
    pre_sale_avg_cost: 246.7275,
    additional_charges: 0,
    additional_charges_note: null,
    notes: 'Partial profit booking at target',
    sequence: 1,
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  },
  {
    id: 'txn_4',
    user_id: 'usr_demo_001',
    company_id: 'cmp_3',
    type: 'BUY',
    date: '2026-10-12',
    quantity: 500,
    price_per_share: 48.2,
    gross_amount: 24100,
    brokerage_rate: 0.005,
    brokerage_amount: 120.5,
    net_amount: 24220.5,
    cost_basis_of_sold: null,
    realized_profit_loss: null,
    pre_sale_avg_cost: null,
    additional_charges: 0,
    additional_charges_note: null,
    notes: 'Banking sector high-yield investment',
    sequence: 1,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
  },
  {
    id: 'txn_5',
    user_id: 'usr_demo_001',
    company_id: 'cmp_4',
    type: 'BUY',
    date: '2026-10-15',
    quantity: 50,
    price_per_share: 360.0,
    gross_amount: 18000,
    brokerage_rate: 0.005,
    brokerage_amount: 90.0,
    net_amount: 18090.0,
    cost_basis_of_sold: null,
    realized_profit_loss: null,
    pre_sale_avg_cost: null,
    additional_charges: 0,
    additional_charges_note: null,
    notes: 'FMCG blue-chip allocation',
    sequence: 1,
    created_at: '2026-10-15T00:00:00Z',
    updated_at: '2026-10-15T00:00:00Z',
  },
];

const INITIAL_DEMO_PRICES: MarketPrice[] = [
  { id: 'prc_1', user_id: 'usr_demo_001', company_id: 'cmp_1', price: 268.0, updated_at: '2026-10-18T10:00:00Z' },
  { id: 'prc_2', user_id: 'usr_demo_001', company_id: 'cmp_2', price: 224.5, updated_at: '2026-10-18T10:00:00Z' },
  { id: 'prc_3', user_id: 'usr_demo_001', company_id: 'cmp_3', price: 51.0, updated_at: '2026-10-18T10:00:00Z' },
  { id: 'prc_4', user_id: 'usr_demo_001', company_id: 'cmp_4', price: 372.0, updated_at: '2026-10-18T10:00:00Z' },
  { id: 'prc_5', user_id: 'usr_demo_001', company_id: 'cmp_5', price: 118.0, updated_at: '2026-10-18T10:00:00Z' },
];

const INITIAL_DEMO_SETTINGS: UserSettings = {
  id: 'stg_1',
  user_id: 'usr_demo_001',
  default_buying_brokerage_rate: 0.005,
  default_selling_brokerage_rate: 0.005,
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  theme: 'light',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

function enrichTransactionsWithReplay(
  txns: Transaction[],
  comps: Company[]
): Transaction[] {
  const result: Transaction[] = [];
  const processedIds = new Set<string>();

  for (const company of comps) {
    const companyTxns = txns
      .filter((t) => t.company_id === company.id)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.sequence || 0) - (b.sequence || 0);
      });

    if (companyTxns.length === 0) continue;

    const rawTxns: RawTransaction[] = companyTxns.map((t) => ({
      id: t.id,
      type: t.type,
      date: t.date,
      quantity: t.quantity,
      pricePerShare: t.price_per_share,
      brokerageRate: t.brokerage_rate,
      sequence: t.sequence,
    }));

    const { transactionStates } = replayLedger(rawTxns);

    for (const t of companyTxns) {
      processedIds.add(t.id);
      const state = transactionStates.get(t.id);
      if (t.type === 'SELL' && state) {
        result.push({
          ...t,
          gross_realized_profit_loss:
            state.lastGrossRealizedPL !== undefined ? parseFloat(state.lastGrossRealizedPL) : null,
          pre_sale_avg_gross_price:
            state.averagePurchasePriceGross !== undefined ? parseFloat(state.averagePurchasePriceGross) : null,
        });
      } else {
        result.push(t);
      }
    }
  }

  for (const t of txns) {
    if (!processedIds.has(t.id)) {
      result.push(t);
    }
  }

  return result;
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured] = useState(() => isSupabaseConfigured());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>(defaultSummary);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Get or create Supabase client
  const getSupabase = useCallback(() => {
    if (!isConfigured) return null;
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, [isConfigured]);

  // Compute holdings from transactions
  const computeHoldings = useCallback(
    (comps: Company[], txns: Transaction[], prices: MarketPrice[], sellingBrokerageRate: number = 0.005): Holding[] => {
      const holdingsList: Holding[] = [];

      for (const company of comps) {
        const companyTxns = txns
          .filter((t) => t.company_id === company.id)
          .sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.sequence - b.sequence;
          });

        if (companyTxns.length === 0) continue;

        // Convert to RawTransaction for replay
        const rawTxns: RawTransaction[] = companyTxns.map((t) => ({
          id: t.id,
          type: t.type,
          date: t.date,
          quantity: t.quantity,
          pricePerShare: t.price_per_share,
          brokerageRate: t.brokerage_rate,
          sequence: t.sequence,
        }));

        const replayResult = replayLedger(rawTxns);
        const { finalState } = replayResult;

        const availableShares = parseInt(finalState.availableShares, 10);
        const priceRecord = prices.find((p) => p.company_id === company.id) || null;
        const marketPriceVal = priceRecord ? priceRecord.price : null;

        // Minimum selling price (break-even)
        const minSelling = calculateMinimumSellingPrice(
          finalState.averagePurchasePrice,
          sellingBrokerageRate
        );

        // Unrealized P/L
        const unrealized = calculateUnrealized(
          finalState.availableShares,
          finalState.costBasis,
          marketPriceVal,
          sellingBrokerageRate,
          priceRecord?.updated_at || null,
          finalState.grossCostBasis
        );

        holdingsList.push({
          company,
          availableShares,
          totalSharesPurchased: parseInt(finalState.totalSharesPurchased, 10),
          totalSharesSold: parseInt(finalState.totalSharesSold, 10),
          weightedAverageCost: finalState.averagePurchasePrice,
          weightedAverageGrossPrice: finalState.averagePurchasePriceGross || finalState.averagePurchasePrice,
          remainingCostBasis: finalState.costBasis,
          remainingGrossCost: finalState.grossCostBasis || finalState.costBasis,
          cumulativePurchaseCost: finalState.cumulativePurchaseCost,
          breakEvenPrice: minSelling.breakEvenPrice,
          totalRealizedPL: finalState.totalRealizedPL,
          totalGrossRealizedPL: finalState.totalGrossRealizedPL || finalState.totalRealizedPL,
          totalBrokerage: finalState.totalBrokeragePaid,
          marketPrice: priceRecord,
          currentMarketValue: unrealized?.currentMarketValue || null,
          unrealizedPL: unrealized?.unrealizedProfitLoss || null,
          unrealizedPLPercent: unrealized?.unrealizedProfitLossPercent || null,
          grossUnrealizedPL: unrealized?.grossUnrealizedProfitLoss || null,
          grossUnrealizedPLPercent: unrealized?.grossUnrealizedProfitLossPercent || null,
        });
      }

      return holdingsList;
    },
    []
  );

  // Compute portfolio summary from holdings
  const computePortfolioSummary = useCallback((holdingsList: Holding[]): PortfolioSummary => {
    const portfolioData = holdingsList.map((h) => ({
      totalPurchased: String(h.totalSharesPurchased),
      totalSold: String(h.totalSharesSold),
      available: String(h.availableShares),
      cumulativeCost: h.cumulativePurchaseCost,
      remainingCostBasis: h.remainingCostBasis,
      remainingGrossCost: h.remainingGrossCost,
      currentMarketValue: h.currentMarketValue,
      realizedPL: h.totalRealizedPL,
      grossRealizedPL: h.totalGrossRealizedPL,
      unrealizedPL: h.unrealizedPL,
      grossUnrealizedPL: h.grossUnrealizedPL,
      totalBrokerage: h.totalBrokerage,
    }));

    const totals = calculatePortfolioTotals(portfolioData);
    return {
      ...totals,
      holdingsCount: holdingsList.filter((h) => h.availableShares > 0).length,
    };
  }, []);

  // Fetch all data from Supabase or Local Demo
  const fetchData = useCallback(async () => {
    if (!isConfigured) {
      // Load demo data from localStorage if exists
      let comps = INITIAL_DEMO_COMPANIES;
      let txns = INITIAL_DEMO_TRANSACTIONS;
      let prices = INITIAL_DEMO_PRICES;
      let userSettings = INITIAL_DEMO_SETTINGS;

      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('stocktracker_demo_state');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.companies) comps = parsed.companies;
            if (parsed.transactions) txns = parsed.transactions;
            if (parsed.marketPrices) prices = parsed.marketPrices;
            if (parsed.settings) userSettings = parsed.settings;
          }
        } catch (e) {
          console.warn('Could not parse demo storage:', e);
        }
      }

      setCompanies(comps);
      setTransactions(enrichTransactionsWithReplay(txns, comps));
      setMarketPrices(prices);
      setSettings(userSettings);

      const sellingRate = userSettings?.default_selling_brokerage_rate || 0.005;
      const holdingsList = computeHoldings(comps, txns, prices, sellingRate);
      setHoldings(holdingsList);
      setPortfolioSummary(computePortfolioSummary(holdingsList));
      return;
    }

    const supabase = getSupabase();
    if (!supabase || !user) return;

    try {
      const [companiesRes, transactionsRes, pricesRes, settingsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('user_id', user.id).order('name'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: true }).order('sequence', { ascending: true }),
        supabase.from('market_prices').select('*').eq('user_id', user.id),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      const comps = (companiesRes.data || []) as Company[];
      const txns = (transactionsRes.data || []) as Transaction[];
      const prices = (pricesRes.data || []) as MarketPrice[];
      let userSettings = settingsRes.data as UserSettings | null;

      if (!userSettings) {
        try {
          const { data: newSettings } = await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              default_buying_brokerage_rate: 0.005,
              default_selling_brokerage_rate: 0.005,
              currency: 'BDT',
              timezone: 'Asia/Dhaka',
              theme: 'light',
            })
            .select()
            .single();
          if (newSettings) userSettings = newSettings as UserSettings;
        } catch (e) {
          console.warn('Could not auto-create user_settings:', e);
        }
      }

      setCompanies(comps);
      setTransactions(enrichTransactionsWithReplay(txns, comps));
      setMarketPrices(prices);
      setSettings(userSettings);

      const sellingRate = userSettings?.default_selling_brokerage_rate || 0.005;
      const holdingsList = computeHoldings(comps, txns, prices, sellingRate);
      setHoldings(holdingsList);
      setPortfolioSummary(computePortfolioSummary(holdingsList));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, [isConfigured, user, getSupabase, computeHoldings, computePortfolioSummary]);

  // Auth initialization
  useEffect(() => {
    if (!isConfigured) {
      setUser(DEMO_USER);
      fetchData();
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isConfigured, getSupabase]);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      fetchData();
    } else if (isConfigured) {
      setCompanies([]);
      setTransactions([]);
      setMarketPrices([]);
      setSettings(null);
      setHoldings([]);
      setPortfolioSummary(defaultSummary);
    }
  }, [user, isConfigured, fetchData]);

  // Save demo state helper
  const saveDemoState = useCallback((newComps: Company[], newTxns: Transaction[], newPrices: MarketPrice[], newSettings?: UserSettings) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'stocktracker_demo_state',
          JSON.stringify({
            companies: newComps,
            transactions: newTxns,
            marketPrices: newPrices,
            settings: newSettings || settings,
          })
        );
      } catch (e) {
        console.warn('Failed to save demo state:', e);
      }
    }
  }, [settings]);

  // Realtime subscriptions
  useEffect(() => {
    if (!isConfigured || !user) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('portfolio-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies', filter: `user_id=eq.${user.id}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'market_prices', filter: `user_id=eq.${user.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConfigured, user, getSupabase, fetchData]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        setLoading(false);
      }
    },
    [getSupabase]
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      if (data?.user && data?.session) {
        setUser(data.user);
        setLoading(false);
      }
    },
    [getSupabase]
  );

  const signOut = useCallback(async () => {
    if (!isConfigured) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, [isConfigured, getSupabase]);

  const addPurchase = useCallback(
    async (data: {
      companyName: string;
      symbol: string;
      exchange: 'DSE' | 'CSE';
      quantity: number;
      pricePerShare: number;
      date: string;
      brokerageRate: number;
    }) => {
      const calc = calculatePurchase(data.quantity, data.pricePerShare, data.brokerageRate);

      if (!isConfigured) {
        // Local Demo Mode Add Purchase
        let company = companies.find((c) => c.symbol === data.symbol && c.exchange === data.exchange);
        let updatedComps = [...companies];
        if (!company) {
          company = {
            id: `cmp_${Date.now()}`,
            user_id: 'usr_demo_001',
            name: data.companyName,
            symbol: data.symbol,
            exchange: data.exchange,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          updatedComps.push(company);
        }

        const newTxn: Transaction = {
          id: `txn_${Date.now()}`,
          user_id: 'usr_demo_001',
          company_id: company.id,
          type: 'BUY',
          date: data.date,
          quantity: data.quantity,
          price_per_share: data.pricePerShare,
          gross_amount: parseFloat(calc.grossAmount),
          brokerage_rate: data.brokerageRate,
          brokerage_amount: parseFloat(calc.brokerageAmount),
          net_amount: parseFloat(calc.totalCost),
          cost_basis_of_sold: null,
          realized_profit_loss: null,
          pre_sale_avg_cost: null,
          additional_charges: 0,
          additional_charges_note: null,
          notes: 'Purchase entry',
          sequence: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedTxns = [...transactions, newTxn];
        setCompanies(updatedComps);
        setTransactions(enrichTransactionsWithReplay(updatedTxns, updatedComps));
        saveDemoState(updatedComps, updatedTxns, marketPrices);

        const sellingRate = settings?.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(updatedComps, updatedTxns, marketPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      // Find or create company
      let company = companies.find(
        (c) => c.symbol === data.symbol && c.exchange === data.exchange
      );

      if (!company) {
        const { data: newCompany, error } = await supabase
          .from('companies')
          .insert({
            user_id: user.id,
            name: data.companyName,
            symbol: data.symbol,
            exchange: data.exchange,
          })
          .select()
          .single();

        if (error) throw error;
        company = newCompany as Company;
      }

      const { error: txnError } = await supabase.from('transactions').insert({
        user_id: user.id,
        company_id: company.id,
        type: 'BUY',
        date: data.date,
        quantity: data.quantity,
        price_per_share: data.pricePerShare,
        gross_amount: parseFloat(calc.grossAmount),
        brokerage_rate: data.brokerageRate,
        brokerage_amount: parseFloat(calc.brokerageAmount),
        net_amount: parseFloat(calc.totalCost),
      });

      if (txnError) throw txnError;

      await fetchData();
    },
    [isConfigured, user, companies, transactions, marketPrices, settings, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, fetchData]
  );

  const addSale = useCallback(
    async (data: {
      companyId: string;
      quantity: number;
      pricePerShare: number;
      date: string;
      brokerageRate: number;
    }) => {
      const holding = holdings.find((h) => h.company.id === data.companyId);
      if (!holding) throw new Error('Company not found in holdings');
      if (data.quantity > holding.availableShares) {
        throw new Error(`Cannot sell ${data.quantity} shares. Only ${holding.availableShares} available.`);
      }

      const calc = calculateSale(
        data.quantity,
        data.pricePerShare,
        holding.weightedAverageCost,
        String(holding.availableShares),
        holding.remainingCostBasis,
        data.brokerageRate
      );

      if (!isConfigured) {
        const newTxn: Transaction = {
          id: `txn_${Date.now()}`,
          user_id: 'usr_demo_001',
          company_id: data.companyId,
          type: 'SELL',
          date: data.date,
          quantity: data.quantity,
          price_per_share: data.pricePerShare,
          gross_amount: parseFloat(calc.grossSellingAmount),
          brokerage_rate: data.brokerageRate,
          brokerage_amount: parseFloat(calc.sellingBrokerageAmount),
          net_amount: parseFloat(calc.netSellingAmount),
          cost_basis_of_sold: parseFloat(calc.costBasisOfSharesSold),
          realized_profit_loss: parseFloat(calc.realizedProfitLoss),
          pre_sale_avg_cost: parseFloat(calc.preSaleAverageCost),
          additional_charges: 0,
          additional_charges_note: null,
          notes: 'Sale entry',
          sequence: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedTxns = [...transactions, newTxn];
        setTransactions(enrichTransactionsWithReplay(updatedTxns, companies));
        saveDemoState(companies, updatedTxns, marketPrices);

        const sellingRate = settings?.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(companies, updatedTxns, marketPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error: txnError } = await supabase.from('transactions').insert({
        user_id: user.id,
        company_id: data.companyId,
        type: 'SELL',
        date: data.date,
        quantity: data.quantity,
        price_per_share: data.pricePerShare,
        gross_amount: parseFloat(calc.grossSellingAmount),
        brokerage_rate: data.brokerageRate,
        brokerage_amount: parseFloat(calc.sellingBrokerageAmount),
        net_amount: parseFloat(calc.netSellingAmount),
        cost_basis_of_sold: parseFloat(calc.costBasisOfSharesSold),
        realized_profit_loss: parseFloat(calc.realizedProfitLoss),
        pre_sale_avg_cost: parseFloat(calc.preSaleAverageCost),
      });

      if (txnError) throw txnError;

      await fetchData();
    },
    [isConfigured, user, holdings, transactions, companies, marketPrices, settings, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, fetchData]
  );

  const updateMarketPrice = useCallback(
    async (companyId: string, price: number) => {
      if (!isConfigured) {
        let updatedPrices = [...marketPrices];
        const existingIdx = updatedPrices.findIndex((p) => p.company_id === companyId);
        const newRecord: MarketPrice = {
          id: `prc_${companyId}`,
          user_id: 'usr_demo_001',
          company_id: companyId,
          price,
          updated_at: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          updatedPrices[existingIdx] = newRecord;
        } else {
          updatedPrices.push(newRecord);
        }

        setMarketPrices(updatedPrices);
        saveDemoState(companies, transactions, updatedPrices);

        const sellingRate = settings?.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(companies, transactions, updatedPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('market_prices').upsert(
        {
          user_id: user.id,
          company_id: companyId,
          price,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,company_id' }
      );

      if (error) throw error;

      await supabase.from('market_price_history').insert({
        user_id: user.id,
        company_id: companyId,
        price,
      });

      await fetchData();
    },
    [isConfigured, user, marketPrices, companies, transactions, settings, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, fetchData]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      if (!isConfigured) {
        const merged: UserSettings = {
          ...(settings || INITIAL_DEMO_SETTINGS),
          ...newSettings,
          updated_at: new Date().toISOString(),
        };
        setSettings(merged);
        saveDemoState(companies, transactions, marketPrices, merged);

        const sellingRate = merged.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(companies, transactions, marketPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      await fetchData();
    },
    [isConfigured, user, settings, companies, transactions, marketPrices, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, fetchData]
  );

  const recomputeCompanySales = useCallback(
    async (companyId: string) => {
      const supabase = getSupabase();
      if (!supabase || !user) return;

      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('sequence', { ascending: true });

      if (!txns || txns.length === 0) return;

      const rawTxns: RawTransaction[] = txns.map((t) => ({
        id: t.id,
        type: t.type,
        date: t.date,
        quantity: t.quantity,
        pricePerShare: t.price_per_share,
        brokerageRate: t.brokerage_rate,
        sequence: t.sequence,
      }));

      const replayResult = replayLedger(rawTxns);
      if (!replayResult.valid) return;

      for (const txn of txns) {
        if (txn.type !== 'SELL') continue;

        const stateBefore = replayResult.transactionStates.get(txn.id);
        const preSaleAvgCost = stateBefore?.averagePurchasePrice || '0';

        const saleCalc = calculateSale(
          txn.quantity,
          txn.price_per_share,
          preSaleAvgCost,
          stateBefore?.availableShares || '0',
          stateBefore?.costBasis || '0',
          txn.brokerage_rate
        );

        await supabase
          .from('transactions')
          .update({
            cost_basis_of_sold: parseFloat(saleCalc.costBasisOfSharesSold),
            realized_profit_loss: parseFloat(saleCalc.realizedProfitLoss),
            pre_sale_avg_cost: parseFloat(preSaleAvgCost),
          })
          .eq('id', txn.id);
      }
    },
    [user, getSupabase]
  );

  const editTransaction = useCallback(
    async (id: string, data: Partial<Transaction>) => {
      const existingTxn = transactions.find((t) => t.id === id);
      if (!existingTxn) throw new Error('Transaction not found');

      const updatedTxn: RawTransaction = {
        id,
        type: (data.type || existingTxn.type) as 'BUY' | 'SELL',
        date: data.date || existingTxn.date,
        quantity: data.quantity ?? existingTxn.quantity,
        pricePerShare: data.price_per_share ?? existingTxn.price_per_share,
        brokerageRate: data.brokerage_rate ?? existingTxn.brokerage_rate,
        sequence: data.sequence ?? existingTxn.sequence,
      };

      const companyTxns = transactions
        .filter((t) => t.company_id === existingTxn.company_id)
        .map((t) => ({
          id: t.id,
          type: t.type as 'BUY' | 'SELL',
          date: t.date,
          quantity: t.quantity,
          pricePerShare: t.price_per_share,
          brokerageRate: t.brokerage_rate,
          sequence: t.sequence,
        }));

      const result = validateTransactionEdit(companyTxns, updatedTxn);
      if (!result.valid) {
        throw new Error(result.error || 'Edit creates invalid transaction history');
      }

      const calc = updatedTxn.type === 'BUY'
        ? calculatePurchase(updatedTxn.quantity, updatedTxn.pricePerShare, updatedTxn.brokerageRate)
        : null;

      if (!isConfigured) {
        const updatedTxns: Transaction[] = transactions.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            type: updatedTxn.type,
            date: updatedTxn.date,
            quantity: updatedTxn.quantity,
            price_per_share: updatedTxn.pricePerShare,
            brokerage_rate: updatedTxn.brokerageRate,
            sequence: updatedTxn.sequence ?? t.sequence,
            gross_amount: updatedTxn.quantity * updatedTxn.pricePerShare,
            brokerage_amount: updatedTxn.quantity * updatedTxn.pricePerShare * updatedTxn.brokerageRate,
            net_amount: calc ? parseFloat(calc.totalCost) : t.net_amount,
            notes: data.notes ?? t.notes,
          };
        });

        setTransactions(enrichTransactionsWithReplay(updatedTxns, companies));
        saveDemoState(companies, updatedTxns, marketPrices);

        const sellingRate = settings?.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(companies, updatedTxns, marketPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {
        type: updatedTxn.type,
        date: updatedTxn.date,
        quantity: updatedTxn.quantity,
        price_per_share: updatedTxn.pricePerShare,
        brokerage_rate: updatedTxn.brokerageRate,
        sequence: updatedTxn.sequence,
        gross_amount: updatedTxn.quantity * updatedTxn.pricePerShare,
        brokerage_amount: updatedTxn.quantity * updatedTxn.pricePerShare * updatedTxn.brokerageRate,
      };

      if (updatedTxn.type === 'BUY' && calc) {
        updateData.net_amount = parseFloat(calc.totalCost);
        updateData.cost_basis_of_sold = null;
        updateData.realized_profit_loss = null;
        updateData.pre_sale_avg_cost = null;
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await recomputeCompanySales(existingTxn.company_id);
      await fetchData();
    },
    [isConfigured, user, transactions, companies, marketPrices, settings, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, recomputeCompanySales, fetchData]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const existingTxn = transactions.find((t) => t.id === id);
      if (!existingTxn) throw new Error('Transaction not found');

      const companyTxns = transactions
        .filter((t) => t.company_id === existingTxn.company_id)
        .map((t) => ({
          id: t.id,
          type: t.type as 'BUY' | 'SELL',
          date: t.date,
          quantity: t.quantity,
          pricePerShare: t.price_per_share,
          brokerageRate: t.brokerage_rate,
          sequence: t.sequence,
        }));

      const result = validateTransactionDelete(companyTxns, id);
      if (!result.valid) {
        throw new Error(result.error || 'Deletion creates invalid transaction history');
      }

      if (!isConfigured) {
        const updatedTxns = transactions.filter((t) => t.id !== id);
        const remainingForCompany = updatedTxns.filter((t) => t.company_id === existingTxn.company_id);
        const updatedComps = remainingForCompany.length === 0
          ? companies.filter((c) => c.id !== existingTxn.company_id)
          : companies;
        setTransactions(enrichTransactionsWithReplay(updatedTxns, updatedComps));
        setCompanies(updatedComps);
        saveDemoState(updatedComps, updatedTxns, marketPrices);

        const sellingRate = settings?.default_selling_brokerage_rate || 0.005;
        const holdingsList = computeHoldings(updatedComps, updatedTxns, marketPrices, sellingRate);
        setHoldings(holdingsList);
        setPortfolioSummary(computePortfolioSummary(holdingsList));
        return;
      }

      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;

      // Clean up orphaned company if no other transactions exist for this company
      const remainingForCompany = transactions.filter(
        (t) => t.company_id === existingTxn.company_id && t.id !== id
      );
      if (remainingForCompany.length === 0) {
        try {
          await supabase.from('companies').delete().eq('id', existingTxn.company_id);
        } catch (e) {
          console.warn('Could not auto-cleanup company:', e);
        }
      }

      await recomputeCompanySales(existingTxn.company_id);
      await fetchData();
    },
    [isConfigured, user, transactions, companies, marketPrices, settings, saveDemoState, computeHoldings, computePortfolioSummary, getSupabase, recomputeCompanySales, fetchData]
  );

  const value: PortfolioContextType = {
    user,
    loading,
    isConfigured,
    signIn,
    signUp,
    signOut,
    companies,
    transactions,
    marketPrices,
    settings,
    holdings,
    portfolioSummary,
    addPurchase,
    addSale,
    updateMarketPrice,
    updateSettings,
    editTransaction,
    deleteTransaction,
    refreshData: fetchData,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
