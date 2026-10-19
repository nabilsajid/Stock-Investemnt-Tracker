import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/client';

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return token === 'stocktracker_superadmin_authenticated';
}

const DEMO_PROFILES = [
  {
    id: 'usr_dse_91a021',
    email: 'tanvir.ahmed@investor.bd',
    full_name: 'Tanvir Ahmed',
    created_at: '2026-09-15T08:30:00Z',
  },
  {
    id: 'usr_dse_84b720',
    email: 'nusrat.jahan@fintech.bd',
    full_name: 'Nusrat Jahan',
    created_at: '2026-10-01T10:15:00Z',
  },
  {
    id: 'usr_dse_37c992',
    email: 'rafiqul.islam@dhaka.com',
    full_name: 'Rafiqul Islam',
    created_at: '2026-10-10T14:45:00Z',
  },
];

const DEMO_COMPANIES = [
  { id: 'cmp_gp', symbol: 'GP', name: 'Grameenphone Ltd.', exchange: 'DSE' },
  { id: 'cmp_squr', symbol: 'SQURPHARMA', name: 'Square Pharmaceuticals Ltd.', exchange: 'DSE' },
  { id: 'cmp_batbc', symbol: 'BATBC', name: 'British American Tobacco Bangladesh', exchange: 'DSE' },
  { id: 'cmp_beximco', symbol: 'BEXIMCO', name: 'Beximco Pharmaceuticals Ltd.', exchange: 'DSE' },
  { id: 'cmp_brac', symbol: 'BRACBANK', name: 'BRAC Bank PLC', exchange: 'DSE' },
];

const DEMO_TRANSACTIONS = [
  {
    id: 'txn_001',
    user_id: 'usr_dse_91a021',
    company_id: 'cmp_gp',
    type: 'BUY',
    date: '2026-10-02',
    quantity: 100,
    price_per_share: 245.5,
    gross_amount: 24550.0,
    brokerage_amount: 122.75,
    net_amount: 24672.75,
    realized_profit_loss: null,
    notes: 'Initial position acquisition on DSE',
    company: { symbol: 'GP', name: 'Grameenphone Ltd.' },
  },
  {
    id: 'txn_002',
    user_id: 'usr_dse_91a021',
    company_id: 'cmp_squr',
    type: 'BUY',
    date: '2026-10-05',
    quantity: 150,
    price_per_share: 218.0,
    gross_amount: 32700.0,
    brokerage_amount: 163.5,
    net_amount: 32863.5,
    realized_profit_loss: null,
    notes: 'Long-term pharma holding',
    company: { symbol: 'SQURPHARMA', name: 'Square Pharmaceuticals Ltd.' },
  },
  {
    id: 'txn_003',
    user_id: 'usr_dse_91a021',
    company_id: 'cmp_gp',
    type: 'SELL',
    date: '2026-10-12',
    quantity: 40,
    price_per_share: 272.0,
    gross_amount: 10880.0,
    brokerage_amount: 54.4,
    net_amount: 10825.6,
    realized_profit_loss: 956.49,
    notes: 'Partial profit booking at target',
    company: { symbol: 'GP', name: 'Grameenphone Ltd.' },
  },
  {
    id: 'txn_004',
    user_id: 'usr_dse_84b720',
    company_id: 'cmp_brac',
    type: 'BUY',
    date: '2026-10-14',
    quantity: 500,
    price_per_share: 48.2,
    gross_amount: 24100.0,
    brokerage_amount: 120.5,
    net_amount: 24220.5,
    realized_profit_loss: null,
    notes: 'Banking dividend play',
    company: { symbol: 'BRACBANK', name: 'BRAC Bank PLC' },
  },
  {
    id: 'txn_005',
    user_id: 'usr_dse_37c992',
    company_id: 'cmp_beximco',
    type: 'BUY',
    date: '2026-10-16',
    quantity: 200,
    price_per_share: 114.0,
    gross_amount: 22800.0,
    brokerage_amount: 114.0,
    net_amount: 22914.0,
    realized_profit_loss: null,
    notes: 'Accumulation on pullback',
    company: { symbol: 'BEXIMCO', name: 'Beximco Pharmaceuticals Ltd.' },
  },
];

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If Supabase credentials are dummy or unconfigured, return instant mock demo data
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      profiles: DEMO_PROFILES,
      transactions: DEMO_TRANSACTIONS,
      companies: DEMO_COMPANIES,
      isDemo: true,
      errors: null,
    });
  }

  try {
    const supabase = createAdminSupabaseClient();

    // 1. Fetch profiles
    const profRes = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Fetch transactions
    const txRes = await supabase
      .from('transactions')
      .select('*, company:companies(*)')
      .order('date', { ascending: false });

    // 3. Fetch companies
    const compRes = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    // If database queries failed or tables do not exist yet, fallback gracefully
    if (profRes.error || txRes.error || compRes.error) {
      const errMsg = profRes.error?.message || txRes.error?.message || compRes.error?.message || '';
      if (errMsg.includes('does not exist') || errMsg.includes('fetch failed') || errMsg.includes('aborted') || errMsg.includes('timeout')) {
        return NextResponse.json({
          profiles: DEMO_PROFILES,
          transactions: DEMO_TRANSACTIONS,
          companies: DEMO_COMPANIES,
          isDemo: true,
          errors: { message: `Supabase tables not initialized (${errMsg}). Displaying demo data until SQL migration is executed.` },
        });
      }
    }

    return NextResponse.json({
      profiles: profRes.data || [],
      transactions: txRes.data || [],
      companies: compRes.data || [],
      isDemo: false,
      errors: {
        profiles: profRes.error?.message || null,
        transactions: txRes.error?.message || null,
        companies: compRes.error?.message || null,
      },
    });
  } catch (err: unknown) {
    // Return demo data on exception so user experience is not disrupted
    return NextResponse.json({
      profiles: DEMO_PROFILES,
      transactions: DEMO_TRANSACTIONS,
      companies: DEMO_COMPANIES,
      isDemo: true,
      errors: {
        message: err instanceof Error ? err.message : 'Database offline, demo data enabled',
      },
    });
  }
}
