import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return token === 'stocktracker_superadmin_authenticated';
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabaseClient();

    // 1. Fetch profiles
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profError) throw profError;

    // 2. Fetch transactions with company info
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*, company:companies(*)')
      .order('date', { ascending: false });

    if (txError) throw txError;

    // 3. Fetch companies
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (compError) throw compError;

    return NextResponse.json({
      profiles: profiles || [],
      transactions: transactions || [],
      companies: companies || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
