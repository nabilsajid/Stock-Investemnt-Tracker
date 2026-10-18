'use client';

import { useState, useEffect } from 'react';
import { usePortfolio } from '@/components/providers/portfolio-provider';
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
import { formatBDT, formatNumber, getPLColor } from '@/lib/utils';
import { AlertCircle, Loader2 } from 'lucide-react';

interface SellStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string;
}

export function SellStockDialog({
  open,
  onOpenChange,
  preselectedCompanyId,
}: SellStockDialogProps) {
  const { holdings, settings, addSale } = usePortfolio();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [pricePerShare, setPricePerShare] = useState<string>('');
  const [brokeragePercent, setBrokeragePercent] = useState<string>('0.5');
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter holdings that have available shares to sell
  const availableHoldings = holdings.filter((h) => h.availableShares > 0);

  // Sync default selling brokerage rate from settings
  useEffect(() => {
    if (settings?.default_selling_brokerage_rate !== undefined) {
      setBrokeragePercent((settings.default_selling_brokerage_rate * 100).toFixed(2));
    }
  }, [settings]);

  // Set selected company
  useEffect(() => {
    if (preselectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
    } else if (availableHoldings.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(availableHoldings[0].company.id);
    }
  }, [preselectedCompanyId, availableHoldings, selectedCompanyId, open]);

  const activeHolding = holdings.find((h) => h.company.id === selectedCompanyId);

  const resetForm = () => {
    if (!preselectedCompanyId) {
      setSelectedCompanyId(availableHoldings[0]?.company.id || '');
    }
    setQuantity('');
    setPricePerShare('');
    setDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(pricePerShare) || 0;
  const rateNum = (parseFloat(brokeragePercent) || 0) / 100;
  const avgCostNum = activeHolding ? parseFloat(activeHolding.weightedAverageCost) || 0 : 0;

  const grossSellingAmount = qtyNum * priceNum;
  const brokerageAmount = grossSellingAmount * rateNum;
  const netSellingAmount = grossSellingAmount - brokerageAmount;
  const costBasisOfSold = qtyNum * avgCostNum;
  const estimatedRealizedPL = netSellingAmount - costBasisOfSold;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCompanyId) {
      setError('Please select a company to sell.');
      return;
    }

    if (!activeHolding) {
      setError('Selected company holding not found.');
      return;
    }

    if (qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      setError('Quantity must be a positive whole number.');
      return;
    }

    if (qtyNum > activeHolding.availableShares) {
      setError(
        `Cannot sell ${qtyNum} shares. Only ${formatNumber(activeHolding.availableShares)} shares available.`
      );
      return;
    }

    if (priceNum <= 0) {
      setError('Selling price per share must be greater than zero.');
      return;
    }

    if (!date) {
      setError('Please select a transaction date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addSale({
        companyId: selectedCompanyId,
        quantity: qtyNum,
        pricePerShare: priceNum,
        date,
        brokerageRate: rateNum,
      });

      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record sale';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Stock</DialogTitle>
          <DialogDescription>
            Record a stock sale and realize your profit or loss.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Company selector */}
          <div className="space-y-2">
            <Label htmlFor="sell-company-select">Company Position</Label>
            {preselectedCompanyId && activeHolding ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm flex justify-between items-center">
                <div>
                  <div className="font-semibold">{activeHolding.company.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {activeHolding.company.symbol} &bull; {activeHolding.company.exchange}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="font-bold text-foreground">
                    {formatNumber(activeHolding.availableShares)} shares
                  </div>
                </div>
              </div>
            ) : availableHoldings.length === 0 ? (
              <div className="p-3 text-sm rounded-lg bg-muted text-muted-foreground">
                No active stock holdings available to sell.
              </div>
            ) : (
              <Select
                value={selectedCompanyId}
                onValueChange={(val) => {
                  setSelectedCompanyId(val);
                  setQuantity('');
                }}
              >
                <SelectTrigger id="sell-company-select">
                  <SelectValue placeholder="Select a holding to sell..." />
                </SelectTrigger>
                <SelectContent>
                  {availableHoldings.map((h) => (
                    <SelectItem key={h.company.id} value={h.company.id}>
                      {h.company.name} ({h.company.symbol}) — {formatNumber(h.availableShares)} shares
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {activeHolding && (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/50 text-xs">
              <div>
                <span className="text-muted-foreground">Available Shares:</span>{' '}
                <span className="font-semibold text-foreground">
                  {formatNumber(activeHolding.availableShares)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Purchase Cost:</span>{' '}
                <span className="font-semibold text-foreground">
                  {formatBDT(activeHolding.weightedAverageCost)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Break-Even Price:</span>{' '}
                <span className="font-semibold text-foreground">
                  {formatBDT(activeHolding.breakEvenPrice)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Market Price:</span>{' '}
                <span className="font-semibold text-foreground">
                  {activeHolding.marketPrice ? formatBDT(activeHolding.marketPrice.price) : 'Not set'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="sell-quantity">Quantity to Sell</Label>
                {activeHolding && (
                  <button
                    type="button"
                    onClick={() => setQuantity(String(activeHolding.availableShares))}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Sell Max ({formatNumber(activeHolding.availableShares)})
                  </button>
                )}
              </div>
              <Input
                id="sell-quantity"
                type="number"
                min="1"
                max={activeHolding ? activeHolding.availableShares : undefined}
                step="1"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting || !activeHolding}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-price">Selling Price Per Share (৳)</Label>
              <Input
                id="sell-price"
                type="number"
                min="0.01"
                step="0.01"
                placeholder={
                  activeHolding?.marketPrice
                    ? String(activeHolding.marketPrice.price)
                    : '160.00'
                }
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                disabled={isSubmitting || !activeHolding}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sell-brokerage">Brokerage Rate (%)</Label>
              <Input
                id="sell-brokerage"
                type="number"
                min="0"
                max="5"
                step="0.01"
                placeholder="0.50"
                value={brokeragePercent}
                onChange={(e) => setBrokeragePercent(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sell-date">Transaction Date</Label>
              <Input
                id="sell-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Realized P/L calculation breakdown */}
          {qtyNum > 0 && priceNum > 0 && activeHolding && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Proceeds ({qtyNum} × ৳{priceNum.toFixed(2)})</span>
                <span className="font-medium text-foreground">{formatBDT(grossSellingAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Selling Brokerage ({brokeragePercent || 0}%)</span>
                <span className="font-medium text-foreground">-{formatBDT(brokerageAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Net Proceeds</span>
                <span className="font-semibold text-foreground">{formatBDT(netSellingAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cost Basis of Shares ({qtyNum} × ৳{avgCostNum.toFixed(2)})</span>
                <span className="font-medium text-foreground">{formatBDT(costBasisOfSold)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between font-bold text-sm">
                <span>Estimated Realized P/L</span>
                <span className={getPLColor(estimatedRealizedPL)}>
                  {formatBDT(estimatedRealizedPL)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || !activeHolding || availableHoldings.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording Sale...
                </>
              ) : (
                'Confirm Sale'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
