'use client';

import { useState, useMemo } from 'react';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import type { Transaction, Company } from '@/lib/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  formatBDT,
  formatNumber,
  formatDate,
  getPLColor,
} from '@/lib/utils';
import {
  Search,
  Receipt,
  Calendar,
  Filter,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

export default function TransactionsPage() {
  const { transactions, companies, editTransaction, deleteTransaction, loading } = usePortfolio();

  // Filters state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Edit Dialog state
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<'BUY' | 'SELL'>('BUY');
  const [editDate, setEditDate] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editBrokeragePercent, setEditBrokeragePercent] = useState<string>('0.5');
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Delete Alert state
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Company map for fast lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies) {
      map.set(c.id, c);
    }
    return map;
  }, [companies]);

  // Filtered and sorted transactions (newest first)
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // Type filter
        if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

        // Company filter
        if (companyFilter !== 'ALL' && t.company_id !== companyFilter) return false;

        // Date range filter
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const comp = companyMap.get(t.company_id);
          const nameMatch = comp?.name.toLowerCase().includes(q) ?? false;
          const symbolMatch = comp?.symbol.toLowerCase().includes(q) ?? false;
          const notesMatch = t.notes?.toLowerCase().includes(q) ?? false;
          if (!nameMatch && !symbolMatch && !notesMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return (b.sequence || 0) - (a.sequence || 0);
      });
  }, [transactions, typeFilter, companyFilter, startDate, endDate, search, companyMap]);

  // Pagination calculation
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedTransactions = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, validPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: () => void) => {
    setter();
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setCompanyFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Open Edit Dialog
  const handleOpenEdit = (txn: Transaction) => {
    setEditingTxn(txn);
    setEditType(txn.type);
    setEditDate(txn.date);
    setEditQuantity(String(txn.quantity));
    setEditPrice(String(txn.price_per_share));
    setEditBrokeragePercent((txn.brokerage_rate * 100).toFixed(2));
    setEditError(null);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    setEditError(null);

    const qty = parseFloat(editQuantity);
    const price = parseFloat(editPrice);
    const rate = (parseFloat(editBrokeragePercent) || 0) / 100;

    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      setEditError('Quantity must be a positive whole number.');
      return;
    }

    if (isNaN(price) || price <= 0) {
      setEditError('Price per share must be greater than zero.');
      return;
    }

    if (!editDate) {
      setEditError('Please select a valid transaction date.');
      return;
    }

    setIsEditing(true);
    try {
      await editTransaction(editingTxn.id, {
        type: editType,
        date: editDate,
        quantity: qty,
        price_per_share: price,
        brokerage_rate: rate,
      });
      setEditingTxn(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update transaction';
      setEditError(msg);
    } finally {
      setIsEditing(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingTxn) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteTransaction(deletingTxn.id);
      setDeletingTxn(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete transaction';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isFiltered =
    Boolean(search) ||
    typeFilter !== 'ALL' ||
    companyFilter !== 'ALL' ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Transaction History
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete audit trail of all stock purchases and sales with realized profits and brokerage costs.
          </p>
        </div>
      </div>

      {/* Global Delete Error Alert if deletion was rejected */}
      {deleteError && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{deleteError}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteError(null)}
            className="h-7 text-xs"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company or symbol..."
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
              className="pl-9 h-10 bg-background"
            />
          </div>

          {/* Type Filter (All/Buy/Sell) */}
          <div className="md:col-span-3">
            <Tabs
              value={typeFilter}
              onValueChange={(val) =>
                handleFilterChange(() => setTypeFilter(val as 'ALL' | 'BUY' | 'SELL'))
              }
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 h-10 w-full">
                <TabsTrigger value="ALL" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="BUY" className="text-xs text-blue-600 dark:text-blue-400">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="SELL" className="text-xs text-orange-600 dark:text-orange-400">
                  Sell
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Company Filter Dropdown */}
          <div className="md:col-span-3">
            <Select
              value={companyFilter}
              onValueChange={(val) => handleFilterChange(() => setCompanyFilter(val))}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.symbol} ({c.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters Button */}
          <div className="md:col-span-2 flex items-center justify-end">
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-10 w-full"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleFilterChange(() => setStartDate(e.target.value))}
              className="h-8 text-xs w-[140px] bg-background"
              aria-label="Start date"
            />
            <span>to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleFilterChange(() => setEndDate(e.target.value))}
              className="h-8 text-xs w-[140px] bg-background"
              aria-label="End date"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {transactions.length === 0 && !loading ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Receipt className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No transactions recorded
              </h3>
              <p className="text-sm text-muted-foreground">
                When you buy or sell stocks, all trade logs and ledger entries will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredTransactions.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <p className="text-sm text-muted-foreground">
            No transactions match the selected filter criteria.
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={handleResetFilters}
            className="mt-2 text-xs"
          >
            Reset all filters
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
                    <th className="px-4 py-3.5 font-semibold">Company</th>
                    <th className="px-3 py-3.5 font-semibold text-center">Type</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Qty</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Price / Share</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Gross Amount</th>
                    <th className="px-3 py-3.5 font-semibold text-right">Brokerage</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Net Amount</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Realized P/L</th>
                    <th className="px-4 py-3.5 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedTransactions.map((t) => {
                    const comp = companyMap.get(t.company_id);
                    const isBuy = t.type === 'BUY';
                    const realizedPLColor = getPLColor(t.realized_profit_loss);

                    return (
                      <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                        {/* Date */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(t.date, 'medium')}
                        </td>

                        {/* Company */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground">
                            {comp ? comp.symbol : 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {comp ? comp.name : ''}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="px-3 py-3.5 text-center">
                          <Badge
                            variant={isBuy ? 'buy' : 'sell'}
                            className="font-bold text-[11px] px-2.5 py-0.5"
                          >
                            {t.type}
                          </Badge>
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-3.5 text-right font-medium text-foreground">
                          {formatNumber(t.quantity)}
                        </td>

                        {/* Price per share */}
                        <td className="px-3 py-3.5 text-right text-muted-foreground">
                          {formatBDT(t.price_per_share)}
                        </td>

                        {/* Gross Amount */}
                        <td className="px-3 py-3.5 text-right text-muted-foreground">
                          {formatBDT(t.gross_amount)}
                        </td>

                        {/* Brokerage */}
                        <td className="px-3 py-3.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                          <div>{formatBDT(t.brokerage_amount)}</div>
                          <div className="text-[10px]">
                            ({(t.brokerage_rate * 100).toFixed(2)}%)
                          </div>
                        </td>

                        {/* Net Amount */}
                        <td className="px-4 py-3.5 text-right font-semibold text-foreground whitespace-nowrap">
                          {formatBDT(t.net_amount)}
                        </td>

                        {/* Realized P/L (for sells only) */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {!isBuy && t.realized_profit_loss !== null ? (
                            <span className={`font-semibold ${realizedPLColor}`}>
                              {formatBDT(t.realized_profit_loss)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(t)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit transaction"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingTxn(t);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                              title="Delete transaction"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedTransactions.map((t) => {
              const comp = companyMap.get(t.company_id);
              const isBuy = t.type === 'BUY';
              const realizedPLColor = getPLColor(t.realized_profit_loss);

              return (
                <Card key={t.id} className="shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    {/* Top Row: Symbol, Type Badge, Date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">
                          {comp ? comp.symbol : 'Unknown'}
                        </span>
                        <Badge
                          variant={isBuy ? 'buy' : 'sell'}
                          className="font-bold text-[10px]"
                        >
                          {t.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(t.date, 'medium')}
                      </span>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-lg bg-muted/40">
                      <div>
                        <span className="text-muted-foreground">Qty: </span>
                        <span className="font-semibold text-foreground">
                          {formatNumber(t.quantity)} shares
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
                        <span className="text-muted-foreground">Net: </span>
                        <span className="font-bold text-foreground">
                          {formatBDT(t.net_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Realized P/L & Actions */}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <div>
                        {!isBuy && t.realized_profit_loss !== null ? (
                          <div className="text-xs">
                            <span className="text-muted-foreground">P/L: </span>
                            <span className={`font-bold ${realizedPLColor}`}>
                              {formatBDT(t.realized_profit_loss)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {comp ? comp.name : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(t)}
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingTxn(t);
                          }}
                          className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Showing {(validPage - 1) * pageSize + 1} to{' '}
              {Math.min(validPage * pageSize, totalItems)} of {totalItems} transactions
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage <= 1}
                className="h-8 px-2.5"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>

              <span className="text-xs font-medium px-2">
                Page {validPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage >= totalPages}
                className="h-8 px-2.5"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Transaction Dialog */}
      <Dialog open={editingTxn !== null} onOpenChange={(open) => !open && setEditingTxn(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Modify transaction details. Replaying will automatically recompute all affected subsequent sale positions.
            </DialogDescription>
          </DialogHeader>

          {editingTxn && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              {editError && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{editError}</span>
                </div>
              )}

              {/* Company Info (Fixed) */}
              <div className="rounded-lg border bg-muted/40 p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-semibold">
                    {companyMap.get(editingTxn.company_id)?.name || 'Company'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {companyMap.get(editingTxn.company_id)?.symbol} &bull;{' '}
                    {companyMap.get(editingTxn.company_id)?.exchange}
                  </div>
                </div>
                <Badge variant={editType === 'BUY' ? 'buy' : 'sell'}>
                  {editType}
                </Badge>
              </div>

              {/* Transaction Type Selector */}
              <div className="space-y-2">
                <Label htmlFor="edit-txn-type">Transaction Type</Label>
                <Select
                  value={editType}
                  onValueChange={(val) => setEditType(val as 'BUY' | 'SELL')}
                >
                  <SelectTrigger id="edit-txn-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Quantity (Shares)</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price Per Share (৳)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-brokerage">Brokerage Rate (%)</Label>
                  <Input
                    id="edit-brokerage"
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={editBrokeragePercent}
                    onChange={(e) => setEditBrokeragePercent(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Transaction Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTxn(null)}
                  disabled={isEditing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deletingTxn !== null}
        onOpenChange={(open) => !open && setDeletingTxn(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deletingTxn?.type} transaction of{' '}
              {deletingTxn && formatNumber(deletingTxn.quantity)} shares?
              <br /><br />
              This action cannot be undone. If deleting this purchase would cause subsequent sales to exceed available inventory, the operation will be rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Transaction'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
