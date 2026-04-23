import { NextRequest, NextResponse } from 'next/server';
import type { DispatchDept } from '@/lib/enums';
import { db } from '@/lib/db';
import { buildDispatchContacts } from '@/lib/dispatch-registry';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const departments = (body.departments as DispatchDept[] | undefined) ?? null;

    const caseRow = await db.case.findUnique({
      where: { id: caseId },
      include: { _count: { select: { turns: true } } },
    });
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (caseRow.status !== 'PENDING_VERIFICATION') {
      return NextResponse.json({ error: 'Case must be pending verification' }, { status: 400 });
    }
    if (!caseRow.verified) {
      return NextResponse.json({ error: 'Operator verification required before dispatch' }, { status: 400 });
    }

    let depts: DispatchDept[];
    if (departments?.length) {
      depts = departments;
    } else if (caseRow.dispatchDept && caseRow.dispatchDept !== 'NONE') {
      depts = [caseRow.dispatchDept as DispatchDept];
    } else {
      depts = ['NONE'];
    }

    const contacts = buildDispatchContacts(depts, caseRow._count.turns);
    const rows = await Promise.all(
      contacts.map((c) =>
        db.dispatch.create({
          data: {
            caseId,
            department: c.department,
            contactInfo: c.contactInfo,
          },
        })
      )
    );

    await db.case.update({
      where: { id: caseId },
      data: { status: 'DISPATCHED' },
    });

    return NextResponse.json({ dispatches: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to dispatch' }, { status: 500 });
  }
}
