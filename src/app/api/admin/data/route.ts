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

    return NextResponse.json({
      profiles: profRes.data || [],
      transactions: txRes.data || [],
      companies: compRes.data || [],
      errors: {
        profiles: profRes.error?.message || null,
        transactions: txRes.error?.message || null,
        companies: compRes.error?.message || null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
