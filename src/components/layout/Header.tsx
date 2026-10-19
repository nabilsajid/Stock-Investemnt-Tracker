'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sun,
  Moon,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  Briefcase,
  Receipt,
  Settings,
  Menu,
  X,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { usePortfolio } from '@/components/providers/portfolio-provider';

const mobileNavLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') {
    return 'Dashboard';
  }
  if (pathname.startsWith('/holdings')) {
    return 'My Holdings';
  }
  if (pathname.startsWith('/transactions')) {
    return 'Transactions';
  }
  if (pathname.startsWith('/settings')) {
    return 'Settings';
  }

  // Derive title from current segment
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return 'Dashboard';
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = usePortfolio();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu when navigating to another route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
          </div>
        </div>

        {/* Right: Currency Indicator, Theme Toggle, User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* BDT Currency indicator */}
          <Badge
            variant="outline"
            className="h-8 gap-1.5 px-2.5 font-medium bg-muted/40 border-border/80 hover:bg-muted/60 transition-colors select-none"
            title="Bangladeshi Taka (BDT / ৳)"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold text-xs tracking-tight text-foreground">
              BDT
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              (৳)
            </span>
          </Badge>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={
              mounted && resolvedTheme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-all" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700 transition-all" />
              )
            ) : (
              <span className="h-4 w-4 inline-block" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full border border-border p-0 hover:ring-2 hover:ring-ring hover:ring-offset-1 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="User account menu"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs uppercase">
                  {user?.email ? (
                    user.email.slice(0, 2).toUpperCase()
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-1">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {user?.user_metadata?.full_name || 'Portfolio Account'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user?.email || 'Guest User'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/" className="cursor-pointer flex items-center">
                  <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/holdings" className="cursor-pointer flex items-center">
                  <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Holdings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/transactions"
                  className="cursor-pointer flex items-center"
                >
                  <Receipt className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Transactions</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer flex items-center">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user ? (
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="cursor-pointer text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href="/auth" className="cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Sign In</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/98 backdrop-blur-md px-4 py-3 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-tight">
                StockTracker
              </span>
            </div>
            <Badge variant="outline" className="gap-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>BDT (৳)</span>
            </Badge>
          </div>

          <nav className="space-y-1">
            {mobileNavLinks.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="text-xs text-rose-600 dark:text-rose-400 gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
