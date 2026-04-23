import { NextRequest, NextResponse } from 'next/server';
import { faker } from '@faker-js/faker';
import type { Language } from '@/lib/enums';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const language = (body.language ?? 'KANNADA') as Language;

    const count = await db.case.count();
    const caseNumber = `1092-2026-${String(count + 1).padStart(5, '0')}`;
    faker.seed(42 + count);
    const callerPseudonym = `Caller-${faker.string.alphanumeric(6).toUpperCase()}`;

    const c = await db.case.create({
      data: {
        caseNumber,
        callerPseudonym,
        language,
        status: 'INTAKE_IN_PROGRESS',
      },
    });

    return NextResponse.json({ caseId: c.id, caseNumber, callerPseudonym, language: c.language });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to start case' }, { status: 500 });
  }
}
