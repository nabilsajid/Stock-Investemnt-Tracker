'use client';

import React, { useState, useEffect } from 'react';
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
import { usePortfolio } from '@/components/providers/portfolio-provider';
import { formatBDT } from '@/lib/utils';
import { Loader2, TrendingUp, AlertCircle, Clock } from 'lucide-react';

export interface UpdatePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  companyName?: string;
  currentPrice?: number;
  lastUpdated?: string;
}

/**
 * Format timestamp in Asia/Dhaka with date and time
 */
function formatLastUpdated(dateStr?: string): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function UpdatePriceDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  currentPrice,
  lastUpdated,
}: UpdatePriceDialogProps) {
  const { updateMarketPrice } = usePortfolio();

  const [priceInput, setPriceInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the dialog opens or the company changes
  useEffect(() => {
    if (open) {
      setError(null);
      setIsSubmitting(false);
      setPriceInput(currentPrice ? currentPrice.toString() : '');
    }
  }, [open, currentPrice, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyId) {
      setError('Missing company identifier.');
      return;
    }

    const numPrice = parseFloat(priceInput);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid market price greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMarketPrice(companyId, numPrice);
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update market price. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingPrice = currentPrice !== undefined && currentPrice !== null && currentPrice > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" />
            Update Market Price
          </DialogTitle>
          <DialogDescription>
            {companyName ? (
              <span className="font-medium text-foreground">{companyName}</span>
            ) : (
              'Set manual market price for this stock'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Price Info / Prompt */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            {hasExistingPrice ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current price:</span>
                  <span className="font-semibold font-mono text-foreground">
                    {formatBDT(currentPrice)}
                  </span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last updated:
                    </span>
                    <span className="font-mono">{formatLastUpdated(lastUpdated)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Enter the current market price for this stock. This will be used to calculate unrealized gains and losses.
              </p>
            )}
          </div>

          {/* New Market Price Input */}
          <div className="space-y-1.5">
            <Label htmlFor="market-price-input">New Market Price (৳)</Label>
            <Input
              id="market-price-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
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
              disabled={isSubmitting || !priceInput}
              className="font-medium min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Price'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
