'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  LayoutDashboard,
  Briefcase,
  Receipt,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { usePortfolio } from '@/components/providers/portfolio-provider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = usePortfolio();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored) setCollapsed(stored === 'true');
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out h-screen sticky top-0 shrink-0 z-30',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <Link
          href="/"
          className={cn(
            'flex items-center h-16 px-4 border-b transition-colors hover:bg-muted/50',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0 shadow-sm">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight text-card-foreground">
              StockTracker
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-0'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t space-y-2">
          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            onClick={toggleCollapse}
            className={cn('w-full', collapsed ? '' : 'justify-start')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" />
                <span className="ml-2">Collapse</span>
              </>
            )}
          </Button>

          {/* User info & Logout */}
          {user && (
            <div
              className={cn(
                'flex items-center gap-2 pt-1',
                collapsed && 'justify-center'
              )}
            >
              {!collapsed && (
                <span
                  className="text-xs text-muted-foreground truncate flex-1"
                  title={user.email}
                >
                  {user.email}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut()}
                    className="shrink-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                    title="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={collapsed ? 'right' : 'top'}>
                  Sign Out
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
