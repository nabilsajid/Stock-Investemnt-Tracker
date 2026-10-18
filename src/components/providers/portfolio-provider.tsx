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
  currentMarketValue: null,
  totalRealizedProfitLoss: '0',
  totalUnrealizedProfitLoss: null,
  totalBrokeragePaid: '0',
  holdingsCount: 0,
};

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

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

        // Use the replay engine for accurate calculations
        const rawTxns: RawTransaction[] = companyTxns.map((t) => ({
          id: t.id,
          type: t.type,
          date: t.date,
          quantity: t.quantity,
          pricePerShare: t.price_per_share,
          brokerageRate: t.brokerage_rate,
          sequence: t.sequence,
        }));

        const result = replayLedger(rawTxns);
        if (!result.valid) continue;

        const state = result.finalState;
        const availableShares = parseFloat(state.availableShares);

        if (availableShares <= 0 && parseFloat(state.totalRealizedPL) === 0) continue;

        const marketPrice = prices.find((p) => p.company_id === company.id) || null;
        const breakEven = availableShares > 0
          ? calculateMinimumSellingPrice(state.averagePurchasePrice, sellingBrokerageRate)
          : null;

        const unrealized = availableShares > 0
          ? calculateUnrealized(
            state.availableShares,
            state.costBasis,
            marketPrice ? String(marketPrice.price) : null,
            sellingBrokerageRate,
            marketPrice?.updated_at || null
          )
          : null;

        holdingsList.push({
          company,
          totalSharesPurchased: parseFloat(state.totalSharesPurchased),
          totalSharesSold: parseFloat(state.totalSharesSold),
          availableShares,
          weightedAverageCost: availableShares > 0 ? state.averagePurchasePrice : '0.00',
          breakEvenPrice: breakEven ? breakEven.breakEvenPrice : '0.00',
          remainingCostBasis: state.costBasis,
          cumulativePurchaseCost: state.cumulativePurchaseCost,
          totalRealizedPL: state.totalRealizedPL,
          totalBrokerage: state.totalBrokeragePaid,
          marketPrice,
          currentMarketValue: unrealized?.currentMarketValue || null,
          unrealizedPL: unrealized?.unrealizedProfitLoss || null,
          unrealizedPLPercent: unrealized?.unrealizedProfitLossPercent || null,
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
      currentMarketValue: h.currentMarketValue,
      realizedPL: h.totalRealizedPL,
      unrealizedPL: h.unrealizedPL,
      totalBrokerage: h.totalBrokerage,
    }));

    const totals = calculatePortfolioTotals(portfolioData);
    return {
      ...totals,
      holdingsCount: holdingsList.filter((h) => h.availableShares > 0).length,
    };
  }, []);

  // Fetch all data from Supabase
  const fetchData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) return;

    try {
      const [companiesRes, transactionsRes, pricesRes, settingsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('user_id', user.id).order('name'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: true }).order('sequence', { ascending: true }),
        supabase.from('market_prices').select('*').eq('user_id', user.id),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      ]);

      const comps = (companiesRes.data || []) as Company[];
      const txns = (transactionsRes.data || []) as Transaction[];
      const prices = (pricesRes.data || []) as MarketPrice[];
      const userSettings = settingsRes.data as UserSettings | null;

      setCompanies(comps);
      setTransactions(txns);
      setMarketPrices(prices);
      setSettings(userSettings);

      const sellingRate = userSettings?.default_selling_brokerage_rate || 0.005;
      const holdingsList = computeHoldings(comps, txns, prices, sellingRate);
      setHoldings(holdingsList);
      setPortfolioSummary(computePortfolioSummary(holdingsList));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, [user, getSupabase, computeHoldings, computePortfolioSummary]);

  // Auth initialization
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [isConfigured, getSupabase]);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setCompanies([]);
      setTransactions([]);
      setMarketPrices([]);
      setSettings(null);
      setHoldings([]);
      setPortfolioSummary(defaultSummary);
    }
  }, [user, fetchData]);

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

  // Window focus refetch
  useEffect(() => {
    const handleFocus = () => {
      if (user) fetchData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, fetchData]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [getSupabase]
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
    },
    [getSupabase]
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [getSupabase]);

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

      // Calculate transaction amounts
      const calc = calculatePurchase(data.quantity, data.pricePerShare, data.brokerageRate);

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
    [user, companies, getSupabase, fetchData]
  );

  const addSale = useCallback(
    async (data: {
      companyId: string;
      quantity: number;
      pricePerShare: number;
      date: string;
      brokerageRate: number;
    }) => {
      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      // Get current holding
      const holding = holdings.find((h) => h.company.id === data.companyId);
      if (!holding) throw new Error('Company not found in holdings');
      if (data.quantity > holding.availableShares) {
        throw new Error(`Cannot sell ${data.quantity} shares. Only ${holding.availableShares} available.`);
      }

      // Calculate sale amounts
      const calc = calculateSale(
        data.quantity,
        data.pricePerShare,
        holding.weightedAverageCost,
        String(holding.availableShares),
        holding.remainingCostBasis,
        data.brokerageRate
      );

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
    [user, holdings, getSupabase, fetchData]
  );

  const updateMarketPrice = useCallback(
    async (companyId: string, price: number) => {
      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      // Upsert the market price
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

      // Also insert into price history
      await supabase.from('market_price_history').insert({
        user_id: user.id,
        company_id: companyId,
        price,
      });

      await fetchData();
    },
    [user, getSupabase, fetchData]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
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
    [user, getSupabase, fetchData]
  );

  const editTransaction = useCallback(
    async (id: string, data: Partial<Transaction>) => {
      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      // Get the full existing transaction
      const existingTxn = transactions.find((t) => t.id === id);
      if (!existingTxn) throw new Error('Transaction not found');

      // Merge updated fields
      const updatedTxn: RawTransaction = {
        id,
        type: (data.type || existingTxn.type) as 'BUY' | 'SELL',
        date: data.date || existingTxn.date,
        quantity: data.quantity ?? existingTxn.quantity,
        pricePerShare: data.price_per_share ?? existingTxn.price_per_share,
        brokerageRate: data.brokerage_rate ?? existingTxn.brokerage_rate,
        sequence: data.sequence ?? existingTxn.sequence,
      };

      // Get all transactions for the same company and validate
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

      // Recalculate amounts
      const calc = updatedTxn.type === 'BUY'
        ? calculatePurchase(updatedTxn.quantity, updatedTxn.pricePerShare, updatedTxn.brokerageRate)
        : null;

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

      // Recompute all sale records for this company using the replay engine
      await recomputeCompanySales(existingTxn.company_id);
      await fetchData();
    },
    [user, transactions, getSupabase, fetchData]
  );

  const recomputeCompanySales = useCallback(
    async (companyId: string) => {
      const supabase = getSupabase();
      if (!supabase || !user) return;

      // Re-fetch all transactions for this company
      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('sequence', { ascending: true });

      if (!txns || txns.length === 0) return;

      const rawTxns: RawTransaction[] = txns.map((t: Transaction) => ({
        id: t.id,
        type: t.type as 'BUY' | 'SELL',
        date: t.date,
        quantity: t.quantity,
        pricePerShare: t.price_per_share,
        brokerageRate: t.brokerage_rate,
        sequence: t.sequence,
      }));

      const result = replayLedger(rawTxns);
      if (!result.valid) return;

      // Update all SELL transactions with recalculated values
      for (const txn of txns) {
        if (txn.type !== 'SELL') continue;
        // We need the state just before this sell to get pre_sale_avg_cost
        // Find the previous transaction in the sorted list
        const sortedRawTxns = [...rawTxns].sort((a, b) => {
          const dc = a.date.localeCompare(b.date);
          if (dc !== 0) return dc;
          if (a.type === 'BUY' && b.type === 'SELL') return -1;
          if (a.type === 'SELL' && b.type === 'BUY') return 1;
          return (a.sequence || 0) - (b.sequence || 0);
        });

        const txnIdx = sortedRawTxns.findIndex((t) => t.id === txn.id);
        let preSaleAvgCost = '0';

        if (txnIdx > 0) {
          const prevId = sortedRawTxns[txnIdx - 1].id;
          const prevState = result.transactionStates.get(prevId);
          if (prevState) {
            preSaleAvgCost = prevState.averagePurchasePrice;
          }
        } else {
          // It's the first transaction and it's a sell - shouldn't happen
          continue;
        }

        const saleCalc = calculateSale(
          txn.quantity,
          txn.price_per_share,
          preSaleAvgCost,
          String(txn.quantity + parseFloat(result.transactionStates.get(txn.id)?.availableShares || '0')),
          '0', // cost basis doesn't matter for the update fields we need
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

  const deleteTransaction = useCallback(
    async (id: string) => {
      const supabase = getSupabase();
      if (!supabase || !user) throw new Error('Not authenticated');

      const existingTxn = transactions.find((t) => t.id === id);
      if (!existingTxn) throw new Error('Transaction not found');

      // Validate deletion doesn't create invalid state
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

      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;

      // Recompute sale records
      await recomputeCompanySales(existingTxn.company_id);
      await fetchData();
    },
    [user, transactions, getSupabase, fetchData, recomputeCompanySales]
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
