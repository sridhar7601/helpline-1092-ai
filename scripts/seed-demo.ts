import 'dotenv/config';
import { faker } from '@faker-js/faker';
import type { CaseStatus, DispatchDept, Intent, Language, Urgency } from '../lib/enums';
import { db } from '../lib/db';
import { redactPii, piiFlagsToJson } from '../lib/pii';
import { buildDispatchContacts } from '../lib/dispatch-registry';

faker.seed(42);

type Plan = {
  intent: Intent;
  urgency: Urgency;
  status: CaseStatus;
  verified: boolean;
  dispatchDept: DispatchDept | null;
  snippets: string[];
  flags?: { label: string; details?: string }[];
  verifierNotes?: string | null;
  confidence?: number;
};

function todayAt(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

const dv: Plan[] = Array.from({ length: 8 }, (_, i) => ({
  intent: 'DOMESTIC_VIOLENCE' as const,
  urgency: (i % 3 === 0 ? 'IMMEDIATE' : 'URGENT') as Urgency,
  status: (i % 4 === 0 ? 'PENDING_VERIFICATION' : 'DISPATCHED') as CaseStatus,
  verified: i % 4 !== 0,
  dispatchDept: 'POLICE' as const,
  snippets: [
    `My husband beats me when he drinks. I live near Jayanagar 560041. Call Priya at 9876543210.`,
    `Dowry harassment continues. I fear for my child at Green Valley School.`,
  ],
  flags: [{ label: 'minor_involved', details: 'Child mentioned' }],
}));

const child: Plan[] = Array.from({ length: 5 }, () => ({
  intent: 'CHILD_ABUSE' as const,
  urgency: 'IMMEDIATE' as const,
  status: 'DISPATCHED' as const,
  verified: true,
  dispatchDept: 'CHILD_WELFARE' as const,
  snippets: [
    `Teacher inappropriate touch at St. Mary School. Parent Anita 9988776655.`,
    `I need help for my daughter immediately.`,
  ],
  flags: [{ label: 'minor_involved' }],
}));

const missing: Plan[] = Array.from({ length: 3 }, () => ({
  intent: 'MISSING_CHILD' as const,
  urgency: 'IMMEDIATE' as const,
  status: 'DISPATCHED' as const,
  verified: true,
  dispatchDept: 'POLICE' as const,
  snippets: [
    `Child missing since morning near Indiranagar. Last seen in blue uniform. Contact Ramesh 9123456789.`,
  ],
}));

const mental: Plan[] = Array.from({ length: 4 }, (_, i) => ({
  intent: 'MENTAL_HEALTH' as const,
  urgency: (i % 2 === 0 ? 'IMMEDIATE' : 'URGENT') as Urgency,
  status: (i === 0 ? 'PENDING_VERIFICATION' : 'DISPATCHED') as CaseStatus,
  verified: i !== 0,
  dispatchDept: 'MENTAL_HEALTH_CARE' as const,
  snippets: [
    i === 0
      ? `Something happened, I feel confused and need someone to talk.`
      : `Suicide thoughts — no reason to live. Please help.`,
  ],
  confidence: i === 0 ? 0.42 : 0.86,
}));

const medical: Plan[] = Array.from({ length: 3 }, () => ({
  intent: 'MEDICAL_EMERGENCY' as const,
  urgency: 'IMMEDIATE' as const,
  status: 'DISPATCHED' as const,
  verified: true,
  dispatchDept: 'MEDICAL' as const,
  snippets: [`Person unconscious, not breathing well. Pincode 560095. Call 9988776655.`],
}));

const traffic: Plan[] = Array.from({ length: 2 }, () => ({
  intent: 'TRAFFICKING' as const,
  urgency: 'IMMEDIATE' as const,
  status: 'DISPATCHED' as const,
  verified: true,
  dispatchDept: 'POLICE' as const,
  snippets: [`Trafficked to another city, forced marriage. I escaped but fear being sold again.`],
  flags: [{ label: 'weapon_mentioned', details: 'Threat with blade mentioned earlier' }],
}));

const harass: Plan[] = Array.from({ length: 3 }, () => ({
  intent: 'HARASSMENT' as const,
  urgency: 'URGENT' as const,
  status: 'DISPATCHED' as const,
  verified: true,
  dispatchDept: 'POLICE' as const,
  snippets: [`Stalking daily near office Koramangala. Same person follows after 560034.`],
}));

const info: Plan[] = [
  {
    intent: 'CHILD_ABUSE',
    urgency: 'IMMEDIATE',
    status: 'DISPATCHED',
    verified: true,
    dispatchDept: 'CHILD_WELFARE',
    snippets: [
      `First asked about helpline hours, then disclosed teacher abuse at Government High School.`,
    ],
    verifierNotes:
      'Operator corrected classification from INFORMATION_REQUEST to CHILD_ABUSE after disclosure in turn 3.',
  },
  {
    intent: 'INFORMATION_REQUEST',
    urgency: 'INFORMATIONAL',
    status: 'CLOSED',
    verified: true,
    dispatchDept: 'NONE',
    snippets: [`What are 1092 helpline hours and how to file a complaint in Bengaluru?`],
  },
];

const plans: Plan[] = [...dv, ...child, ...missing, ...mental, ...medical, ...traffic, ...harass, ...info];

async function main() {
  await db.case.deleteMany({});

  const langs: Language[] = ['KANNADA', 'HINDI', 'ENGLISH', 'MARATHI', 'TELUGU'];

  for (let i = 0; i < plans.length; i++) {
    const spec = plans[i]!;
    faker.seed(42 + i);
    const caseNumber = `1092-2026-${String(i + 1).padStart(5, '0')}`;
    const createdAt = i < 5 ? todayAt(8 + i) : faker.date.recent({ days: 40 });

    const c = await db.case.create({
      data: {
        caseNumber,
        callerPseudonym: `Caller-${faker.string.alphanumeric(5).toUpperCase()}`,
        language: faker.helpers.arrayElement(langs),
        intent: spec.intent,
        urgency: spec.urgency,
        confidence: spec.confidence ?? 0.84,
        dispatchDept: spec.dispatchDept,
        dispatchReason: 'Seeded synthetic routing rationale.',
        reasoning: 'Mock AI reasoning from keyword rules (USE_MOCK_AI=true).',
        summary: `Synthetic brief for ${spec.intent.replace(/_/g, ' ').toLowerCase()} — demo only.`,
        verified: spec.verified,
        verifierNotes: spec.verifierNotes ?? null,
        verifiedAt: spec.verified ? faker.date.soon({ days: 2, refDate: createdAt }) : null,
        status: spec.status,
        createdAt,
      },
    });

    const nTurns = faker.number.int({ min: 4, max: 12 });
    for (let t = 0; t < nTurns; t++) {
      const isCaller = t % 2 === 0;
      const raw = isCaller
        ? faker.helpers.arrayElement(spec.snippets) + ` Turn ${t}.`
        : `Agent: we are here to help. Can you share whether you are safe? (turn ${t})`;
      const { redactedText, piiFlags } = redactPii(raw);
      await db.turn.create({
        data: {
          caseId: c.id,
          role: isCaller ? 'caller' : 'agent',
          language: c.language,
          rawText: raw,
          redactedText: isCaller ? redactedText : raw,
          piiFlags: isCaller ? piiFlagsToJson(piiFlags) : null,
          intent: isCaller ? spec.intent : null,
        },
      });
    }

    if (spec.flags) {
      for (const f of spec.flags) {
        await db.caseFlag.create({
          data: { caseId: c.id, label: f.label, details: f.details ?? null },
        });
      }
    }

    if (spec.status === 'DISPATCHED' && spec.verified && spec.dispatchDept && spec.dispatchDept !== 'NONE') {
      const multi =
        spec.intent === 'DOMESTIC_VIOLENCE'
          ? (['POLICE', 'WOMEN_PROTECTION_OFFICER'] as const)
          : ([spec.dispatchDept] as const);
      const contacts = buildDispatchContacts([...multi], i);
      for (const row of contacts) {
        await db.dispatch.create({
          data: {
            caseId: c.id,
            department: row.department,
            contactInfo: row.contactInfo,
            acknowledged: faker.number.int({ min: 1, max: 10 }) <= 3,
          },
        });
      }
    }
  }

  const total = await db.case.count();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await db.case.count({ where: { createdAt: { gte: today } } });

  console.log(`Seeded ${total} cases (${todayCount} with today’s date).`);
  console.log('Run: npm run dev → http://localhost:3000');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
