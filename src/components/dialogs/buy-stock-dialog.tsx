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

interface BuyStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCompanyId?: string;
}

export function BuyStockDialog({
  open,
  onOpenChange,
  preselectedCompanyId,
}: BuyStockDialogProps) {
  const { companies, settings, addPurchase } = usePortfolio();

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState<'DSE' | 'CSE'>('DSE');
  const [quantity, setQuantity] = useState<string>('');
  const [pricePerShare, setPricePerShare] = useState<string>('');
  const [brokeragePercent, setBrokeragePercent] = useState<string>('0.5');
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default brokerage rate from settings
  useEffect(() => {
    if (settings?.default_buying_brokerage_rate !== undefined) {
      setBrokeragePercent((settings.default_buying_brokerage_rate * 100).toFixed(2));
    }
  }, [settings]);

  // Handle preselected company
  useEffect(() => {
    if (preselectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
      setMode('existing');
    } else if (companies.length === 0) {
      setMode('new');
    }
  }, [preselectedCompanyId, companies.length, open]);

  // When selected company changes in existing mode
  useEffect(() => {
    if (mode === 'existing' && selectedCompanyId) {
      const comp = companies.find((c) => c.id === selectedCompanyId);
      if (comp) {
        setCompanyName(comp.name);
        setSymbol(comp.symbol);
        setExchange(comp.exchange);
      }
    }
  }, [mode, selectedCompanyId, companies]);

  const resetForm = () => {
    if (!preselectedCompanyId) {
      setSelectedCompanyId('');
      setCompanyName('');
      setSymbol('');
      setMode(companies.length > 0 ? 'existing' : 'new');
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

  const grossAmount = qtyNum * priceNum;
  const brokerageAmount = grossAmount * rateNum;
  const totalCost = grossAmount + brokerageAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalName = mode === 'existing' ? companyName : companyName.trim();
    const finalSymbol = mode === 'existing' ? symbol : symbol.trim().toUpperCase();

    if (!finalName || !finalSymbol) {
      setError('Please provide company name and symbol.');
      return;
    }

    if (qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      setError('Quantity must be a positive whole number.');
      return;
    }

    if (priceNum <= 0) {
      setError('Price per share must be greater than zero.');
      return;
    }

    if (!date) {
      setError('Please select a transaction date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addPurchase({
        companyName: finalName,
        symbol: finalSymbol,
        exchange,
        quantity: qtyNum,
        pricePerShare: priceNum,
        date,
        brokerageRate: rateNum,
      });

      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record purchase';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buy Stock</DialogTitle>
          <DialogDescription>
            Record a stock purchase for your portfolio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher (if not locked to preselected and companies exist) */}
          {!preselectedCompanyId && companies.length > 0 && (
            <div className="flex rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                  mode === 'existing'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Existing Company
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setSelectedCompanyId('');
                  setCompanyName('');
                  setSymbol('');
                }}
                className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
                  mode === 'new'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                + New Company
              </button>
            </div>
          )}

          {mode === 'existing' && companies.length > 0 && !preselectedCompanyId ? (
            <div className="space-y-2">
              <Label htmlFor="company-select">Select Company</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={(val) => setSelectedCompanyId(val)}
              >
                <SelectTrigger id="company-select">
                  <SelectValue placeholder="Choose a company..." />
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g. Beximco Pharmaceuticals Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={Boolean(preselectedCompanyId) || isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g. BXPHARMA"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  disabled={Boolean(preselectedCompanyId) || isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exchange">Exchange</Label>
                <Select
                  value={exchange}
                  onValueChange={(val) => setExchange(val as 'DSE' | 'CSE')}
                  disabled={Boolean(preselectedCompanyId) || isSubmitting}
                >
                  <SelectTrigger id="exchange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSE">DSE (Dhaka)</SelectItem>
                    <SelectItem value="CSE">CSE (Chittagong)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (Shares)</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price Per Share (৳)</Label>
              <Input
                id="price"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="150.50"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="brokerage">Brokerage Rate (%)</Label>
              <Input
                id="brokerage"
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
              <Label htmlFor="date">Transaction Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Cost preview breakdown */}
          {qtyNum > 0 && priceNum > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Value ({qtyNum} × ৳{priceNum.toFixed(2)})</span>
                <span className="font-medium text-foreground">{formatBDT(grossAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Brokerage ({brokeragePercent || 0}%)</span>
                <span className="font-medium text-foreground">+{formatBDT(brokerageAmount)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between font-semibold text-sm">
                <span>Total Purchase Cost</span>
                <span className="text-primary">{formatBDT(totalCost)}</span>
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
            <Button type="submit" disabled={isSubmitting}>
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
