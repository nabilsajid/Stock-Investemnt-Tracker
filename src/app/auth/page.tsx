'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePortfolio } from '@/components/providers/portfolio-provider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: authLoading, isConfigured, signIn, signUp } = usePortfolio();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.';
      if (message.toLowerCase().includes('invalid login credentials')) {
        message = 'Invalid email or password. If you haven\'t created an account yet, click "Sign Up" below.';
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, fullName.trim() || undefined);
      setSuccess('Account created! If email confirmation is enabled in your Supabase project, check your inbox. Otherwise you can sign in directly.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onTabChange = (value: string) => {
    setActiveTab(value as 'signin' | 'signup');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-b from-background via-muted/30 to-background">
      <div className="w-full max-w-md space-y-6">
        {/* Brand / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground shadow-md mb-1">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">StockTracker</h1>
          <p className="text-sm text-muted-foreground">
            Bangladeshi Stock Portfolio Management &bull; DSE &amp; CSE
          </p>
        </div>

        {/* Configuration Notice if not configured */}
        {!isConfigured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60 p-4 text-sm text-amber-800 dark:text-amber-300">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Supabase is not configured</p>
                <p className="mt-1 text-xs">
                  Configure your Supabase URL and anon key in <code className="font-mono bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">.env.local</code> to enable cloud sync and authentication.
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/')}
                    className="text-xs bg-background hover:bg-muted font-medium inline-flex items-center gap-1.5"
                  >
                    <span>Explore in Demo Mode</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Card className="shadow-lg border-border/80 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            {/* Error Message */}
            {error && (
              <div className="px-6 pb-2">
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 animate-in fade-in-50 duration-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="flex-1 leading-snug">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="px-6 pb-2">
                <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300 animate-in fade-in-50 duration-200">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <p className="flex-1 leading-snug">{success}</p>
                </div>
              </div>
            )}

            <TabsContent value="signin" className="mt-0">
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !isConfigured}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => onTabChange('signup')}
                      className="font-medium text-primary hover:underline underline-offset-4"
                    >
                      Sign up now
                    </button>
                  </p>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Rahim Ahmed"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !isConfigured}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => onTabChange('signin')}
                      className="font-medium text-primary hover:underline underline-offset-4"
                    >
                      Sign in instead
                    </button>
                  </p>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground">
          Track Dhaka Stock Exchange (DSE) &amp; Chittagong Stock Exchange (CSE) portfolios with precision.
        </p>
      </div>
    </div>
  );
}
