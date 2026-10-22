'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Briefcase,
  Receipt,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieChartIcon,
  Calendar,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  cn,
  formatBDT,
  formatDate,
  formatNumber,
  formatPercent,
  getPLColor,
} from '@/lib/utils';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { BuyStockDialog } from '@/components/transactions/BuyStockDialog';
import { SellStockDialog } from '@/components/transactions/SellStockDialog';
import { UpdatePriceDialog } from '@/components/dialogs/update-price-dialog';

const CHART_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#84cc16', // lime
];

export default function DashboardPage() {
  const {
    portfolioSummary,
    holdings,
    transactions,
    companies,
    loading,
  } = usePortfolio();

  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedCompanyIdForPrice, setSelectedCompanyIdForPrice] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'positions' | 'chart'>('positions');
  const [profitMode, setProfitMode] = useState<'net' | 'gross'>('net');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter for active holdings (stocks with available shares > 0)
  const activeHoldings = useMemo(() => {
    return holdings.filter((h) => h.availableShares > 0);
  }, [holdings]);

  // Total shares held across all active positions
  const totalSharesHeld = useMemo(() => {
    return activeHoldings.reduce((sum, h) => sum + h.availableShares, 0);
  }, [activeHoldings]);

  // Check if any active holding is missing a market price
  const missingPriceHoldings = useMemo(() => {
    return activeHoldings.filter((h) => !h.marketPrice || !h.marketPrice.price);
  }, [activeHoldings]);

  const hasMissingPrices = missingPriceHoldings.length > 0;
  const hasLiveValuation = portfolioSummary.currentMarketValue !== null;

  // Numerical values for returns
  const investedCapitalNumber = parseFloat(portfolioSummary.remainingInvestmentCostBasis) || 0;
  const grossInvestedBasisNumber = portfolioSummary.remainingGrossCostBasis
    ? parseFloat(portfolioSummary.remainingGrossCostBasis)
    : investedCapitalNumber;

  const portfolioValuationNumber = hasLiveValuation
    ? parseFloat(portfolioSummary.currentMarketValue!)
    : investedCapitalNumber;

  // Net P/L values (after deducting buying & selling brokerage commissions)
  const netRealizedPLNumber = parseFloat(portfolioSummary.totalRealizedProfitLoss) || 0;
  const netUnrealizedPLNumber = portfolioSummary.totalUnrealizedProfitLoss !== null
    ? parseFloat(portfolioSummary.totalUnrealizedProfitLoss)
    : 0;
  const totalNetCombinedPLNumber = netRealizedPLNumber + netUnrealizedPLNumber;
  const totalNetReturnPercent = investedCapitalNumber > 0
    ? (totalNetCombinedPLNumber / investedCapitalNumber) * 100
    : 0;

  // Gross P/L values (raw price differences before deducting brokerage commissions)
  const grossRealizedPLNumber = portfolioSummary.totalGrossRealizedProfitLoss
    ? parseFloat(portfolioSummary.totalGrossRealizedProfitLoss)
    : netRealizedPLNumber;
  const grossUnrealizedPLNumber = portfolioSummary.totalGrossUnrealizedProfitLoss !== null && portfolioSummary.totalGrossUnrealizedProfitLoss !== undefined
    ? parseFloat(portfolioSummary.totalGrossUnrealizedProfitLoss)
    : 0;
  const totalGrossCombinedPLNumber = grossRealizedPLNumber + grossUnrealizedPLNumber;
  const totalGrossReturnPercent = grossInvestedBasisNumber > 0
    ? (totalGrossCombinedPLNumber / grossInvestedBasisNumber) * 100
    : 0;

  // Active view values based on selected profitMode
  const activeReturnNumber = profitMode === 'gross' ? totalGrossCombinedPLNumber : totalNetCombinedPLNumber;
  const activeReturnPercent = profitMode === 'gross' ? totalGrossReturnPercent : totalNetReturnPercent;

  // Allocation pie chart data (by remaining cost basis)
  const allocationData = useMemo(() => {
    return activeHoldings
      .filter((h) => parseFloat(h.remainingCostBasis) > 0)
      .map((h) => ({
        name: h.company.symbol,
        fullName: h.company.name,
        value: parseFloat(h.remainingCostBasis),
        shares: h.availableShares,
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeHoldings]);

  const totalAllocationValue = useMemo(() => {
    return allocationData.reduce((acc, curr) => acc + curr.value, 0);
  }, [allocationData]);

  // Profit/Loss chart data per company
  const plChartData = useMemo(() => {
    return holdings
      .map((h) => {
        const netRealized = parseFloat(h.totalRealizedPL) || 0;
        const grossRealized = h.totalGrossRealizedPL ? parseFloat(h.totalGrossRealizedPL) : netRealized;
        const netUnrealized = h.unrealizedPL !== null ? parseFloat(h.unrealizedPL) || 0 : 0;
        const grossUnrealized = h.grossUnrealizedPL !== null && h.grossUnrealizedPL !== undefined
          ? parseFloat(h.grossUnrealizedPL) || 0
          : netUnrealized;

        const realized = profitMode === 'gross' ? grossRealized : netRealized;
        const unrealized = profitMode === 'gross' ? grossUnrealized : netUnrealized;

        return {
          symbol: h.company.symbol,
          name: h.company.name,
          realized,
          unrealized,
          grossRealized,
          grossUnrealized,
          netRealized,
          netUnrealized,
          hasUnrealized: h.unrealizedPL !== null,
        };
      })
      .filter((item) => item.realized !== 0 || item.unrealized !== 0)
      .sort((a, b) => b.realized + b.unrealized - (a.realized + a.unrealized))
      .slice(0, 8);
  }, [holdings, profitMode]);

  // Last 5 transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.sequence || 0) - (a.sequence || 0);
      })
      .slice(0, 5);
  }, [transactions]);

  const handleOpenPriceModal = (companyId?: string) => {
    setSelectedCompanyIdForPrice(companyId || (activeHoldings.length > 0 ? activeHoldings[0].company.id : undefined));
    setPriceDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-5 h-96 rounded-xl" />
          <Skeleton className="lg:col-span-7 h-96 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Dashboard Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time portfolio overview &amp; performance metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Global Profit Mode Toggle (Net vs Gross) */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setProfitMode('net')}
              className={cn(
                'px-2.5 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5',
                profitMode === 'net'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Net Profit (Calculated after deducting all brokerage commission fees)"
            >
              Net Profit
            </button>
            <button
              type="button"
              onClick={() => setProfitMode('gross')}
              className={cn(
                'px-2.5 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5',
                profitMode === 'gross'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Gross Profit (Raw capital appreciation before brokerage fees)"
            >
              Gross Profit
            </button>
          </div>

          <Button
            onClick={() => handleOpenPriceModal()}
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 shadow-sm"
          >
            <TrendingUp className="w-4 h-4" />
            Update Prices
          </Button>
          <Button
            onClick={() => setBuyDialogOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Buy Stock
          </Button>
          <Button
            onClick={() => setSellDialogOpen(true)}
            variant="outline"
            className="gap-2 border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            Sell Stock
          </Button>
        </div>
      </div>

      {/* 2. Reorganized KPI Summary Cards (4 Balanced Columns, No Truncation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Portfolio Value */}
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Portfolio Value
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {formatBDT(portfolioValuationNumber)}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {hasLiveValuation ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Live Valuation
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenPriceModal()}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                  title="Click to enter current market prices"
                >
                  At Cost Basis &bull; Set Price
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {hasLiveValuation
                ? `${profitMode === 'gross' ? 'Gross' : 'Net'} Unrealized: ${formatBDT(profitMode === 'gross' ? grossUnrealizedPLNumber : netUnrealizedPLNumber)}`
                : 'Enter today&apos;s DSE prices for live valuation'}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Invested Capital */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Invested Capital
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {formatBDT(profitMode === 'gross' ? grossInvestedBasisNumber : investedCapitalNumber)}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {activeHoldings.length} Active {activeHoldings.length === 1 ? 'Position' : 'Positions'}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {profitMode === 'gross' ? '(Pure Purchase Cost)' : '(Net with Brokerage)'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {totalSharesHeld} total shares held in portfolio
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Overall Profit / Loss (Toggleable between Gross & Net) */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Overall Return
              </CardTitle>
            </div>
            {/* Pill Switcher in card header */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border/50 text-[10px]">
              <button
                type="button"
                onClick={() => setProfitMode('net')}
                className={cn(
                  'px-1.5 py-0.5 rounded font-semibold transition-all',
                  profitMode === 'net'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Net Profit (after brokerage)"
              >
                Net
              </button>
              <button
                type="button"
                onClick={() => setProfitMode('gross')}
                className={cn(
                  'px-1.5 py-0.5 rounded font-semibold transition-all',
                  profitMode === 'gross'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Gross Profit (before brokerage)"
              >
                Gross
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div
              className={`text-2xl font-extrabold tracking-tight ${getPLColor(
                activeReturnNumber
              )}`}
            >
              {activeReturnNumber >= 0 ? '+' : ''}{formatBDT(activeReturnNumber)}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                  activeReturnPercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {activeReturnPercent >= 0 ? '+' : ''}
                {activeReturnPercent.toFixed(2)}% {profitMode === 'gross' ? 'Gross' : 'Net'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {profitMode === 'gross' ? 'Before Brokerage' : 'After Brokerage'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5 truncate">
              {profitMode === 'gross'
                ? `Gross: ${formatBDT(totalGrossCombinedPLNumber)} • Net: ${formatBDT(totalNetCombinedPLNumber)}`
                : `Net: ${formatBDT(totalNetCombinedPLNumber)} • Gross: ${formatBDT(totalGrossCombinedPLNumber)}`}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Brokerage & Trading Fees */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Brokerage Paid
            </CardTitle>
            <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {formatBDT(portfolioSummary.totalBrokeragePaid)}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
                Avg 0.5% Commission
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              Incurred across {transactions.length} total trade{transactions.length === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Smart Market Price Notification Banner (When active positions need market prices) */}
      {hasMissingPrices && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-foreground">
                Set Current DSE Market Prices
              </h4>
              <p className="text-xs text-muted-foreground max-w-2xl">
                {missingPriceHoldings.map((h) => h.company.symbol).join(', ')} currently valued at purchase cost.
                Enter today&apos;s closing prices to view live market valuation and paper profit/loss.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleOpenPriceModal(missingPriceHoldings[0]?.company.id)}
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-500 shrink-0 gap-1.5 shadow-sm text-xs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Set Prices Now
          </Button>
        </div>
      )}

      {/* 4. Middle Section: Portfolio Allocation & Active Positions Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Portfolio Allocation Donut Chart */}
        <Card className="lg:col-span-5 flex flex-col shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Portfolio Allocation</CardTitle>
                <CardDescription className="text-xs">
                  Distribution of capital across active holdings
                </CardDescription>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {activeHoldings.length} {activeHoldings.length === 1 ? 'Holding' : 'Holdings'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col justify-between min-h-[320px] pt-2">
            {!isMounted ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="w-48 h-48 rounded-full" />
              </div>
            ) : allocationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <PieChartIcon className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-medium">No Active Holdings</p>
                <p className="text-xs max-w-xs">
                  Your portfolio allocation will appear here once you purchase stocks.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-full h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {allocationData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as {
                              name: string;
                              fullName: string;
                              value: number;
                              shares: number;
                            };
                            const percent =
                              totalAllocationValue > 0
                                ? (data.value / totalAllocationValue) * 100
                                : 0;
                            return (
                              <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-lg p-3 text-xs space-y-1">
                                <p className="font-semibold text-sm">{data.name}</p>
                                <p className="text-muted-foreground truncate max-w-[200px]">
                                  {data.fullName}
                                </p>
                                <div className="pt-1.5 mt-1 border-t border-border/60 space-y-0.5">
                                  <p>
                                    <span className="text-muted-foreground">Basis: </span>
                                    <span className="font-medium">{formatBDT(data.value)}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Shares: </span>
                                    <span className="font-medium">{formatNumber(data.shares)}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Share of Portfolio: </span>
                                    <span className="font-semibold text-primary">
                                      {percent.toFixed(1)}%
                                    </span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-foreground font-medium">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Holdings allocation list below chart */}
                <div className="divide-y divide-border/40 pt-2 border-t text-xs">
                  {allocationData.map((item, idx) => {
                    const percent =
                      totalAllocationValue > 0
                        ? (item.value / totalAllocationValue) * 100
                        : 0;
                    return (
                      <div key={item.name} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="font-bold text-foreground">{item.name}</span>
                          <span className="text-muted-foreground text-[11px] truncate max-w-[120px]">
                            {item.fullName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-foreground">{percent.toFixed(1)}%</span>
                          <span className="text-muted-foreground ml-2">({formatBDT(item.value)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Active Holdings Snapshot & Performance (Tabbed for Positions vs P&L Chart) */}
        <Card className="lg:col-span-7 flex flex-col shadow-sm">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'positions' | 'chart')} className="flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Active Positions &amp; Performance</CardTitle>
                  <CardDescription className="text-xs">
                    {profitMode === 'gross'
                      ? 'Displaying Gross Profit (before deducting brokerage commission)'
                      : 'Displaying Net Profit (after deducting buying & selling brokerage)'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-0.5 rounded-md bg-muted text-[11px] border border-border/50">
                    <button
                      type="button"
                      onClick={() => setProfitMode('net')}
                      className={cn(
                        'px-2 py-0.5 rounded font-medium transition-colors',
                        profitMode === 'net' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      Net
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfitMode('gross')}
                      className={cn(
                        'px-2 py-0.5 rounded font-medium transition-colors',
                        profitMode === 'gross' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      Gross
                    </button>
                  </div>
                  <TabsList className="h-8">
                    <TabsTrigger value="positions" className="text-xs px-3 h-7">
                      Positions ({activeHoldings.length})
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="text-xs px-3 h-7">
                      P&amp;L Chart
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4">
              <TabsContent value="positions" className="mt-0 space-y-3">
                {activeHoldings.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">No active positions</p>
                      <p className="text-xs text-muted-foreground">
                        Buy your first stock to start tracking positions.
                      </p>
                    </div>
                    <Button
                      onClick={() => setBuyDialogOpen(true)}
                      size="sm"
                      className="mt-2 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Buy Stock
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeHoldings.map((h) => {
                      const hasPrice = h.marketPrice && h.marketPrice.price > 0;
                      const netVal = h.unrealizedPL !== null ? parseFloat(h.unrealizedPL) : null;
                      const netPct = h.unrealizedPLPercent !== null ? parseFloat(h.unrealizedPLPercent) : null;
                      const grossVal = h.grossUnrealizedPL !== null && h.grossUnrealizedPL !== undefined
                        ? parseFloat(h.grossUnrealizedPL)
                        : netVal;
                      const grossPct = h.grossUnrealizedPLPercent !== null && h.grossUnrealizedPLPercent !== undefined
                        ? parseFloat(h.grossUnrealizedPLPercent)
                        : netPct;

                      const displayPL = profitMode === 'gross' ? grossVal : netVal;
                      const displayPct = profitMode === 'gross' ? grossPct : netPct;

                      return (
                        <div
                          key={h.company.id}
                          className="rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors p-3.5 space-y-3"
                        >
                          {/* Top Row: Symbol, Name, Exchange, and Action */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground">
                                {h.company.symbol}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                                {h.company.exchange || 'DSE'}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[240px]">
                                {h.company.name}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPriceModal(h.company.id)}
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <TrendingUp className="w-3 h-3" />
                              {hasPrice ? 'Update Price' : 'Set Price'}
                            </Button>
                          </div>

                          {/* Stats Grid: Shares, Avg Cost, Break-Even, Valuation */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-xs">
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Shares Owned</span>
                              <span className="font-semibold text-foreground">
                                {formatNumber(h.availableShares)}
                              </span>
                            </div>

                            <div>
                              <span className="text-muted-foreground block text-[11px]">Avg Buy Price</span>
                              <span className="font-semibold text-foreground">
                                {formatBDT(h.weightedAverageCost)}
                              </span>
                              {h.weightedAverageGrossPrice && (
                                <span className="text-[10px] text-muted-foreground block">
                                  Gross: {formatBDT(h.weightedAverageGrossPrice)}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-muted-foreground block text-[11px]">Break-Even Price</span>
                              <span className="font-semibold text-foreground">
                                {formatBDT(h.breakEvenPrice)}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                Min sale target
                              </span>
                            </div>

                            <div>
                              <span className="text-muted-foreground block text-[11px]">Invested Basis</span>
                              <span className="font-semibold text-foreground">
                                {formatBDT(h.remainingCostBasis)}
                              </span>
                              {h.remainingGrossCost && (
                                <span className="text-[10px] text-muted-foreground block">
                                  Gross: {formatBDT(h.remainingGrossCost)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Valuation / Return Status Bar */}
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-[11px]">Market Price:</span>
                              {hasPrice ? (
                                <span className="font-bold text-foreground">
                                  {formatBDT(h.marketPrice!.price)}
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                                  Pending market price
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              {hasPrice && displayPL !== null ? (
                                <div>
                                  <span className={`font-bold ${getPLColor(displayPL)}`}>
                                    {displayPL >= 0 ? '+' : ''}{formatBDT(displayPL)}
                                    {displayPct !== null && ` (${displayPct >= 0 ? '+' : ''}${displayPct.toFixed(2)}%)`}
                                  </span>
                                  <div className="text-[10px] text-muted-foreground">
                                    {profitMode === 'gross'
                                      ? `Gross (Net: ${netVal !== null ? (netVal >= 0 ? '+' : '') + formatBDT(netVal) : '—'})`
                                      : `Net (Gross: ${grossVal !== null ? (grossVal >= 0 ? '+' : '') + formatBDT(grossVal) : '—'})`}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">
                                  Valued at cost
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/holdings"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        View Full Holdings Table
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chart" className="mt-0">
                {!isMounted ? (
                  <div className="h-64 flex items-center justify-center">
                    <Skeleton className="w-full h-48" />
                  </div>
                ) : plChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">No P&amp;L Data Yet</p>
                      <p className="text-xs max-w-sm text-muted-foreground">
                        Once you enter market prices or sell shares, your {profitMode} profit and loss per stock will appear here.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenPriceModal()}
                      className="gap-1.5 text-xs"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Enter Market Prices
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-64 sm:h-72">
                    <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                      <span>Displaying: <strong className="text-foreground capitalize">{profitMode} Profit/Loss</strong></span>
                      <span className="text-[11px]">{profitMode === 'gross' ? 'Pre-brokerage' : 'After brokerage'}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={plChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis
                          dataKey="symbol"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ strokeOpacity: 0.2 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val: number) =>
                            formatBDT(val, { decimals: 0, showSymbol: false })
                          }
                        />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0]?.payload as {
                                symbol: string;
                                name: string;
                                realized: number;
                                unrealized: number;
                                grossRealized: number;
                                grossUnrealized: number;
                                netRealized: number;
                                netUnrealized: number;
                                hasUnrealized: boolean;
                              };
                              return (
                                <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-lg p-3 text-xs space-y-1.5 min-w-[200px]">
                                  <p className="font-semibold text-sm">
                                    {label}
                                  </p>
                                  <p className="text-muted-foreground truncate max-w-[220px]">
                                    {item?.name}
                                  </p>
                                  <div className="pt-1.5 border-t border-border/60 space-y-1">
                                    <div className="text-[11px] font-semibold text-foreground">
                                      {profitMode === 'gross' ? 'Gross (Pre-Brokerage)' : 'Net (Post-Brokerage)'}
                                    </div>
                                    <p className="flex justify-between items-center gap-3">
                                      <span className="text-muted-foreground">Realized P/L:</span>
                                      <span className={`font-semibold ${getPLColor(item?.realized)}`}>
                                        {formatBDT(item?.realized)}
                                      </span>
                                    </p>
                                    <p className="flex justify-between items-center gap-3">
                                      <span className="text-muted-foreground">Unrealized P/L:</span>
                                      <span
                                        className={`font-semibold ${
                                          item?.hasUnrealized
                                            ? getPLColor(item?.unrealized)
                                            : 'text-muted-foreground font-normal'
                                        }`}
                                      >
                                        {item?.hasUnrealized
                                          ? formatBDT(item?.unrealized)
                                          : 'No market price'}
                                      </span>
                                    </p>
                                    <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between">
                                      <span>Alternative mode:</span>
                                      <span>
                                        {profitMode === 'gross'
                                          ? `Net P/L: ${formatBDT(item?.netRealized + item?.netUnrealized)}`
                                          : `Gross P/L: ${formatBDT(item?.grossRealized + item?.grossUnrealized)}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={32}
                          formatter={(val: string) => (
                            <span className="text-xs text-foreground font-medium capitalize">
                              {val === 'realized' ? `${profitMode} Realized` : `${profitMode} Unrealized`}
                            </span>
                          )}
                        />
                        <Bar
                          dataKey="realized"
                          name="realized"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="unrealized"
                          name="unrealized"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* 5. Bottom Section: Recent Ledger Activity */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-semibold">Recent Ledger Activity</CardTitle>
            <CardDescription className="text-xs">
              Latest transactions recorded in your investment account
            </CardDescription>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            View All ({transactions.length})
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {recentTransactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No transactions recorded yet</p>
                <p className="text-xs text-muted-foreground">
                  When you record buy or sell trades, they will appear here.
                </p>
              </div>
              <Button
                onClick={() => setBuyDialogOpen(true)}
                size="sm"
                className="mt-2 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PlusCircle className="w-4 h-4" />
                Record First Buy
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentTransactions.map((txn) => {
                const company =
                  companies.find((c) => c.id === txn.company_id) || txn.company;
                const symbol = company?.symbol || 'UNKNOWN';
                const companyName = company?.name || symbol;
                const isBuy = txn.type === 'BUY';

                return (
                  <div
                    key={txn.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 px-2 -mx-2 rounded-lg transition-colors"
                  >
                    {/* Left: Type badge + Company info */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isBuy
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                            : 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                        }`}
                      >
                        {isBuy ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{symbol}</span>
                          <Badge variant={isBuy ? 'buy' : 'sell'} className="text-[10px] px-1.5 py-0">
                            {txn.type}
                          </Badge>
                          {company?.exchange && (
                            <span className="text-[10px] text-muted-foreground border border-border/80 rounded px-1">
                              {company.exchange}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px] sm:max-w-[320px]">
                          {companyName}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Quantity & Price */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-xs">
                      <div className="text-muted-foreground">
                        {formatNumber(txn.quantity)} shares @ {formatBDT(txn.price_per_share)}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(txn.date, 'medium')}
                      </div>
                    </div>

                    {/* Right: Net Amount & Realized P/L */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                      <span className="font-bold text-sm tabular-nums">
                        {formatBDT(txn.net_amount)}
                      </span>
                      {!isBuy && txn.realized_profit_loss !== null && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground text-[11px]">Realized P/L:</span>
                          <span
                            className={`font-semibold tabular-nums ${getPLColor(
                              txn.realized_profit_loss
                            )}`}
                          >
                            {formatBDT(txn.realized_profit_loss)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <BuyStockDialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen} />
      <SellStockDialog open={sellDialogOpen} onOpenChange={setSellDialogOpen} />
      <UpdatePriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        preselectedCompanyId={selectedCompanyIdForPrice}
      />
    </div>
  );
}
