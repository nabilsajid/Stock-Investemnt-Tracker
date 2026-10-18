'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import {
  calculatePurchase,
  calculateWeightedAverage,
  type PurchaseCalculation,
} from '@/lib/financial/calculator';
import { formatBDT } from '@/lib/utils';
import type { ExchangeType } from '@/lib/supabase/types';
import { Loader2, Plus, Building2, AlertCircle, ArrowRight } from 'lucide-react';

interface BuyStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string; // optional, for buying more of an existing holding
}

/**
 * Returns today's date in Asia/Dhaka timezone formatted as YYYY-MM-DD
 */
function getTodayInDhaka(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function BuyStockDialog({
  open,
  onOpenChange,
  preselectedCompanyId,
}: BuyStockDialogProps) {
  const { companies, holdings, settings, addPurchase } = usePortfolio();

  // Mode: 'existing' company selection vs 'new' company entry
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [symbol, setSymbol] = useState<string>('');
  const [exchange, setExchange] = useState<ExchangeType>('DSE');
  const [quantity, setQuantity] = useState<string>('');
  const [pricePerShare, setPricePerShare] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayInDhaka());
  const [brokerageRate, setBrokerageRate] = useState<string>('0.5');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Determine default brokerage rate from user settings (stored as decimal e.g. 0.005)
  const defaultBrokeragePercentage = useMemo(() => {
    if (settings?.default_buying_brokerage_rate != null) {
      const val = Number(settings.default_buying_brokerage_rate);
      return !isNaN(val) ? (val * 100).toString() : '0.5';
    }
    return '0.5';
  }, [settings]);

  // Form reset on open
  useEffect(() => {
    if (open) {
      setError(null);
      setIsSubmitting(false);
      setDate(getTodayInDhaka());
      setQuantity('');
      setPricePerShare('');
      setBrokerageRate(defaultBrokeragePercentage);

      if (preselectedCompanyId) {
        const found = companies.find((c) => c.id === preselectedCompanyId);
        if (found) {
          setMode('existing');
          setSelectedCompanyId(found.id);
          setCompanyName(found.name);
          setSymbol(found.symbol);
          setExchange(found.exchange);
          return;
        }
      }

      if (companies.length > 0) {
        setMode('existing');
        const first = companies[0];
        setSelectedCompanyId(first.id);
        setCompanyName(first.name);
        setSymbol(first.symbol);
        setExchange(first.exchange);
      } else {
        setMode('new');
        setSelectedCompanyId('');
        setCompanyName('');
        setSymbol('');
        setExchange('DSE');
      }
    }
  }, [open, preselectedCompanyId, companies, defaultBrokeragePercentage]);

  // Handle existing company selection change
  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const comp = companies.find((c) => c.id === companyId);
    if (comp) {
      setCompanyName(comp.name);
      setSymbol(comp.symbol);
      setExchange(comp.exchange);
    }
  };

  // Switch between existing and new company modes
  const handleToggleMode = () => {
    setError(null);
    if (mode === 'existing') {
      setMode('new');
      setSelectedCompanyId('');
      setCompanyName('');
      setSymbol('');
      setExchange('DSE');
    } else {
      if (companies.length > 0) {
        setMode('existing');
        const defaultCompany =
          companies.find((c) => c.id === preselectedCompanyId) || companies[0];
        setSelectedCompanyId(defaultCompany.id);
        setCompanyName(defaultCompany.name);
        setSymbol(defaultCompany.symbol);
        setExchange(defaultCompany.exchange);
      }
    }
  };

  // Find existing holding for the active stock (if any)
  const existingHolding = useMemo(() => {
    if (mode === 'existing' && selectedCompanyId) {
      return holdings.find((h) => h.company.id === selectedCompanyId) || null;
    }
    if (mode === 'new' && symbol.trim()) {
      return (
        holdings.find(
          (h) =>
            h.company.symbol.toUpperCase() === symbol.trim().toUpperCase() &&
            h.company.exchange === exchange
        ) || null
      );
    }
    return null;
  }, [mode, selectedCompanyId, holdings, symbol, exchange]);

  // Live calculation preview
  const calculationPreview = useMemo(() => {
    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerShare);
    const numRate = parseFloat(brokerageRate);

    const isQtyValid = !isNaN(numQty) && numQty > 0;
    const isPriceValid = !isNaN(numPrice) && numPrice > 0;
    const isRateValid = !isNaN(numRate) && numRate >= 0;

    if (!isQtyValid || !isPriceValid || !isRateValid) {
      return {
        isValid: false,
        grossAmount: null,
        brokerageAmount: null,
        totalCost: null,
        costPerShare: null,
        currentAvgCost: existingHolding?.availableShares ? existingHolding.weightedAverageCost : null,
        updatedAvgCost: null,
      };
    }

    try {
      const rateDecimal = numRate / 100;
      const purchase: PurchaseCalculation = calculatePurchase(
        numQty,
        numPrice,
        rateDecimal
      );

      let updatedAvgCost: string | null = null;
      if (existingHolding && existingHolding.availableShares > 0) {
        const weighted = calculateWeightedAverage(
          existingHolding.availableShares,
          existingHolding.remainingCostBasis,
          purchase
        );
        updatedAvgCost = weighted.updatedAveragePrice;
      } else {
        // For a new stock or re-entry where current shares = 0, new average cost is purchase cost per share
        updatedAvgCost = purchase.costPerShare;
      }

      return {
        isValid: true,
        grossAmount: purchase.grossAmount,
        brokerageAmount: purchase.brokerageAmount,
        totalCost: purchase.totalCost,
        costPerShare: purchase.costPerShare,
        currentAvgCost: existingHolding?.availableShares ? existingHolding.weightedAverageCost : null,
        updatedAvgCost,
      };
    } catch {
      return {
        isValid: false,
        grossAmount: null,
        brokerageAmount: null,
        totalCost: null,
        costPerShare: null,
        currentAvgCost: existingHolding?.availableShares ? existingHolding.weightedAverageCost : null,
        updatedAvgCost: null,
      };
    }
  }, [quantity, pricePerShare, brokerageRate, existingHolding]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalCompanyName = companyName.trim();
    const finalSymbol = symbol.trim().toUpperCase();
    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerShare);
    const numRate = parseFloat(brokerageRate);

    if (!finalCompanyName) {
      setError('Please provide a company name.');
      return;
    }
    if (!finalSymbol) {
      setError('Please enter a stock symbol.');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      setError('Purchase quantity must be greater than 0.');
      return;
    }
    if (!Number.isInteger(numQty)) {
      setError('Purchase quantity must be a whole number of shares.');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price per share must be greater than 0.');
      return;
    }
    if (!date) {
      setError('Please select a valid purchase date.');
      return;
    }
    if (isNaN(numRate) || numRate < 0) {
      setError('Brokerage rate must be 0% or higher.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addPurchase({
        companyName: finalCompanyName,
        symbol: finalSymbol,
        exchange,
        quantity: numQty,
        pricePerShare: numPrice,
        date,
        brokerageRate: numRate / 100,
      });

      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to record purchase. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            Buy Stock
          </DialogTitle>
          <DialogDescription>
            Record a stock purchase transaction. The portfolio will automatically update average costs and cost basis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Selection Header / Mode Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="company-selector">Company</Label>
              {companies.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleMode}
                  className="h-7 text-xs text-primary hover:text-primary/90 px-2 font-medium"
                >
                  {mode === 'existing' ? (
                    <>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add New Company
                    </>
                  ) : (
                    '← Select Existing Company'
                  )}
                </Button>
              )}
            </div>

            {mode === 'existing' && companies.length > 0 ? (
              <Select
                value={selectedCompanyId}
                onValueChange={handleSelectCompany}
                disabled={isSubmitting}
              >
                <SelectTrigger id="company-selector" className="w-full">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      <span className="font-medium">{comp.name}</span>{' '}
                      <span className="text-muted-foreground text-xs">
                        ({comp.symbol} · {comp.exchange})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="company-name"
                placeholder="e.g. Square Pharmaceuticals PLC"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            )}
          </div>

          {/* Symbol & Exchange */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="stock-symbol">Stock Symbol</Label>
              <Input
                id="stock-symbol"
                placeholder="e.g. SQURPHARMA"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                disabled={isSubmitting || (mode === 'existing' && !!selectedCompanyId)}
                className="uppercase font-mono"
                required
              />
              {mode === 'existing' && (
                <p className="text-[11px] text-muted-foreground">Auto-filled from company profile</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exchange-select">Exchange</Label>
              <Select
                value={exchange}
                onValueChange={(val: ExchangeType) => setExchange(val)}
                disabled={isSubmitting || (mode === 'existing' && !!selectedCompanyId)}
              >
                <SelectTrigger id="exchange-select" className="w-full">
                  <SelectValue placeholder="Exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DSE">DSE (Dhaka Stock Exchange)</SelectItem>
                  <SelectItem value="CSE">CSE (Chittagong Stock Exchange)</SelectItem>
                </SelectContent>
              </Select>
              {mode === 'existing' && (
                <p className="text-[11px] text-muted-foreground">Auto-filled from company</p>
              )}
            </div>
          </div>

          {/* Quantity & Price per Share */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-quantity">Purchase Quantity</Label>
              <Input
                id="purchase-quantity"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purchase-price">Price per Share (৳)</Label>
              <Input
                id="purchase-price"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 215.50"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Purchase Date & Brokerage Rate */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-date">Purchase Date</Label>
              <Input
                id="purchase-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="brokerage-rate">Brokerage Rate (%)</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {brokerageRate || '0.5'}%
                </span>
              </div>
              <Input
                id="brokerage-rate"
                type="number"
                min="0"
                max="10"
                step="0.01"
                placeholder="0.5"
                value={brokerageRate}
                onChange={(e) => setBrokerageRate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Live Calculation Preview Section */}
          <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Order Summary & Estimates</span>
              {calculationPreview.isValid && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium lowercase">
                  live preview
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gross Purchase Amount</span>
                <span className="font-mono font-medium text-foreground">
                  {calculationPreview.grossAmount
                    ? formatBDT(calculationPreview.grossAmount)
                    : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Buying Brokerage ({brokerageRate ? `${brokerageRate}%` : '--'})
                </span>
                <span className="font-mono font-medium text-foreground">
                  {calculationPreview.brokerageAmount
                    ? formatBDT(calculationPreview.brokerageAmount)
                    : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-base font-semibold">
                <span className="text-foreground">Total Payable Amount</span>
                <span className="font-mono text-primary font-bold">
                  {calculationPreview.totalCost
                    ? formatBDT(calculationPreview.totalCost)
                    : '--'}
                </span>
              </div>
            </div>

            {/* Existing holding cost impact preview */}
            {existingHolding && existingHolding.availableShares > 0 && (
              <div className="mt-2.5 border-t border-border/60 pt-2 space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Current Holding</span>
                  <span className="font-mono">
                    {existingHolding.availableShares} shares @ {formatBDT(existingHolding.weightedAverageCost)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Projected Avg Cost</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-muted-foreground line-through">
                      {formatBDT(existingHolding.weightedAverageCost)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {calculationPreview.updatedAvgCost
                        ? formatBDT(calculationPreview.updatedAvgCost)
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="font-medium min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Confirm Purchase'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
