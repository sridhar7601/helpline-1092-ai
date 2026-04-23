import { NextRequest, NextResponse } from 'next/server';
import type { DispatchDept, Intent, Urgency } from '@/lib/enums';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();
    const { intent, urgency, dispatchDept, verifierNotes } = body as {
      intent?: Intent;
      urgency?: Urgency;
      dispatchDept?: DispatchDept;
      verifierNotes?: string;
    };

    const caseRow = await db.case.findUnique({ where: { id: caseId } });
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (caseRow.status !== 'PENDING_VERIFICATION') {
      return NextResponse.json({ error: 'Case is not pending verification' }, { status: 400 });
    }

    const updated = await db.case.update({
      where: { id: caseId },
      data: {
        intent: intent ?? caseRow.intent,
        urgency: urgency ?? caseRow.urgency,
        dispatchDept: dispatchDept ?? caseRow.dispatchDept,
        verifierNotes: verifierNotes ?? caseRow.verifierNotes,
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
  }
}
