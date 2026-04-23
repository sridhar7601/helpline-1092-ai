'use server';

import { faker } from '@faker-js/faker';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export async function startNewCall() {
  const count = await db.case.count();
  const caseNumber = `1092-2026-${String(count + 1).padStart(5, '0')}`;
  faker.seed(42 + count);
  const c = await db.case.create({
    data: {
      caseNumber,
      callerPseudonym: `Caller-${faker.string.alphanumeric(6).toUpperCase()}`,
      language: 'KANNADA',
      status: 'INTAKE_IN_PROGRESS',
    },
  });
  redirect(`/intake/${c.id}`);
}
