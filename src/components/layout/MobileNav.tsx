'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: Briefcase },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-lg"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1 transition-all relative select-none',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Active top indicator pill */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-primary rounded-full transition-all duration-200" />
              )}
              <item.icon
                className={cn(
                  'h-5 w-5 transition-transform duration-200',
                  isActive ? 'scale-110' : 'scale-100'
                )}
              />
              <span className="text-[11px] leading-tight tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area spacer for iOS home indicators */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
