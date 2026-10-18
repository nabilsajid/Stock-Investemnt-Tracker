'use client';

import { useState, useEffect } from 'react';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import { useTheme } from 'next-themes';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Percent,
  Monitor,
  Sun,
  Moon,
  Database,
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  ShieldCheck,
  Globe,
  Clock,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, settings, updateSettings, signOut, isConfigured } = usePortfolio();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [mounted, setMounted] = useState(false);

  // Brokerage state
  const [buyingRate, setBuyingRate] = useState<string>('0.50');
  const [sellingRate, setSellingRate] = useState<string>('0.50');
  const [isSavingBrokerage, setIsSavingBrokerage] = useState(false);
  const [brokerageSuccess, setBrokerageSuccess] = useState(false);
  const [brokerageError, setBrokerageError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      if (settings.default_buying_brokerage_rate !== undefined) {
        setBuyingRate((settings.default_buying_brokerage_rate * 100).toFixed(2));
      }
      if (settings.default_selling_brokerage_rate !== undefined) {
        setSellingRate((settings.default_selling_brokerage_rate * 100).toFixed(2));
      }
    }
  }, [settings]);

  const handleSaveBrokerage = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrokerageError(null);
    setBrokerageSuccess(false);

    const buyNum = parseFloat(buyingRate);
    const sellNum = parseFloat(sellingRate);

    if (isNaN(buyNum) || buyNum < 0 || buyNum > 10) {
      setBrokerageError('Buying brokerage rate must be between 0% and 10%.');
      return;
    }

    if (isNaN(sellNum) || sellNum < 0 || sellNum > 10) {
      setBrokerageError('Selling brokerage rate must be between 0% and 10%.');
      return;
    }

    setIsSavingBrokerage(true);
    try {
      await updateSettings({
        default_buying_brokerage_rate: buyNum / 100,
        default_selling_brokerage_rate: sellNum / 100,
      });
      setBrokerageSuccess(true);
      setTimeout(() => setBrokerageSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update brokerage rates';
      setBrokerageError(msg);
    } finally {
      setIsSavingBrokerage(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure default brokerage fees, display preferences, database connections, and your account.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Brokerage Defaults */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Brokerage Defaults</CardTitle>
            </div>
            <CardDescription>
              Set default brokerage commissions applied when recording new buy and sell orders.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSaveBrokerage}>
            <CardContent className="space-y-4">
              {brokerageError && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{brokerageError}</span>
                </div>
              )}

              {brokerageSuccess && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Brokerage settings saved successfully!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buying-rate">Default Buying Brokerage Rate (%)</Label>
                  <div className="relative">
                    <Input
                      id="buying-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="0.50"
                      value={buyingRate}
                      onChange={(e) => setBuyingRate(e.target.value)}
                      disabled={isSavingBrokerage}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Added to buy gross value to determine total purchase cost.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selling-rate">Default Selling Brokerage Rate (%)</Label>
                  <div className="relative">
                    <Input
                      id="selling-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="0.50"
                      value={sellingRate}
                      onChange={(e) => setSellingRate(e.target.value)}
                      disabled={isSavingBrokerage}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Deducted from sell gross value to determine net proceeds.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">Standard Market Practices:</span>
                <p>
                  In Dhaka (DSE) and Chittagong (CSE), standard brokerage houses typically charge between 0.25% and 0.50% per trade transaction.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2 border-t">
              <Button type="submit" disabled={isSavingBrokerage}>
                {isSavingBrokerage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Rates...
                  </>
                ) : (
                  'Save Brokerage Rates'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Section 2: Display & Formatting */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Display & Localization</CardTitle>
            </div>
            <CardDescription>
              Localization standards and visual appearance preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Currency */}
              <div className="p-3.5 rounded-lg border bg-card space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Base Currency</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground">
                    BDT (৳) &bull; Bangladeshi Taka
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Read-only
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Formatted using Bangladeshi numbering system (lakhs & crores).
                </p>
              </div>

              {/* Timezone */}
              <div className="p-3.5 rounded-lg border bg-card space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Trading Timezone</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground">
                    Asia/Dhaka (GMT+6)
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Read-only
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Aligns with Dhaka & Chittagong Stock Exchange operating sessions.
                </p>
              </div>
            </div>

            <Separator />

            {/* Theme Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Appearance Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                    mounted && (theme === 'light' || (!theme && resolvedTheme === 'light'))
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Sun className="h-5 w-5 mb-1.5" />
                  <span>Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                    mounted && theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Moon className="h-5 w-5 mb-1.5" />
                  <span>Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                    mounted && theme === 'system'
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Monitor className="h-5 w-5 mb-1.5" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Database & Infrastructure */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Database & Synchronization</CardTitle>
            </div>
            <CardDescription>
              Backend connection health and database schema details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    isConfigured
                      ? 'bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse'
                      : 'bg-rose-500 ring-4 ring-rose-500/20'
                  }`}
                />
                <div>
                  <div className="font-semibold text-sm text-foreground">
                    {isConfigured ? 'Supabase Connected' : 'Supabase Not Configured'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isConfigured
                      ? 'Cloud PostgreSQL database with Row Level Security (RLS) active'
                      : 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'}
                  </div>
                </div>
              </div>
              <Badge variant={isConfigured ? 'success' : 'danger'} className="text-xs">
                {isConfigured ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="rounded-lg border p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FileCode className="h-4 w-4 text-primary" />
                <span>Database Migrations Schema</span>
              </div>
              <p className="text-muted-foreground">
                Schema definitions, tables, triggers, and RLS policies are version-controlled in:
              </p>
              <div className="font-mono bg-muted p-2 rounded text-[11px] text-foreground overflow-x-auto">
                supabase/migrations/20261018000000_init_portfolio_tracker.sql
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Includes <code className="font-mono">companies</code>, <code className="font-mono">transactions</code>, <code className="font-mono">market_prices</code>, <code className="font-mono">user_settings</code></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Account */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Account</CardTitle>
            </div>
            <CardDescription>
              Authenticated session information and account management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border bg-card gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="font-semibold text-foreground text-sm">
                  {user?.email || 'Guest User'}
                </div>
                {user?.id && (
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    User UUID: {user.id}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="w-fit text-xs">
                Authenticated
              </Badge>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Sign out from this device session.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 border-rose-200 dark:border-rose-900"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
