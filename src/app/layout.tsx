import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { PortfolioProvider } from '@/components/providers/portfolio-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'StockTracker - Portfolio Manager',
  description: 'Track your Bangladeshi stock investments with precision. DSE & CSE portfolio management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
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
