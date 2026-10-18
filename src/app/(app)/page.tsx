'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
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

const CHART_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Allocation pie chart data (by remaining cost basis)
  const allocationData = useMemo(() => {
    return holdings
      .filter((h) => h.availableShares > 0 && parseFloat(h.remainingCostBasis) > 0)
      .map((h) => ({
        name: h.company.symbol,
        fullName: h.company.name,
        value: parseFloat(h.remainingCostBasis),
        shares: h.availableShares,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const totalAllocationValue = useMemo(() => {
    return allocationData.reduce((acc, curr) => acc + curr.value, 0);
  }, [allocationData]);

  // Profit/Loss chart data per company
  const plChartData = useMemo(() => {
    return holdings
      .map((h) => {
        const realized = parseFloat(h.totalRealizedPL) || 0;
        const unrealized = h.unrealizedPL !== null ? parseFloat(h.unrealizedPL) || 0 : 0;
        return {
          symbol: h.company.symbol,
          name: h.company.name,
          realized,
          unrealized,
          hasUnrealized: h.unrealizedPL !== null,
        };
      })
      .filter((item) => item.realized !== 0 || item.unrealized !== 0)
      .sort((a, b) => b.realized + b.unrealized - (a.realized + a.unrealized))
      .slice(0, 8);
  }, [holdings]);

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

  // Realized P/L numerical value for direction icon
  const realizedPLNumber = parseFloat(portfolioSummary.totalRealizedProfitLoss) || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & 2. Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your investment overview</p>
        </div>
        <div className="flex items-center gap-2.5">
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

      {/* 3. KPI Summary Cards (Grid of 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Portfolio Value */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Portfolio Value</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {portfolioSummary.currentMarketValue !== null
                ? formatBDT(portfolioSummary.currentMarketValue)
                : 'No prices entered'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Current valuation</p>
          </CardContent>
        </Card>

        {/* Invested Capital */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Invested Capital</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {formatBDT(portfolioSummary.remainingInvestmentCostBasis)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Remaining cost basis</p>
          </CardContent>
        </Card>

        {/* Realized P/L */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Realized P/L</CardTitle>
            <div
              className={`p-2 rounded-lg ${
                realizedPLNumber >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {realizedPLNumber >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-bold truncate ${getPLColor(
                portfolioSummary.totalRealizedProfitLoss
              )}`}
            >
              {formatBDT(portfolioSummary.totalRealizedProfitLoss)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Net profit from sales</p>
          </CardContent>
        </Card>

        {/* Unrealized P/L */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Unrealized P/L</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-bold truncate ${
                portfolioSummary.totalUnrealizedProfitLoss !== null
                  ? getPLColor(portfolioSummary.totalUnrealizedProfitLoss)
                  : 'text-muted-foreground font-normal text-sm'
              }`}
            >
              {portfolioSummary.totalUnrealizedProfitLoss !== null
                ? formatBDT(portfolioSummary.totalUnrealizedProfitLoss)
                : 'Enter prices'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Paper gain / loss</p>
          </CardContent>
        </Card>

        {/* Active Holdings */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Holdings</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {portfolioSummary.holdingsCount} {portfolioSummary.holdingsCount === 1 ? 'stock' : 'stocks'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Open positions</p>
          </CardContent>
        </Card>

        {/* Total Brokerage */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Brokerage</CardTitle>
            <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {formatBDT(portfolioSummary.totalBrokeragePaid)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Trading fees paid</p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Charts Section (Side-by-side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Allocation Pie/Donut Chart */}
        <Card className="flex flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Portfolio Allocation</span>
              <span className="text-xs font-normal text-muted-foreground">By Invested Basis</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of capital across active holdings
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
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
              <div className="w-full h-64 sm:h-72">
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
            )}
          </CardContent>
        </Card>

        {/* Profit / Loss Bar Chart */}
        <Card className="flex flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Profit &amp; Loss Breakdown</span>
              <span className="text-xs font-normal text-muted-foreground">Realized vs Unrealized</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Performance breakdown per company (BDT)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {!isMounted ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="w-full h-48" />
              </div>
            ) : plChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-medium">No Profit &amp; Loss Data</p>
                <p className="text-xs max-w-xs">
                  Realized gains from sales and unrealized gains from current market prices will appear here.
                </p>
              </div>
            ) : (
              <div className="w-full h-64 sm:h-72">
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
                            hasUnrealized: boolean;
                          };
                          return (
                            <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-lg p-3 text-xs space-y-1.5 min-w-[170px]">
                              <p className="font-semibold text-sm">
                                {label}
                              </p>
                              <p className="text-muted-foreground truncate max-w-[200px]">
                                {item?.name}
                              </p>
                              <div className="pt-1.5 border-t border-border/60 space-y-1">
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
                          {val === 'realized' ? 'Realized P/L' : 'Unrealized P/L'}
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
          </CardContent>
        </Card>
      </div>

      {/* 5. Recent Transactions */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            <CardDescription className="text-xs">
              Latest 5 activities recorded in your ledger
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground">
                  Start by buying your first stock!
                </p>
              </div>
              <Button
                onClick={() => setBuyDialogOpen(true)}
                size="sm"
                className="mt-2 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PlusCircle className="w-4 h-4" />
                Buy First Stock
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
    </div>
  );
}
