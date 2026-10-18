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
    const updateData: Record<string, unknown> = {};

    if (quantity !== undefined) updateData.quantity = Number(quantity);
    if (price_per_share !== undefined) updateData.price_per_share = Number(price_per_share);
    if (notes !== undefined) updateData.notes = notes;

    const { error } = await supabase.from('transactions').update(updateData).eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
