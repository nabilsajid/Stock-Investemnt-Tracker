import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return token === 'stocktracker_superadmin_authenticated';
}

export async function DELETE(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, quantity, price_per_share, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Fetch existing transaction to know its brokerage rate & type
    const { data: existingTxn, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingTxn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const newQty = quantity !== undefined ? Number(quantity) : Number(existingTxn.quantity);
    const newPrice = price_per_share !== undefined ? Number(price_per_share) : Number(existingTxn.price_per_share);
    const rate = Number(existingTxn.brokerage_rate || 0.005);
    const gross = newQty * newPrice;
    const brokerage = gross * rate;
    const net = existingTxn.type === 'BUY' ? gross + brokerage : gross - brokerage;

    const updateData: Record<string, unknown> = {
      quantity: newQty,
      price_per_share: newPrice,
      gross_amount: gross,
      brokerage_amount: brokerage,
      net_amount: net,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) updateData.notes = notes;

    const { error } = await supabase.from('transactions').update(updateData).eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
