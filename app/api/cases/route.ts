import { NextRequest, NextResponse } from 'next/server';
import type { CaseStatus, Intent, Urgency } from '@/lib/enums';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as CaseStatus | null;
    const intent = searchParams.get('intent') as Intent | null;
    const urgency = searchParams.get('urgency') as Urgency | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (intent) where.intent = intent;
    if (urgency) where.urgency = urgency;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
    }

    const cases = await db.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        _count: { select: { turns: true, dispatches: true } },
      },
    });

    return NextResponse.json({ total: cases.length, cases });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to list cases' }, { status: 500 });
  }
}
