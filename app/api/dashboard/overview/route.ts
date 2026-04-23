import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      casesToday,
      immediate,
      pendingVerification,
      dispatched,
      byUrgency,
      byDept,
    ] = await Promise.all([
      db.case.count({ where: { createdAt: { gte: today } } }),
      db.case.count({ where: { urgency: 'IMMEDIATE', createdAt: { gte: today } } }),
      db.case.count({ where: { status: 'PENDING_VERIFICATION' } }),
      db.case.count({ where: { status: 'DISPATCHED' } }),
      db.case.groupBy({
        by: ['urgency'],
        _count: { urgency: true },
        where: { urgency: { not: null } },
      }),
      db.case.groupBy({
        by: ['dispatchDept'],
        _count: { dispatchDept: true },
        where: { dispatchDept: { not: null } },
      }),
    ]);

    const recent = await db.case.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        caseNumber: true,
        intent: true,
        urgency: true,
        status: true,
        createdAt: true,
        callerPseudonym: true,
        confidence: true,
      },
    });

    return NextResponse.json({
      casesToday,
      immediateUrgencyToday: immediate,
      pendingVerification,
      dispatchedTotal: dispatched,
      byUrgency: byUrgency.map((r) => ({ urgency: r.urgency, count: r._count.urgency })),
      byDispatchDept: byDept.map((r) => ({ department: r.dispatchDept, count: r._count.dispatchDept })),
      recentIntakes: recent,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'overview failed' }, { status: 500 });
  }
}
