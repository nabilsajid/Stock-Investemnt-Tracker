import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { PortfolioProvider } from '@/components/providers/portfolio-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'StockTracker - Portfolio Manager',
  description: 'Track your Bangladeshi stock investments with precision. DSE & CSE portfolio management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PortfolioProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
