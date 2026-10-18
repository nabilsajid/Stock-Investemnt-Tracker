'use client';

import React, { useState, useEffect } from 'react';
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
  DialogFooter,
} from '@/components/ui/dialog';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTxn, setSearchTxn] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // Edit Transaction Dialog
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdatingTxn, setIsUpdatingTxn] = useState(false);

  // Password / User Dialog
  const [managingUser, setManagingUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [userUpdateMsg, setUserUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Check login state on mount
  useEffect(() => {
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
        throw new Error(data.error || 'Invalid credentials');
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
      const res = await fetch('/api/admin/data');
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      const data = await res.json();
      setProfiles(data.profiles || []);
      setTransactions(data.transactions || []);
      if (data.errors && (data.errors.profiles || data.errors.transactions)) {
        console.warn('Admin fetch errors:', data.errors);
      }
      setIsAuthenticated(true);
    } catch (e) {
      console.error(e);
      setIsAuthenticated(false);
    } finally {
      setLoadingData(false);
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this transaction?')) return;

    try {
      const res = await fetch(`/api/admin/transactions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete transaction');
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting transaction');
    }
  };

  // Update Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    setIsUpdatingTxn(true);

    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTxn.id,
          quantity: parseFloat(editQty),
          price_per_share: parseFloat(editPrice),
          notes: editNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to update transaction');

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTxn.id
            ? {
                ...t,
                quantity: parseFloat(editQty),
                price_per_share: parseFloat(editPrice),
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

  // Update User Details / Password
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

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user profile? All associated data will be removed.')) return;

    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
      setTransactions((prev) => prev.filter((t) => t.user_id !== userId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting user');
    }
  };

  // 1. Login View
  if (isAuthenticated === false || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-border/80">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
            <CardDescription className="text-xs">
              System administration and account management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {authError && (
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="admin-id">Admin ID</Label>
                <Input
                  id="admin-id"
                  placeholder="admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Password</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? 'Verifying...' : 'Sign In as Administrator'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filtered views
  const filteredTxns = transactions.filter((t) => {
    if (!searchTxn.trim()) return true;
    const q = searchTxn.toLowerCase();
    const symbol = t.company?.symbol?.toLowerCase() || '';
    const name = t.company?.name?.toLowerCase() || '';
    const notes = t.notes?.toLowerCase() || '';
    return symbol.includes(q) || name.includes(q) || notes.includes(q);
  });

  const filteredUsers = profiles.filter((p) => {
    if (!searchUser.trim()) return true;
    const q = searchUser.toLowerCase();
    const email = p.email?.toLowerCase() || '';
    const name = p.full_name?.toLowerCase() || '';
    return email.includes(q) || name.includes(q) || p.id.includes(q);
  });

  // 2. Admin Dashboard View
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Top Header */}
      <header className="border-b bg-card sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">StockTracker SuperAdmin</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Control Panel &amp; Database Administration</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingData} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLogout} className="gap-1.5 h-8 text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Total Accounts</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profiles.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Registered user profiles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Total Transactions</CardTitle>
              <Receipt className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Buy &amp; Sell records logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Exchange Standard</CardTitle>
              <Building2 className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">DSE</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dhaka Stock Exchange</p>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-sm mb-4">
            <TabsTrigger value="transactions" className="gap-2">
              <Receipt className="w-4 h-4" />
              Transactions ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users ({profiles.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TRANSACTIONS MANAGEMENT */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter transactions by stock..."
                  value={searchTxn}
                  onChange={(e) => setSearchTxn(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Showing {filteredTxns.length} records
              </span>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 uppercase font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">User ID</th>
                      <th className="px-3 py-3">Company</th>
                      <th className="px-2 py-3 text-center">Type</th>
                      <th className="px-3 py-3 text-right">Shares</th>
                      <th className="px-3 py-3 text-right">Price</th>
                      <th className="px-3 py-3 text-right">Gross</th>
                      <th className="px-3 py-3 text-right">Net</th>
                      <th className="px-4 py-3 text-center">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTxns.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {formatDate(t.date, 'short')}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground max-w-[90px] truncate" title={t.user_id}>
                          {t.user_id.slice(0, 8)}...
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold">{t.company?.symbol || 'UNKNOWN'}</span>
                          <span className="text-muted-foreground block text-[10px] truncate max-w-[140px]">
                            {t.company?.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Badge variant={t.type === 'BUY' ? 'buy' : 'sell'} className="text-[10px] px-1.5 py-0">
                            {t.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatNumber(t.quantity)}</td>
                        <td className="px-3 py-2.5 text-right">{formatBDT(t.price_per_share)}</td>
                        <td className="px-3 py-2.5 text-right">{formatBDT(t.gross_amount)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatBDT(t.net_amount)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:bg-primary/10"
                              title="Modify transaction"
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
                              className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Delete transaction"
                              onClick={() => handleDeleteTransaction(t.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: USERS MANAGEMENT */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter users by email or name..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Showing {filteredUsers.length} accounts
              </span>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 uppercase font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Email Address</th>
                      <th className="px-3 py-3">Created Date</th>
                      <th className="px-4 py-3 text-center">Account Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {p.id}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {p.full_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-foreground font-semibold">
                          {p.email}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatDate(p.created_at, 'short')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setManagingUser(p);
                                setNewFullName(p.full_name || '');
                                setNewPassword('');
                                setUserUpdateMsg(null);
                              }}
                            >
                              <Key className="w-3 h-3 text-primary" />
                              Modify / Password
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Delete Account"
                              onClick={() => handleDeleteUser(p.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* DIALOG: EDIT TRANSACTION */}
      <Dialog open={!!editingTxn} onOpenChange={(open) => !open && setEditingTxn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Modify Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTransaction} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <Label htmlFor="edit-shares">Quantity (Shares)</Label>
              <Input
                id="edit-shares"
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-price">Price per share (৳)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-notes">Notes / Reference</Label>
              <Input
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingTxn(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingTxn}>
                {isUpdatingTxn ? 'Saving...' : 'Update Transaction'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: MODIFY USER / RESET PASSWORD */}
      <Dialog open={!!managingUser} onOpenChange={(open) => !open && setManagingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Manage User Account</DialogTitle>
            <CardDescription className="text-xs">
              Account: <span className="font-semibold text-foreground">{managingUser?.email}</span>
            </CardDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-3.5 pt-2">
            {userUpdateMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  userUpdateMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                {userUpdateMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{userUpdateMsg.text}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="new-pass">New Password (leave blank to keep unchanged)</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter a new password if you want to reset this user&apos;s credentials.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setManagingUser(null)}>
                Close
              </Button>
              <Button type="submit" disabled={isUpdatingUser}>
                {isUpdatingUser ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
