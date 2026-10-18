'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BuyStockDialog,
  SellStockDialog,
  UpdatePriceDialog,
} from '@/components/dialogs';
import {
  formatBDT,
  formatPercent,
  formatNumber,
  formatDate,
  getPLColor,
} from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  MinusCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  Scale,
  Receipt,
  DollarSign,
  AlertCircle,
  Clock,
  Briefcase,
} from 'lucide-react';

export default function CompanyDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = params?.id;

  const { companies, holdings, transactions, loading } = usePortfolio();

  // Dialog state
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);

  // Find company & holding
  const company = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId]
  );

  const holding = useMemo(
    () => holdings.find((h) => h.company.id === companyId),
    [holdings, companyId]
  );

  // Transactions for this company only
  const companyTransactions = useMemo(() => {
    if (!companyId) return [];
    return transactions
      .filter((t) => t.company_id === companyId)
      .sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.sequence || 0) - (a.sequence || 0);
      });
  }, [transactions, companyId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-md" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Not found state
  if (!company && !holding) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <AlertCircle className="h-7 w-7 text-rose-500" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Company Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The stock position or company you are looking for does not exist in your portfolio.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/holdings">
            <ArrowLeft className="h-4 w-4" />
            Back to Holdings
          </Link>
        </Button>
      </div>
    );
  }

  const effectiveCompany = holding?.company || company!;
  const availableShares = holding ? holding.availableShares : 0;
  const canSell = availableShares > 0;
  const hasPrice = holding?.marketPrice !== null && holding?.marketPrice !== undefined;

  const realizedPL = holding ? parseFloat(holding.totalRealizedPL) : 0;
  const realizedColor = getPLColor(realizedPL);
  const unrealizedColor = holding?.unrealizedPL ? getPLColor(holding.unrealizedPL) : 'text-muted-foreground';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Company Header */}
      <div className="space-y-3">
        <Link
          href="/holdings"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
          Back to My Holdings
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {effectiveCompany.name}
              </h1>
              <Badge variant="outline" className="text-sm font-semibold tracking-wide">
                {effectiveCompany.symbol}
              </Badge>
              <Badge
                variant="secondary"
                className="text-xs uppercase tracking-wider font-semibold"
              >
                {effectiveCompany.exchange}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {effectiveCompany.exchange === 'DSE'
                ? 'Dhaka Stock Exchange'
                : 'Chittagong Stock Exchange'} &bull; ID: {effectiveCompany.id}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUpdatePriceDialogOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              Update Price
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSellDialogOpen(true)}
              disabled={!canSell}
              className="gap-1.5 text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 shadow-sm"
            >
              <MinusCircle className="h-4 w-4" />
              Sell
            </Button>
            <Button
              size="sm"
              onClick={() => setBuyDialogOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Buy More
            </Button>
          </div>
        </div>
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Available Shares */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Available Shares</span>
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {formatNumber(availableShares)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Purchased: {formatNumber(holding?.totalSharesPurchased || 0)} &bull; Sold: {formatNumber(holding?.totalSharesSold || 0)}
            </p>
          </CardContent>
        </Card>

        {/* 2. Avg Purchase Cost */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Avg Purchase Cost</span>
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {holding ? formatBDT(holding.weightedAverageCost) : '৳0.00'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Weighted cost basis / share
            </p>
          </CardContent>
        </Card>

        {/* 3. Break-Even Price */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Break-Even Price</span>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {holding && availableShares > 0 ? formatBDT(holding.breakEvenPrice) : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Min price to cover selling fees
            </p>
          </CardContent>
        </Card>

        {/* 4. Current Market Price */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Market Price</span>
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {hasPrice ? (
                formatBDT(holding!.marketPrice!.price)
              ) : (
                <button
                  type="button"
                  onClick={() => setUpdatePriceDialogOpen(true)}
                  className="text-amber-600 dark:text-amber-400 hover:underline text-base font-semibold"
                >
                  Not entered
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hasPrice && holding?.marketPrice?.updated_at ? (
                `Updated ${formatDate(holding.marketPrice.updated_at, 'short')}`
              ) : (
                'Click to record live rate'
              )}
            </p>
          </CardContent>
        </Card>

        {/* 5. Remaining Cost Basis */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Remaining Cost Basis</span>
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {holding ? formatBDT(holding.remainingCostBasis) : '৳0.00'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Net capital tied in open shares
            </p>
          </CardContent>
        </Card>

        {/* 6. Current Market Value */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Market Value</span>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {holding?.currentMarketValue ? formatBDT(holding.currentMarketValue) : '--'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Gross liquidation value
            </p>
          </CardContent>
        </Card>

        {/* 7. Realized P/L */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Realized Profit / Loss</span>
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className={`text-xl sm:text-2xl font-bold ${realizedColor}`}>
              {holding ? formatBDT(holding.totalRealizedPL) : '৳0.00'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Locked profit from past sales
            </p>
          </CardContent>
        </Card>

        {/* 8. Unrealized P/L */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Unrealized P/L</span>
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            {holding?.unrealizedPL !== null && holding?.unrealizedPL !== undefined ? (
              <>
                <div className={`text-xl sm:text-2xl font-bold ${unrealizedColor}`}>
                  {formatBDT(holding.unrealizedPL)}
                </div>
                <p className={`text-[11px] font-semibold mt-0.5 ${unrealizedColor}`}>
                  {formatPercent(holding.unrealizedPLPercent)} net after fees
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setUpdatePriceDialogOpen(true)}
                  className="text-base font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Enter price
                </button>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Requires current market price
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History for This Company */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Transaction History
            </h2>
            <p className="text-xs text-muted-foreground">
              All buy and sell transactions executed for {effectiveCompany.symbol} ({companyTransactions.length} total)
            </p>
          </div>
        </div>

        {companyTransactions.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-sm text-muted-foreground">
              No transactions recorded for this company yet.
            </p>
            <Button
              size="sm"
              onClick={() => setBuyDialogOpen(true)}
              className="mt-3 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Record First Buy
            </Button>
          </Card>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold">Date</th>
                      <th className="px-3 py-3.5 font-semibold text-center">Type</th>
                      <th className="px-3 py-3.5 font-semibold text-right">Quantity</th>
                      <th className="px-3 py-3.5 font-semibold text-right">Price</th>
                      <th className="px-3 py-3.5 font-semibold text-right">Gross Amount</th>
                      <th className="px-3 py-3.5 font-semibold text-right">Brokerage</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Net Amount</th>
                      <th className="px-4 py-3.5 font-semibold text-right">Realized P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {companyTransactions.map((t) => {
                      const isBuy = t.type === 'BUY';
                      const realizedPLColor = getPLColor(t.realized_profit_loss);

                      return (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(t.date, 'medium')}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <Badge
                              variant={isBuy ? 'buy' : 'sell'}
                              className="font-bold text-[11px] px-2.5 py-0.5"
                            >
                              {t.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-3.5 text-right font-medium text-foreground">
                            {formatNumber(t.quantity)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-muted-foreground">
                            {formatBDT(t.price_per_share)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-muted-foreground">
                            {formatBDT(t.gross_amount)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                            <div>{formatBDT(t.brokerage_amount)}</div>
                            <div className="text-[10px]">
                              ({(t.brokerage_rate * 100).toFixed(2)}%)
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-foreground whitespace-nowrap">
                            {formatBDT(t.net_amount)}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {!isBuy && t.realized_profit_loss !== null ? (
                              <span className={`font-semibold ${realizedPLColor}`}>
                                {formatBDT(t.realized_profit_loss)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View (< md) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {companyTransactions.map((t) => {
                const isBuy = t.type === 'BUY';
                const realizedPLColor = getPLColor(t.realized_profit_loss);

                return (
                  <Card key={t.id} className="shadow-sm">
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={isBuy ? 'buy' : 'sell'}
                          className="font-bold text-[11px]"
                        >
                          {t.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(t.date, 'medium')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-lg bg-muted/40">
                        <div>
                          <span className="text-muted-foreground">Qty: </span>
                          <span className="font-semibold text-foreground">
                            {formatNumber(t.quantity)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">Rate: </span>
                          <span className="font-semibold text-foreground">
                            {formatBDT(t.price_per_share)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Brokerage: </span>
                          <span className="font-medium text-foreground">
                            {formatBDT(t.brokerage_amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">Net Cost: </span>
                          <span className="font-bold text-foreground">
                            {formatBDT(t.net_amount)}
                          </span>
                        </div>
                      </div>

                      {!isBuy && t.realized_profit_loss !== null && (
                        <div className="flex justify-between items-center text-xs pt-1 border-t">
                          <span className="text-muted-foreground">Realized Profit / Loss:</span>
                          <span className={`font-bold ${realizedPLColor}`}>
                            {formatBDT(t.realized_profit_loss)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Dialogs pre-selected for this company */}
      <BuyStockDialog
        open={buyDialogOpen}
        onOpenChange={setBuyDialogOpen}
        preselectedCompanyId={companyId}
      />

      <SellStockDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        preselectedCompanyId={companyId}
      />

      <UpdatePriceDialog
        open={updatePriceDialogOpen}
        onOpenChange={setUpdatePriceDialogOpen}
        preselectedCompanyId={companyId}
      />
    </div>
  );
}
