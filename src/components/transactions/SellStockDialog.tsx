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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import { calculateSale, type SaleCalculation } from '@/lib/financial/calculator';
import { formatBDT, formatPercent, getPLColor } from '@/lib/utils';
import type { Holding } from '@/lib/supabase/types';
import {
  Loader2,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface SellStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string;
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

export function SellStockDialog({
  open,
  onOpenChange,
  preselectedCompanyId,
}: SellStockDialogProps) {
  const { holdings, settings, addSale } = usePortfolio();

  // Filter only holdings where shares are available to sell
  const eligibleHoldings = useMemo(() => {
    return holdings.filter((h) => h.availableShares > 0);
  }, [holdings]);

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [pricePerShare, setPricePerShare] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayInDhaka());
  const [brokerageRate, setBrokerageRate] = useState<string>('0.5');

  // Confirmation Alert Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Default selling brokerage rate from user settings
  const defaultSellingBrokeragePercentage = useMemo(() => {
    if (settings?.default_selling_brokerage_rate != null) {
      const val = Number(settings.default_selling_brokerage_rate);
      return !isNaN(val) ? (val * 100).toString() : '0.5';
    }
    return '0.5';
  }, [settings]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setIsSubmitting(false);
      setIsConfirmOpen(false);
      setDate(getTodayInDhaka());
      setQuantity('');
      setPricePerShare('');
      setBrokerageRate(defaultSellingBrokeragePercentage);

      if (preselectedCompanyId) {
        const found = eligibleHoldings.find((h) => h.company.id === preselectedCompanyId);
        if (found) {
          setSelectedCompanyId(found.company.id);
          return;
        }
      }

      if (eligibleHoldings.length > 0) {
        setSelectedCompanyId(eligibleHoldings[0].company.id);
      } else {
        setSelectedCompanyId('');
      }
    }
  }, [open, preselectedCompanyId, eligibleHoldings, defaultSellingBrokeragePercentage]);

  // Currently selected holding
  const selectedHolding: Holding | undefined = useMemo(() => {
    return eligibleHoldings.find((h) => h.company.id === selectedCompanyId);
  }, [eligibleHoldings, selectedCompanyId]);

  // Live calculation preview
  const salePreview: SaleCalculation | null = useMemo(() => {
    if (!selectedHolding) return null;

    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerShare);
    const numRate = parseFloat(brokerageRate);

    const isQtyValid =
      !isNaN(numQty) &&
      numQty > 0 &&
      numQty <= selectedHolding.availableShares &&
      Number.isInteger(numQty);
    const isPriceValid = !isNaN(numPrice) && numPrice > 0;
    const isRateValid = !isNaN(numRate) && numRate >= 0;

    if (!isQtyValid || !isPriceValid || !isRateValid) {
      return null;
    }

    try {
      const rateDecimal = numRate / 100;
      return calculateSale(
        numQty,
        numPrice,
        selectedHolding.weightedAverageCost,
        selectedHolding.availableShares,
        selectedHolding.remainingCostBasis,
        rateDecimal
      );
    } catch {
      return null;
    }
  }, [selectedHolding, quantity, pricePerShare, brokerageRate]);

  // Validate inputs before opening confirmation modal
  const handleInitiateSell = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedHolding) {
      setError('Please select a company with available shares.');
      return;
    }

    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerShare);
    const numRate = parseFloat(brokerageRate);

    if (isNaN(numQty) || numQty <= 0) {
      setError('Selling quantity must be greater than 0.');
      return;
    }
    if (!Number.isInteger(numQty)) {
      setError('Quantity must be a whole number of shares.');
      return;
    }
    if (numQty > selectedHolding.availableShares) {
      setError(
        `Quantity cannot exceed available shares (${selectedHolding.availableShares} shares available).`
      );
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Selling price per share must be greater than 0.');
      return;
    }
    if (!date) {
      setError('Please select a valid selling date.');
      return;
    }
    if (isNaN(numRate) || numRate < 0) {
      setError('Brokerage rate must be 0% or higher.');
      return;
    }

    // Validation passed, open confirmation dialog
    setIsConfirmOpen(true);
  };

  // Execution confirmed
  const handleConfirmSale = async () => {
    if (!selectedHolding) return;

    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerShare);
    const numRate = parseFloat(brokerageRate);

    setIsSubmitting(true);
    setError(null);

    try {
      await addSale({
        companyId: selectedHolding.company.id,
        quantity: numQty,
        pricePerShare: numPrice,
        date,
        brokerageRate: (isNaN(numRate) ? 0.5 : numRate) / 100,
      });

      setIsConfirmOpen(false);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to execute sale. Please try again.';
      setError(message);
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick helper to fill max available shares
  const handleSetMaxQuantity = () => {
    if (selectedHolding) {
      setQuantity(selectedHolding.availableShares.toString());
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Sell Stock
            </DialogTitle>
            <DialogDescription>
              Record a stock sale transaction. Realized gain or loss will be calculated based on your weighted average cost.
            </DialogDescription>
          </DialogHeader>

          {eligibleHoldings.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No shares available to sell</p>
                <p className="text-sm text-muted-foreground">
                  Your portfolio does not have any active holdings with available shares.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="mt-2"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleInitiateSell} className="space-y-4 pt-1">
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Company Selection Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="company-holding-selector">Select Holding to Sell</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={(val) => {
                    setSelectedCompanyId(val);
                    setQuantity('');
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="company-holding-selector" className="w-full">
                    <SelectValue placeholder="Select holding" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleHoldings.map((h) => (
                      <SelectItem key={h.company.id} value={h.company.id}>
                        <span className="font-medium">{h.company.name}</span>{' '}
                        <span className="text-muted-foreground text-xs font-mono">
                          ({h.company.symbol} · {h.company.exchange}) — {h.availableShares} shares
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info Badges for Selected Company */}
              {selectedHolding && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-1">
                  <Badge variant="secondary" className="px-2.5 py-1 text-xs">
                    Available:
                    <strong className="ml-1 font-mono">{selectedHolding.availableShares}</strong> shares
                  </Badge>
                  <Badge variant="outline" className="px-2.5 py-1 text-xs">
                    Avg Cost:
                    <strong className="ml-1 font-mono">
                      {formatBDT(selectedHolding.weightedAverageCost)}
                    </strong>
                  </Badge>
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 text-xs border-amber-300/60 bg-amber-50/50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                  >
                    Break-Even:
                    <strong className="ml-1 font-mono">
                      {formatBDT(selectedHolding.breakEvenPrice)}
                    </strong>
                  </Badge>
                </div>
              )}

              {/* Quantity & Price per Share */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sell-quantity">Selling Quantity</Label>
                    {selectedHolding && (
                      <button
                        type="button"
                        onClick={handleSetMaxQuantity}
                        className="text-xs font-medium text-primary hover:underline hover:text-primary/90"
                      >
                        Sell All ({selectedHolding.availableShares})
                      </button>
                    )}
                  </div>
                  <Input
                    id="sell-quantity"
                    type="number"
                    min="1"
                    max={selectedHolding?.availableShares || undefined}
                    step="1"
                    placeholder="e.g. 50"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sell-price">Selling Price per Share (৳)</Label>
                  <Input
                    id="sell-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 240.00"
                    value={pricePerShare}
                    onChange={(e) => setPricePerShare(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Selling Date & Brokerage Rate */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sell-date">Selling Date</Label>
                  <Input
                    id="sell-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sell-brokerage-rate">Brokerage Rate (%)</Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {brokerageRate || '0.5'}%
                    </span>
                  </div>
                  <Input
                    id="sell-brokerage-rate"
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

              {/* LIVE CALCULATION PREVIEW */}
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Sale Breakdown & P&amp;L Preview</span>
                  {salePreview && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium lowercase">
                      live preview
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gross Selling Amount</span>
                    <span className="font-mono font-medium text-foreground">
                      {salePreview ? formatBDT(salePreview.grossSellingAmount) : '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Selling Brokerage ({brokerageRate ? `${brokerageRate}%` : '--'})
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {salePreview
                        ? formatBDT(salePreview.sellingBrokerageAmount)
                        : '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Net Selling Amount</span>
                    <span className="font-mono font-semibold text-foreground">
                      {salePreview ? formatBDT(salePreview.netSellingAmount) : '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cost Basis of Sold Shares</span>
                    <span className="font-mono font-medium text-foreground">
                      {salePreview
                        ? formatBDT(salePreview.costBasisOfSharesSold)
                        : '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-base font-semibold">
                    <span className="text-foreground">Realized Profit / Loss</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span
                        className={
                          salePreview ? getPLColor(salePreview.realizedProfitLoss) : 'text-foreground'
                        }
                      >
                        {salePreview
                          ? formatBDT(salePreview.realizedProfitLoss)
                          : '--'}
                      </span>
                      {salePreview && (
                        <span
                          className={`text-xs ${getPLColor(
                            salePreview.realizedProfitLoss
                          )}`}
                        >
                          ({formatPercent(salePreview.realizedProfitLossPercent)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span>Remaining Shares After Sale</span>
                    <span className="font-mono font-semibold text-foreground">
                      {salePreview ? `${salePreview.remainingShares} shares` : '--'}
                    </span>
                  </div>
                </div>
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
                  variant="destructive"
                  disabled={isSubmitting || !selectedHolding}
                  className="font-medium min-w-[120px]"
                >
                  Sell Shares
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Step (AlertDialog) */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Stock Sale
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please verify the details below before completing this sale transaction. This action will deduct shares from your portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedHolding && salePreview && (
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-sm">
              <div className="flex items-center justify-between font-medium pb-2 border-b">
                <span>{selectedHolding.company.name}</span>
                <Badge variant="outline" className="font-mono">
                  {selectedHolding.company.symbol} · {selectedHolding.company.exchange}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selling Quantity</span>
                  <span className="font-mono font-medium">{quantity} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per Share</span>
                  <span className="font-mono font-medium">{formatBDT(pricePerShare)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span className="font-mono font-medium">{formatBDT(salePreview.grossSellingAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brokerage Deduction</span>
                  <span className="font-mono font-medium">{formatBDT(salePreview.sellingBrokerageAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm pt-1 border-t text-foreground">
                  <span>Net Receivable</span>
                  <span className="font-mono text-primary">{formatBDT(salePreview.netSellingAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm">
                  <span>Realized P&amp;L</span>
                  <span className={`font-mono ${getPLColor(salePreview.realizedProfitLoss)}`}>
                    {formatBDT(salePreview.realizedProfitLoss)} ({formatPercent(salePreview.realizedProfitLossPercent)})
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Remaining Shares</span>
                  <span className="font-mono font-medium text-foreground">{salePreview.remainingShares} shares</span>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isSubmitting}>
              Back to Edit
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmSale}
              disabled={isSubmitting}
              className="font-medium min-w-[130px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm &amp; Sell
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
