import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSummary, proposeDispatch } from '@/lib/ai';
import type { Language } from '@/lib/enums';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const caseRow = await db.case.findUnique({
      where: { id: caseId },
      include: { turns: { orderBy: { timestamp: 'asc' } } },
    });
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (caseRow.status !== 'INTAKE_IN_PROGRESS') {
      return NextResponse.json({ error: 'Case is not in intake' }, { status: 400 });
    }

    const payload = {
      language: caseRow.language as Language,
      turns: caseRow.turns.map((t) => ({ role: t.role, redactedText: t.redactedText })),
      intent: caseRow.intent,
      urgency: caseRow.urgency,
    };

    const [summary, proposal] = await Promise.all([generateSummary(payload), proposeDispatch(payload)]);

    const primaryDept = proposal.departments.find((d) => d !== 'NONE') ?? 'NONE';

    await db.case.update({
      where: { id: caseId },
      data: {
        summary,
        dispatchDept: primaryDept,
        dispatchReason: proposal.reason,
        reasoning: caseRow.reasoning ?? proposal.reason,
        status: 'PENDING_VERIFICATION',
      },
    });

    return NextResponse.json({ summary, proposal, status: 'PENDING_VERIFICATION' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to finalize' }, { status: 500 });
  }
}
