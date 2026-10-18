import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

async function checkAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  return token === 'stocktracker_superadmin_authenticated';
}

export async function PATCH(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, password, fullName } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Update Profile info if provided
    if (fullName !== undefined) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileError) throw profileError;
    }

    // 2. Update Auth password if provided
    if (password) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (authError) {
        // If service role key is not yet provided, inform admin
        return NextResponse.json(
          {
            error:
              'To reset auth passwords via admin, please provide SUPABASE_SERVICE_ROLE_KEY in your environment.',
            details: authError.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
