import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.findMany({
      where: { intent: { not: null }, urgency: { not: null } },
      select: { intent: true, urgency: true },
    });

    const matrix: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const i = r.intent!;
      const u = r.urgency!;
      if (!matrix[i]) matrix[i] = {};
      matrix[i][u] = (matrix[i][u] ?? 0) + 1;
    }

    return NextResponse.json({ matrix });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'heatmap failed' }, { status: 500 });
  }
}
