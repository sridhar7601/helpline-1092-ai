import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { proposeDispatch } from '@/lib/ai';
import type { Language } from '@/lib/enums';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = await db.case.findUnique({
      where: { id },
      include: {
        turns: { orderBy: { timestamp: 'asc' } },
        flags: true,
        dispatches: { orderBy: { dispatchedAt: 'desc' } },
      },
    });
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let proposal = null;
    if (c.turns.length > 0) {
      proposal = await proposeDispatch({
        language: c.language as Language,
        turns: c.turns.map((t) => ({ role: t.role, redactedText: t.redactedText })),
        intent: c.intent,
        urgency: c.urgency,
      });
    }
    return NextResponse.json({ ...c, proposal });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load case' }, { status: 500 });
  }
}
