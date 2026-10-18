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
import { formatBDT } from '@/lib/utils';
import { AlertCircle, Loader2 } from 'lucide-react';

interface UpdatePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string;
}

export function UpdatePriceDialog({
  open,
  onOpenChange,
  preselectedCompanyId,
}: UpdatePriceDialogProps) {
  const { companies, marketPrices, updateMarketPrice } = usePortfolio();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preselectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
      const existing = marketPrices.find((p) => p.company_id === preselectedCompanyId);
      if (existing) {
        setPrice(String(existing.price));
      } else {
        setPrice('');
      }
    } else if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
      const existing = marketPrices.find((p) => p.company_id === companies[0].id);
      if (existing) {
        setPrice(String(existing.price));
      }
    }
  }, [preselectedCompanyId, companies, marketPrices, selectedCompanyId, open]);

  const activeCompany = companies.find((c) => c.id === selectedCompanyId);
  const currentRecordedPrice = marketPrices.find((p) => p.company_id === selectedCompanyId);

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const existing = marketPrices.find((p) => p.company_id === companyId);
    setPrice(existing ? String(existing.price) : '');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
      if (!preselectedCompanyId) {
        setPrice('');
      }
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCompanyId) {
      setError('Please select a company.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Market price must be a valid number greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateMarketPrice(selectedCompanyId, priceNum);
      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update market price';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Market Price</DialogTitle>
          <DialogDescription>
            Enter the latest market price from DSE or CSE to compute your live portfolio valuation and unrealized P/L.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {preselectedCompanyId && activeCompany ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="font-semibold text-sm">{activeCompany.name}</div>
              <div className="text-xs text-muted-foreground">
                {activeCompany.symbol} &bull; {activeCompany.exchange}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="price-company-select">Company</Label>
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger id="price-company-select">
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.symbol}) - {c.exchange}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="market-price-input">Current Market Price (৳)</Label>
              {currentRecordedPrice && (
                <span className="text-xs text-muted-foreground">
                  Recorded: {formatBDT(currentRecordedPrice.price)}
                </span>
              )}
            </div>
            <Input
              id="market-price-input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 154.20"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
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
