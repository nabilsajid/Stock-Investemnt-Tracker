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

  // Search & Filter state
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
            const plA = a.unrealizedPL ? parseFloat(a.unrealizedPL) : -Infinity;
            const plB = b.unrealizedPL ? parseFloat(b.unrealizedPL) : -Infinity;
            return plB - plA;
          }
          case 'pl-asc': {
            const plA = a.unrealizedPL ? parseFloat(a.unrealizedPL) : Infinity;
            const plB = b.unrealizedPL ? parseFloat(b.unrealizedPL) : Infinity;
            return plA - plB;
          }
          case 'pl-pct-desc': {
            const pctA = a.unrealizedPLPercent ? parseFloat(a.unrealizedPLPercent) : -Infinity;
            const pctB = b.unrealizedPLPercent ? parseFloat(b.unrealizedPLPercent) : -Infinity;
            return pctB - pctA;
          }
          case 'pl-pct-asc': {
            const pctA = a.unrealizedPLPercent ? parseFloat(a.unrealizedPLPercent) : Infinity;
            const pctB = b.unrealizedPLPercent ? parseFloat(b.unrealizedPLPercent) : Infinity;
            return pctA - pctB;
          }
          default:
            return 0;
        }
      });
  };

  const filteredActiveHoldings = useMemo(
    () => filterAndSort(activeHoldings),
    [activeHoldings, exchangeFilter, search, sortBy]
  );

  const filteredClosedHoldings = useMemo(
    () => filterAndSort(closedHoldings),
    [closedHoldings, exchangeFilter, search, sortBy]
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
                          <th className="px-3 py-3.5 font-semibold text-right">Purchased</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Sold</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Available</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Avg Cost</th>
                          <th className="px-3 py-3.5 font-semibold text-right">Min Selling Price</th>
                          <th className="px-4 py-3.5 font-semibold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredActiveHoldings.map((h) => {
                          const hasPrice = h.marketPrice !== null && h.marketPrice !== undefined;
                          const plColor = getPLColor(h.unrealizedPL);

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
                                <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {h.company.name}
                                </div>
                              </td>

                              {/* Purchased */}
                              <td className="px-3 py-3.5 text-right text-muted-foreground">
                                {formatNumber(h.totalSharesPurchased)}
                              </td>

                              {/* Sold */}
                              <td className="px-3 py-3.5 text-right text-muted-foreground">
                                {formatNumber(h.totalSharesSold)}
                              </td>

                              {/* Available */}
                              <td className="px-3 py-3.5 text-right font-medium text-foreground">
                                {formatNumber(h.availableShares)}
                              </td>

                              {/* Avg Cost */}
                              <td className="px-3 py-3.5 text-right font-medium">
                                {formatBDT(h.weightedAverageCost)}
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
                    const plColor = getPLColor(h.unrealizedPL);

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
                              <div className="text-muted-foreground text-[11px]">Available</div>
                              <div className="font-semibold text-foreground">
                                {formatNumber(h.availableShares)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-[11px]">Avg Cost</div>
                              <div className="font-semibold text-foreground">
                                {formatBDT(h.weightedAverageCost)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-muted-foreground text-[11px]">Min Selling</div>
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {h.availableShares > 0 ? formatBDT(h.breakEvenPrice) : '—'}
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
                              <th className="px-3 py-3 font-semibold text-right">Total Invested</th>
                              <th className="px-3 py-3 font-semibold text-right">Brokerage Paid</th>
                              <th className="px-4 py-3 font-semibold text-right">Realized P/L</th>
                              <th className="px-4 py-3 font-semibold text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredClosedHoldings.map((h) => {
                              const realizedPLNum = parseFloat(h.totalRealizedPL) || 0;
                              const realizedPLColor = getPLColor(realizedPLNum);

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
                                    {formatBDT(h.cumulativePurchaseCost)}
                                  </td>
                                  <td className="px-3 py-3 text-right text-muted-foreground">
                                    {formatBDT(h.totalBrokerage)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`font-semibold ${realizedPLColor}`}>
                                      {formatBDT(realizedPLNum)}
                                    </span>
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
