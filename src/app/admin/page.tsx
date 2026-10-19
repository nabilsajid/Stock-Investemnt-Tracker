'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  ShieldCheck,
  Users,
  Receipt,
  Trash2,
  Edit,
  Key,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Building2,
  ArrowLeft,
  Coins,
  Eye,
  EyeOff,
  Sun,
  Moon,
  X,
  Activity,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatBDT, formatDate, formatNumber } from '@/lib/utils';
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
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  company_id: string;
  type: 'BUY' | 'SELL';
  date: string;
  quantity: number;
  price_per_share: number;
  gross_amount: number;
  brokerage_amount: number;
  net_amount: number;
  realized_profit_loss: number | null;
  notes: string | null;
  company?: {
    name: string;
    symbol: string;
  };
}

export default function AdminDashboardPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTxn, setSearchTxn] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [txnFilterType, setTxnFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [isDemo, setIsDemo] = useState(false);

  // Edit Transaction Dialog
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdatingTxn, setIsUpdatingTxn] = useState(false);

  // User Management Dialog
  const [managingUser, setManagingUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [userUpdateMsg, setUserUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Deletion Confirmation States
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid admin credentials');
      }

      setIsAuthenticated(true);
      fetchData();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
  };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // 1. Verify admin session
      const authRes = await fetch('/api/admin/auth');
      if (authRes.status === 401) {
        setIsAuthenticated(false);
        setLoadingData(false);
        return;
      }
      setIsAuthenticated(true);

      // 2. If Supabase is configured, fetch directly in the browser
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const [profRes, txRes] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('transactions').select('*, company:companies(*)').order('date', { ascending: false }),
          ]);

          if (!profRes.error && !txRes.error) {
            setProfiles((profRes.data || []) as Profile[]);
            setTransactions((txRes.data || []) as Transaction[]);
            setIsDemo(false);
            setLoadingData(false);
            return;
          }
          console.warn('Direct browser Supabase fetch had errors:', profRes.error || txRes.error);
        } catch (clientErr) {
          console.warn('Client Supabase fetch failed, falling back:', clientErr);
        }
      }

      // 3. Fallback to server route
      const res = await fetch('/api/admin/data');
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setProfiles(data.profiles || []);
      setTransactions(data.transactions || []);
      setIsDemo(!!data.isDemo);
      if (data.errors && (data.errors.profiles || data.errors.transactions)) {
        console.warn('Admin fetch errors:', data.errors);
      }
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Perform Delete Transaction
  const confirmDeleteTransaction = async () => {
    if (!deletingTxn) return;
    setIsDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { error } = await supabase.from('transactions').delete().eq('id', deletingTxn.id);
        if (!error) {
          setTransactions((prev) => prev.filter((t) => t.id !== deletingTxn.id));
          setDeletingTxn(null);
          setIsDeleting(false);
          return;
        }
      }

      const res = await fetch(`/api/admin/transactions?id=${deletingTxn.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete transaction');
      setTransactions((prev) => prev.filter((t) => t.id !== deletingTxn.id));
      setDeletingTxn(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  // Perform Update Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    setIsUpdatingTxn(true);

    try {
      const qtyNum = parseFloat(editQty);
      const priceNum = parseFloat(editPrice);
      if (isNaN(qtyNum) || qtyNum <= 0 || isNaN(priceNum) || priceNum <= 0) {
        throw new Error('Please enter valid positive numbers for quantity and price.');
      }

      const gross = qtyNum * priceNum;
      const brokerage = gross * 0.005;
      const net = editingTxn.type === 'BUY' ? gross + brokerage : gross - brokerage;

      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { error } = await supabase
          .from('transactions')
          .update({
            quantity: qtyNum,
            price_per_share: priceNum,
            gross_amount: gross,
            brokerage_amount: brokerage,
            net_amount: net,
            notes: editNotes,
          })
          .eq('id', editingTxn.id);

        if (!error) {
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === editingTxn.id
                ? {
                    ...t,
                    quantity: qtyNum,
                    price_per_share: priceNum,
                    gross_amount: gross,
                    brokerage_amount: brokerage,
                    net_amount: net,
                    notes: editNotes,
                  }
                : t
            )
          );
          setEditingTxn(null);
          setIsUpdatingTxn(false);
          return;
        }
      }

      const res = await fetch('/api/admin/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTxn.id,
          quantity: qtyNum,
          price_per_share: priceNum,
          notes: editNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to update transaction');

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTxn.id
            ? {
                ...t,
                quantity: qtyNum,
                price_per_share: priceNum,
                gross_amount: gross,
                brokerage_amount: brokerage,
                net_amount: net,
                notes: editNotes,
              }
            : t
        )
      );
      setEditingTxn(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating transaction');
    } finally {
      setIsUpdatingTxn(false);
    }
  };

  // Perform Update User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUser) return;
    setIsUpdatingUser(true);
    setUserUpdateMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: managingUser.id,
          fullName: newFullName,
          password: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setUserUpdateMsg({ type: 'success', text: 'User details updated successfully!' });
      setProfiles((prev) =>
        prev.map((p) => (p.id === managingUser.id ? { ...p, full_name: newFullName } : p))
      );
      setTimeout(() => {
        setManagingUser(null);
        setNewPassword('');
        setUserUpdateMsg(null);
      }, 1200);
    } catch (err: unknown) {
      setUserUpdateMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error updating user',
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Perform Delete User
  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${deletingUser.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      setProfiles((prev) => prev.filter((p) => p.id !== deletingUser.id));
      setTransactions((prev) => prev.filter((t) => t.user_id !== deletingUser.id));
      setDeletingUser(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalVolume = transactions.reduce((acc, t) => acc + (t.gross_amount || 0), 0);
    const buyCount = transactions.filter((t) => t.type === 'BUY').length;
    const sellCount = transactions.filter((t) => t.type === 'SELL').length;
    const totalSharesTraded = transactions.reduce((acc, t) => acc + (t.quantity || 0), 0);

    return {
      totalVolume,
      buyCount,
      sellCount,
      totalSharesTraded,
    };
  }, [transactions]);

  // Live Recalculation for Edit Modal
  const editPreview = useMemo(() => {
    if (!editingTxn) return null;
    const q = parseFloat(editQty) || 0;
    const p = parseFloat(editPrice) || 0;
    const gross = q * p;
    const brokerage = gross * 0.005;
    const net = editingTxn.type === 'BUY' ? gross + brokerage : gross - brokerage;
    return { gross, brokerage, net };
  }, [editingTxn, editQty, editPrice]);

  // Filtered views
  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      if (txnFilterType !== 'ALL' && t.type !== txnFilterType) return false;
      if (!searchTxn.trim()) return true;
      const q = searchTxn.toLowerCase();
      const symbol = t.company?.symbol?.toLowerCase() || '';
      const name = t.company?.name?.toLowerCase() || '';
      const notes = t.notes?.toLowerCase() || '';
      const user = t.user_id?.toLowerCase() || '';
      return symbol.includes(q) || name.includes(q) || notes.includes(q) || user.includes(q);
    });
  }, [transactions, txnFilterType, searchTxn]);

  const filteredUsers = useMemo(() => {
    return profiles.filter((p) => {
      if (!searchUser.trim()) return true;
      const q = searchUser.toLowerCase();
      const email = p.email?.toLowerCase() || '';
      const name = p.full_name?.toLowerCase() || '';
      return email.includes(q) || name.includes(q) || p.id.includes(q);
    });
  }, [profiles, searchUser]);

  // 1. Refined Login View
  if (isAuthenticated === false || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center p-4 selection:bg-primary/20">
        {/* Subtle ambient decorative glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 rounded-full blur-[120px] dark:bg-primary/20" />
        </div>

        <div className="w-full max-w-md relative z-10 space-y-4">
          <div className="flex items-center justify-between px-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portfolio</span>
            </Link>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SuperAdmin Gateway</span>
            </div>
          </div>

          <Card className="shadow-2xl border-border/80 backdrop-blur-xl bg-card/80">
            <CardHeader className="text-center space-y-2 pb-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Admin Portal</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  System Administration &amp; Global Database Control
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {authError && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 animate-in fade-in-50 duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-id" className="text-xs font-semibold">
                    Admin Username
                  </Label>
                  <Input
                    id="admin-id"
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    required
                    className="h-10 text-sm bg-background/60 focus:bg-background transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-pass" className="text-xs font-semibold">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-pass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      className="h-10 text-sm pr-10 bg-background/60 focus:bg-background transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    'Sign In to Dashboard'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 2. Refined Admin Dashboard View
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Top Header with Glassmorphism */}
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mr-2 pl-1 pr-2 py-1 rounded-md border border-border/70 hover:bg-muted"
            title="Return to User Portfolio"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Portfolio</span>
          </Link>

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-bold shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base leading-none">StockTracker SuperAdmin</h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Control Panel &amp; Database Administration</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Toggle Theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" />
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loadingData}
            className="gap-1.5 h-8 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 h-8 text-xs font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Demo Mode Notice Banner */}
        {isDemo && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Simulated DSE Demo Mode:</strong> External Supabase credentials are not configured in <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">.env.local</code>. Showing simulated Dhaka Stock Exchange records and demo accounts.
              </span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px] uppercase font-bold shrink-0">
              Offline Demo
            </Badge>
          </div>
        )}

        {/* Statistics KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Total Accounts
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{profiles.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active user profiles in Supabase</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Total Transactions
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{transactions.length}</div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {metrics.buyCount} Buys
                </span>
                <span>•</span>
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  {metrics.sellCount} Sells
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Gross Turnover
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Coins className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatBDT(metrics.totalVolume)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cumulative transaction value</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Exchange Context
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Building2 className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <span>DSE &bull; CSE</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Asia/Dhaka timezone standard</p>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="transactions" className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TabsList className="bg-muted/70 p-1 rounded-xl">
              <TabsTrigger value="transactions" className="gap-2 rounded-lg text-xs font-medium">
                <Receipt className="w-3.5 h-3.5" />
                Transactions
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {transactions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 rounded-lg text-xs font-medium">
                <Users className="w-3.5 h-3.5" />
                Users
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {profiles.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <Link
              href="/"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
            >
              <span>Go to Client Dashboard</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>

          {/* TAB 1: TRANSACTIONS MANAGEMENT */}
          <TabsContent value="transactions" className="space-y-4 outline-none">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-sm">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by ticker, company, user ID, notes..."
                    value={searchTxn}
                    onChange={(e) => setSearchTxn(e.target.value)}
                    className="pl-9 pr-8 h-9 text-xs bg-background"
                  />
                  {searchTxn && (
                    <button
                      onClick={() => setSearchTxn('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => setTxnFilterType('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      txnFilterType === 'ALL'
                        ? 'bg-background shadow-xs text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxnFilterType('BUY')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      txnFilterType === 'BUY'
                        ? 'bg-background shadow-xs text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxnFilterType('SELL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      txnFilterType === 'SELL'
                        ? 'bg-background shadow-xs text-rose-600 dark:text-rose-400 font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground font-medium self-end md:self-center">
                Showing <span className="font-semibold text-foreground">{filteredTxns.length}</span> of {transactions.length} records
              </div>
            </div>

            {/* Responsive Table with Sticky Header */}
            <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md border-b text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-4 py-3">Company / Symbol</th>
                      <th className="px-3 py-3 text-center">Type</th>
                      <th className="px-4 py-3 text-right">Shares</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                      <th className="px-4 py-3 text-right font-bold text-foreground">Net Amount</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTxns.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="font-medium text-sm">No transactions match your criteria.</p>
                          {(searchTxn || txnFilterType !== 'ALL') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSearchTxn('');
                                setTxnFilterType('ALL');
                              }}
                              className="mt-3 text-xs"
                            >
                              Clear Filters
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredTxns.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/40 transition-colors group"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-medium">
                            {formatDate(t.date, 'short')}
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground max-w-[100px] truncate" title={t.user_id}>
                            <span className="bg-muted px-1.5 py-0.5 rounded border border-border/60">
                              {t.user_id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-foreground tracking-tight">
                              {t.company?.symbol || 'UNKNOWN'}
                            </span>
                            <span className="text-muted-foreground block text-[10px] truncate max-w-[150px]">
                              {t.company?.name}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                t.type === 'BUY'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  t.type === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                            {formatNumber(t.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {formatBDT(t.price_per_share)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {formatBDT(t.gross_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            {formatBDT(t.net_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:bg-primary/10"
                                title="Edit Transaction"
                                onClick={() => {
                                  setEditingTxn(t);
                                  setEditQty(String(t.quantity));
                                  setEditPrice(String(t.price_per_share));
                                  setEditNotes(t.notes || '');
                                }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                                title="Delete Transaction"
                                onClick={() => setDeletingTxn(t)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: USERS MANAGEMENT */}
          <TabsContent value="users" className="space-y-4 outline-none">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter users by email, name, or account ID..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs bg-background"
                />
                {searchUser && (
                  <button
                    onClick={() => setSearchUser('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-muted-foreground font-medium self-end md:self-center">
                Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> of {profiles.length} user accounts
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md border-b text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Email Address</th>
                      <th className="px-4 py-3">Registered On</th>
                      <th className="px-4 py-3 text-center">Account Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="font-medium text-sm">No user accounts found.</p>
                          {searchUser && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSearchUser('')}
                              className="mt-3 text-xs"
                            >
                              Clear Search
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/40 transition-colors group">
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded border border-border/60">
                              {p.id}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {p.full_name || <span className="text-muted-foreground italic">No name provided</span>}
                          </td>
                          <td className="px-4 py-3 text-foreground font-semibold">
                            {p.email}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(p.created_at, 'short')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5 font-medium shadow-2xs hover:bg-primary/5 hover:text-primary transition-colors"
                                onClick={() => {
                                  setManagingUser(p);
                                  setNewFullName(p.full_name || '');
                                  setNewPassword('');
                                  setUserUpdateMsg(null);
                                }}
                              >
                                <Key className="w-3.5 h-3.5 text-primary" />
                                <span>Modify / Reset</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                                title="Delete Account"
                                onClick={() => setDeletingUser(p)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* DIALOG: EDIT TRANSACTION WITH LIVE RECALCULATION */}
      <Dialog open={!!editingTxn} onOpenChange={(open) => !open && setEditingTxn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="w-4 h-4 text-primary" />
              Modify Transaction Record
            </DialogTitle>
            <DialogDescription className="text-xs">
              Editing{' '}
              <span className="font-semibold text-foreground">
                {editingTxn?.company?.symbol} ({editingTxn?.type})
              </span>{' '}
              from {editingTxn && formatDate(editingTxn.date, 'short')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTransaction} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-shares" className="text-xs font-semibold">
                  Quantity (Shares)
                </Label>
                <Input
                  id="edit-shares"
                  type="number"
                  min="1"
                  step="1"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-price" className="text-xs font-semibold">
                  Price per share (৳)
                </Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            {editPreview && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-1.5 text-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Recalculated Summary</span>
                  <span className="text-primary font-normal">Brokerage @ 0.5%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Amount:</span>
                  <span className="font-mono">{formatBDT(editPreview.gross)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Est. Brokerage Fee:</span>
                  <span className="font-mono">{formatBDT(editPreview.brokerage)}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/60">
                  <span>Net Amount:</span>
                  <span className="font-mono text-primary">{formatBDT(editPreview.net)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-notes" className="text-xs font-semibold">
                Reference Notes
              </Label>
              <Input
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes or broker reference"
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingTxn(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingTxn}>
                {isUpdatingTxn ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: MANAGE USER / RESET PASSWORD */}
      <Dialog open={!!managingUser} onOpenChange={(open) => !open && setManagingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              Manage User Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Target Profile:{' '}
              <span className="font-semibold text-foreground">{managingUser?.email}</span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
            {userUpdateMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  userUpdateMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {userUpdateMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{userUpdateMsg.text}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="user-name" className="text-xs font-semibold">
                User Full Name
              </Label>
              <Input
                id="user-name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs font-semibold">
                Reset Account Password
              </Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                className="text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Requires <code className="text-primary font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in environment to apply auth changes.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setManagingUser(null)}>
                Close
              </Button>
              <Button type="submit" disabled={isUpdatingUser}>
                {isUpdatingUser ? 'Updating...' : 'Save User Info'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: CONFIRM DELETE TRANSACTION */}
      <AlertDialog open={!!deletingTxn} onOpenChange={(open) => !open && setDeletingTxn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
              Delete Transaction Record?
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="text-xs space-y-2">
              <div>
                <p>
                  Are you sure you want to permanently delete this{' '}
                  <span className="font-semibold text-foreground">
                    {deletingTxn?.type} {deletingTxn?.quantity} shares of {deletingTxn?.company?.symbol}
                  </span>{' '}
                  recorded on {deletingTxn && formatDate(deletingTxn.date, 'short')}?
                </p>
                <p className="text-muted-foreground mt-2">
                  This action is irreversible and will alter the portfolio&apos;s ledger replay basis.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTransaction}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? 'Deleting...' : 'Delete Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: CONFIRM DELETE USER */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete User Profile &amp; Data?
            </AlertDialogTitle>
            <AlertDialogDescription asChild className="text-xs space-y-2">
              <div>
                <p>
                  You are about to delete the user account{' '}
                  <span className="font-semibold text-foreground">{deletingUser?.email}</span> (ID: {deletingUser?.id}).
                </p>
                <p className="text-rose-600 dark:text-rose-400 font-medium mt-2">
                  All associated portfolio holdings, transactions, and settings will be permanently removed.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
