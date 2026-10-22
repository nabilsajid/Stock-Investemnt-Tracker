'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import type { Holding } from '@/lib/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BuyStockDialog,
  SellStockDialog,
  UpdatePriceDialog,
} from '@/components/dialogs';
import {
  formatBDT,
  formatPercent,
  formatNumber,
  getPLColor,
} from '@/lib/utils';
import {
  Search,
  Plus,
  RefreshCw,
  TrendingUp,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ShoppingCart,
  MinusCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

type SortOption =
  | 'value-desc'
  | 'value-asc'
  | 'pl-desc'
  | 'pl-asc'
  | 'pl-pct-desc'
  | 'pl-pct-asc'
  | 'symbol-asc'
  | 'shares-desc';

export default function HoldingsPage() {
  const router = useRouter();
  const { holdings, loading } = usePortfolio();

  // Search, Filter & Profit Mode state
  const [profitMode, setProfitMode] = useState<'net' | 'gross'>('net');
  const [search, setSearch] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'DSE' | 'CSE'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('value-desc');
  const [showClosedPositions, setShowClosedPositions] = useState(false);

  // Dialog state
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);
  const [dialogCompanyId, setDialogCompanyId] = useState<string | undefined>(undefined);

  // Open dialog helpers
  const handleOpenBuy = (companyId?: string) => {
    setDialogCompanyId(companyId);
    setBuyDialogOpen(true);
  };

  const handleOpenSell = (companyId?: string) => {
    setDialogCompanyId(companyId);
    setSellDialogOpen(true);
  };

  const handleOpenUpdatePrice = (companyId?: string) => {
    setDialogCompanyId(companyId);
    setUpdatePriceDialogOpen(true);
  };

  // Separate active vs closed positions
  const { activeHoldings, closedHoldings } = useMemo(() => {
    const active: Holding[] = [];
    const closed: Holding[] = [];

    for (const h of holdings) {
      if (h.availableShares > 0) {
        active.push(h);
      } else {
        closed.push(h);
      }
    }

    return { activeHoldings: active, closedHoldings: closed };
  }, [holdings]);

  // Filter & sort helper
  const filterAndSort = (items: Holding[]) => {
    return items
      .filter((h) => {
        // Exchange filter
        if (exchangeFilter !== 'ALL' && h.company.exchange !== exchangeFilter) {
          return false;
        }

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchesName = h.company.name.toLowerCase().includes(q);
          const matchesSymbol = h.company.symbol.toLowerCase().includes(q);
          if (!matchesName && !matchesSymbol) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'symbol-asc':
            return a.company.symbol.localeCompare(b.company.symbol);
          case 'shares-desc':
            return b.availableShares - a.availableShares;
          case 'value-desc': {
            const valA = a.currentMarketValue ? parseFloat(a.currentMarketValue) : 0;
            const valB = b.currentMarketValue ? parseFloat(b.currentMarketValue) : 0;
            return valB - valA;
          }
          case 'value-asc': {
            const valA = a.currentMarketValue ? parseFloat(a.currentMarketValue) : 0;
            const valB = b.currentMarketValue ? parseFloat(b.currentMarketValue) : 0;
            return valA - valB;
          }
          case 'pl-desc': {
            const plA = profitMode === 'gross'
              ? (a.grossUnrealizedPL ? parseFloat(a.grossUnrealizedPL) : -Infinity)
              : (a.unrealizedPL ? parseFloat(a.unrealizedPL) : -Infinity);
            const plB = profitMode === 'gross'
              ? (b.grossUnrealizedPL ? parseFloat(b.grossUnrealizedPL) : -Infinity)
              : (b.unrealizedPL ? parseFloat(b.unrealizedPL) : -Infinity);
            return plB - plA;
          }
          case 'pl-asc': {
            const plA = profitMode === 'gross'
              ? (a.grossUnrealizedPL ? parseFloat(a.grossUnrealizedPL) : Infinity)
              : (a.unrealizedPL ? parseFloat(a.unrealizedPL) : Infinity);
            const plB = profitMode === 'gross'
              ? (b.grossUnrealizedPL ? parseFloat(b.grossUnrealizedPL) : Infinity)
              : (b.unrealizedPL ? parseFloat(b.unrealizedPL) : Infinity);
            return plA - plB;
          }
          case 'pl-pct-desc': {
            const pctA = profitMode === 'gross'
              ? (a.grossUnrealizedPLPercent ? parseFloat(a.grossUnrealizedPLPercent) : -Infinity)
              : (a.unrealizedPLPercent ? parseFloat(a.unrealizedPLPercent) : -Infinity);
            const pctB = profitMode === 'gross'
              ? (b.grossUnrealizedPLPercent ? parseFloat(b.grossUnrealizedPLPercent) : -Infinity)
              : (b.unrealizedPLPercent ? parseFloat(b.unrealizedPLPercent) : -Infinity);
            return pctB - pctA;
          }
          case 'pl-pct-asc': {
            const pctA = profitMode === 'gross'
              ? (a.grossUnrealizedPLPercent ? parseFloat(a.grossUnrealizedPLPercent) : Infinity)
              : (a.unrealizedPLPercent ? parseFloat(a.unrealizedPLPercent) : Infinity);
            const pctB = profitMode === 'gross'
              ? (b.grossUnrealizedPLPercent ? parseFloat(b.grossUnrealizedPLPercent) : Infinity)
              : (b.unrealizedPLPercent ? parseFloat(b.unrealizedPLPercent) : Infinity);
            return pctA - pctB;
          }
          default:
            return 0;
        }
      });
  };

  const filteredActiveHoldings = useMemo(
    () => filterAndSort(activeHoldings),
    [activeHoldings, exchangeFilter, search, sortBy, profitMode]
  );

  const filteredClosedHoldings = useMemo(
    () => filterAndSort(closedHoldings),
    [closedHoldings, exchangeFilter, search, sortBy, profitMode]
  );

  const hasAnyHoldings = holdings.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            My Holdings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor open positions, average costs, market valuations, and unrealized returns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => handleOpenBuy()}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Buy Stock
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasAnyHoldings && !loading ? (
        /* Empty State */
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Briefcase className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No holdings yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Start investing by buying your first stock on the Dhaka (DSE) or Chittagong (CSE) Stock Exchange!
              </p>
            </div>
            <Button onClick={() => handleOpenBuy()} className="gap-2 mt-2">
              <Plus className="h-4 w-4" />
              Buy Your First Stock
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company by name or symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Gross / Net Profit Toggle */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
                <button
                  type="button"
                  onClick={() => setProfitMode('net')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    profitMode === 'net'
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Net Return
                </button>
                <button
                  type="button"
                  onClick={() => setProfitMode('gross')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    profitMode === 'gross'
                      ? 'bg-background text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Gross Return
                </button>
              </div>

              {/* Sort By Select */}
              <div className="w-[180px]">
                <Select
                  value={sortBy}
                  onValueChange={(val) => setSortBy(val as SortOption)}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value-desc">Market Value: High to Low</SelectItem>
                    <SelectItem value="value-asc">Market Value: Low to High</SelectItem>
                    <SelectItem value="pl-desc">Profit / Loss: Highest</SelectItem>
                    <SelectItem value="pl-asc">Profit / Loss: Lowest</SelectItem>
                    <SelectItem value="pl-pct-desc">Return %: Highest</SelectItem>
                    <SelectItem value="pl-pct-asc">Return %: Lowest</SelectItem>
                    <SelectItem value="symbol-asc">Symbol: A to Z</SelectItem>
                    <SelectItem value="shares-desc">Shares: Most to Least</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Active Holdings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Active Positions
                </h2>
                <Badge variant="secondary" className="text-xs font-normal">
                  {filteredActiveHoldings.length} {filteredActiveHoldings.length === 1 ? 'stock' : 'stocks'}
                </Badge>
              </div>
            </div>

            {filteredActiveHoldings.length === 0 ? (
              <Card className="p-8 text-center bg-card/50">
                <p className="text-sm text-muted-foreground">
                  No active holdings found matching your filters.
                </p>
                {search && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setExchangeFilter('ALL');
                    }}
                    className="mt-2 text-xs"
                  >
                    Clear search and filters
                  </Button>
                )}
              </Card>
            ) : (
              <>
                {/* Desktop View: Full Responsive Table */}
                <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                        <tr>
                          <th className="px-4 py-3.5 font-semibold">Company</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Shares</th>
                          <th className="px-3 py-3.5 font-semibold text-right">
                            {profitMode === 'gross' ? 'Avg Buy Price' : 'Avg Net Cost'}
                          </th>
                          <th className="px-3 py-3.5 font-semibold text-right">Market Price</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Valuation</th>
                          <th className="px-4 py-3.5 font-semibold text-right">
                            {profitMode === 'gross' ? 'Gross Unrealized P/L' : 'Net Unrealized P/L'}
                          </th>
                          <th className="px-3 py-3.5 font-semibold text-right">Min Selling Price</th>
                          <th className="px-4 py-3.5 font-semibold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredActiveHoldings.map((h) => {
                          const hasPrice = h.marketPrice !== null && h.marketPrice !== undefined;

                          // Profit numbers
                          const activePL = profitMode === 'gross'
                            ? (h.grossUnrealizedPL ? parseFloat(h.grossUnrealizedPL) : null)
                            : (h.unrealizedPL ? parseFloat(h.unrealizedPL) : null);
                          const activePLPercent = profitMode === 'gross'
                            ? (h.grossUnrealizedPLPercent ? parseFloat(h.grossUnrealizedPLPercent) : null)
                            : (h.unrealizedPLPercent ? parseFloat(h.unrealizedPLPercent) : null);
                          const plColor = activePL !== null ? getPLColor(activePL) : 'text-muted-foreground';

                          const secondaryPL = profitMode === 'gross'
                            ? (h.unrealizedPL ? parseFloat(h.unrealizedPL) : null)
                            : (h.grossUnrealizedPL ? parseFloat(h.grossUnrealizedPL) : null);

                          const valuationVal = hasPrice && h.currentMarketValue
                            ? formatBDT(h.currentMarketValue)
                            : formatBDT(profitMode === 'gross' ? (h.remainingGrossCost || h.remainingCostBasis) : h.remainingCostBasis);

                          return (
                            <tr
                              key={h.company.id}
                              onClick={() => router.push(`/holdings/${h.company.id}`)}
                              className="hover:bg-muted/40 transition-colors cursor-pointer group"
                            >
                              {/* Company */}
                              <td className="px-4 py-3.5">
                                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {h.company.symbol}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[170px]">
                                  {h.company.name}
                                </div>
                              </td>

                              {/* Shares */}
                              <td className="px-3 py-3.5 text-right">
                                <div className="font-medium text-foreground">
                                  {formatNumber(h.availableShares)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Purchased: {formatNumber(h.totalSharesPurchased)}
                                </div>
                              </td>

                              {/* Avg Price / Cost */}
                              <td className="px-3 py-3.5 text-right font-medium">
                                <div className="text-foreground">
                                  {formatBDT(profitMode === 'gross' ? (h.weightedAverageGrossPrice || h.weightedAverageCost) : h.weightedAverageCost)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {profitMode === 'gross'
                                    ? `Net: ${formatBDT(h.weightedAverageCost)}`
                                    : `Gross: ${formatBDT(h.weightedAverageGrossPrice || h.weightedAverageCost)}`}
                                </div>
                              </td>

                              {/* Market Price */}
                              <td className="px-3 py-3.5 text-right">
                                {hasPrice ? (
                                  <span className="font-medium text-foreground">
                                    {formatBDT(h.marketPrice!.price)}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenUpdatePrice(h.company.id);
                                    }}
                                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                                  >
                                    Set price
                                  </button>
                                )}
                              </td>

                              {/* Valuation */}
                              <td className="px-3 py-3.5 text-right">
                                <div className="font-medium text-foreground">
                                  {valuationVal}
                                </div>
                                {!hasPrice && (
                                  <div className="text-[10px] text-muted-foreground">
                                    (at cost)
                                  </div>
                                )}
                              </td>

                              {/* Unrealized P/L */}
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                {activePL !== null ? (
                                  <div>
                                    <div className={`font-semibold ${plColor}`}>
                                      {formatBDT(activePL)}
                                      {activePLPercent !== null && (
                                        <span className="ml-1 text-xs">
                                          ({activePLPercent >= 0 ? '+' : ''}{activePLPercent.toFixed(2)}%)
                                        </span>
                                      )}
                                    </div>
                                    {secondaryPL !== null && (
                                      <div className="text-[10px] text-muted-foreground">
                                        {profitMode === 'gross'
                                          ? `Net: ${formatBDT(secondaryPL)}`
                                          : `Gross: ${formatBDT(secondaryPL)}`}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>

                              {/* Minimum Selling Price */}
                              <td className="px-3 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                {h.availableShares > 0 ? formatBDT(h.breakEvenPrice) : '—'}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5 text-center">
                                <div
                                  className="flex items-center justify-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenBuy(h.company.id)}
                                    className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                    title="Buy more shares"
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                                    Buy
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenSell(h.company.id)}
                                    className="h-8 px-2 text-xs text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                                    title="Sell shares"
                                  >
                                    <MinusCircle className="h-3.5 w-3.5 mr-1" />
                                    Sell
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenUpdatePrice(h.company.id)}
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    title="Update market price"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View (< md): High Quality Cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {filteredActiveHoldings.map((h) => {
                    const hasPrice = h.marketPrice !== null && h.marketPrice !== undefined;
                    const activePL = profitMode === 'gross'
                      ? (h.grossUnrealizedPL ? parseFloat(h.grossUnrealizedPL) : null)
                      : (h.unrealizedPL ? parseFloat(h.unrealizedPL) : null);
                    const activePLPercent = profitMode === 'gross'
                      ? (h.grossUnrealizedPLPercent ? parseFloat(h.grossUnrealizedPLPercent) : null)
                      : (h.unrealizedPLPercent ? parseFloat(h.unrealizedPLPercent) : null);
                    const plColor = activePL !== null ? getPLColor(activePL) : 'text-muted-foreground';

                    const valuationVal = hasPrice && h.currentMarketValue
                      ? formatBDT(h.currentMarketValue)
                      : formatBDT(profitMode === 'gross' ? (h.remainingGrossCost || h.remainingCostBasis) : h.remainingCostBasis);

                    return (
                      <Card
                        key={h.company.id}
                        onClick={() => router.push(`/holdings/${h.company.id}`)}
                        className="cursor-pointer hover:border-primary/50 transition-all shadow-sm"
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Card Header: Symbol & Name */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base text-foreground">
                                  {h.company.symbol}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {h.company.name}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-muted-foreground">Available</span>
                              <div className="font-bold text-sm text-foreground">
                                {formatNumber(h.availableShares)} shares
                              </div>
                            </div>
                          </div>

                          {/* Metric Grid */}
                          <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-muted/40 text-xs">
                            <div>
                              <div className="text-muted-foreground text-[11px]">
                                {profitMode === 'gross' ? 'Avg Gross' : 'Avg Net'}
                              </div>
                              <div className="font-semibold text-foreground">
                                {formatBDT(profitMode === 'gross' ? (h.weightedAverageGrossPrice || h.weightedAverageCost) : h.weightedAverageCost)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[11px]">Market Price</div>
                              <div className="font-semibold text-foreground">
                                {hasPrice ? formatBDT(h.marketPrice!.price) : '—'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-muted-foreground text-[11px]">Min Selling</div>
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {h.availableShares > 0 ? formatBDT(h.breakEvenPrice) : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[11px]">Valuation</div>
                              <div className="font-semibold text-foreground">
                                {valuationVal}
                              </div>
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-muted-foreground text-[11px]">
                                {profitMode === 'gross' ? 'Gross Unrealized' : 'Net Unrealized'}
                              </div>
                              <div className={`font-semibold ${plColor}`}>
                                {activePL !== null ? (
                                  <>
                                    {formatBDT(activePL)}
                                    {activePLPercent !== null && (
                                      <span className="ml-1 text-[11px]">
                                        ({activePLPercent >= 0 ? '+' : ''}{activePLPercent.toFixed(1)}%)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions Row */}
                          <div
                            className="flex items-center justify-end pt-1 border-t gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenBuy(h.company.id)}
                                className="h-7 text-xs px-2.5 text-primary"
                              >
                                Buy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSell(h.company.id)}
                                className="h-7 text-xs px-2.5 text-rose-600 dark:text-rose-400"
                              >
                                Sell
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenUpdatePrice(h.company.id)}
                                className="h-7 w-7 text-muted-foreground"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Closed Positions Section (Collapsible) */}
          {closedHoldings.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => setShowClosedPositions((prev) => !prev)}
                className="w-full justify-between py-3 h-auto text-muted-foreground hover:text-foreground hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold text-sm">
                    Closed Positions ({closedHoldings.length})
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    &bull; Positions where all shares have been sold
                  </span>
                </div>
                {showClosedPositions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showClosedPositions && (
                <div className="space-y-3 animate-in fade-in-50 duration-200">
                  {filteredClosedHoldings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-2">
                      No closed positions match current filters.
                    </p>
                  ) : (
                    <div className="rounded-xl border bg-card/60 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground font-medium border-b">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Company</th>
                              <th className="px-3 py-3 font-semibold text-center">Exchange</th>
                              <th className="px-3 py-3 font-semibold text-right">Shares Traded</th>
                              <th className="px-3 py-3 font-semibold text-right">
                                {profitMode === 'gross' ? 'Gross Invested' : 'Net Invested'}
                              </th>
                              <th className="px-3 py-3 font-semibold text-right">Brokerage Paid</th>
                              <th className="px-4 py-3 font-semibold text-right">
                                {profitMode === 'gross' ? 'Gross Realized P/L' : 'Net Realized P/L'}
                              </th>
                              <th className="px-4 py-3 font-semibold text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredClosedHoldings.map((h) => {
                              const netPLNum = parseFloat(h.totalRealizedPL) || 0;
                              const grossPLNum = h.totalGrossRealizedPL ? parseFloat(h.totalGrossRealizedPL) : netPLNum;
                              const activeRealizedPL = profitMode === 'gross' ? grossPLNum : netPLNum;
                              const secondaryRealizedPL = profitMode === 'gross' ? netPLNum : grossPLNum;
                              const realizedPLColor = getPLColor(activeRealizedPL);

                              return (
                                <tr
                                  key={h.company.id}
                                  onClick={() => router.push(`/holdings/${h.company.id}`)}
                                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-foreground">
                                      {h.company.symbol}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                      {h.company.name}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <Badge variant="outline" className="text-[10px]">
                                      {h.company.exchange}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-3 text-right text-muted-foreground">
                                    {formatNumber(h.totalSharesPurchased)} shares
                                  </td>
                                  <td className="px-3 py-3 text-right text-muted-foreground">
                                    {formatBDT(profitMode === 'gross' ? (h.remainingGrossCost || h.cumulativePurchaseCost) : h.cumulativePurchaseCost)}
                                  </td>
                                  <td className="px-3 py-3 text-right text-muted-foreground">
                                    {formatBDT(h.totalBrokerage)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className={`font-semibold ${realizedPLColor}`}>
                                      {formatBDT(activeRealizedPL)}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {profitMode === 'gross'
                                        ? `Net: ${formatBDT(secondaryRealizedPL)}`
                                        : `Gross: ${formatBDT(secondaryRealizedPL)}`}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenBuy(h.company.id);
                                      }}
                                      className="h-7 text-xs text-primary"
                                    >
                                      Buy Again
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Integrated Dialogs */}
      <BuyStockDialog
        open={buyDialogOpen}
        onOpenChange={setBuyDialogOpen}
        preselectedCompanyId={dialogCompanyId}
      />

      <SellStockDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        preselectedCompanyId={dialogCompanyId}
      />

      <UpdatePriceDialog
        open={updatePriceDialogOpen}
        onOpenChange={setUpdatePriceDialogOpen}
        preselectedCompanyId={dialogCompanyId}
      />
    </div>
  );
}
