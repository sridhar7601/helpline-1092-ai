import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const c = await db.case.update({
      where: { id: caseId },
      data: { status: 'ESCALATED' },
    });
    return NextResponse.json(c);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to escalate' }, { status: 500 });
  }
}
