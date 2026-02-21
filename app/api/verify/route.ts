import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashString } from '@/lib/hash';

/**
 * POST /api/verify
 * Body: { token: string }
 * Verifies the token: sets verified=true and clears verify_token_hash.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Липсва токен.' }, { status: 400 });
    }

    const tokenHash = hashString(token);
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (configError) {
      console.warn('Supabase not configured:', (configError as Error).message);
      return NextResponse.json(
        { success: false, error: 'Сървърът не е конфигуриран.' },
        { status: 503 }
      );
    }

    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('id')
      .eq('verify_token_hash', tokenHash)
      .single();

    if (fetchError || !report) {
      return NextResponse.json(
        { success: false, error: 'Невалиден или изтекъл линк за потвърждение.' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('reports')
      .update({ verified: true, verify_token_hash: null })
      .eq('id', report.id);

    if (updateError) {
      console.error('verify update error', updateError);
      return NextResponse.json(
        { success: false, error: 'Грешка при потвърждение.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: 'Грешка при потвърждение.' },
      { status: 500 }
    );
  }
}
