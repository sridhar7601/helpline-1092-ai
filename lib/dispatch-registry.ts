import type { DispatchDept } from '@/lib/enums';

export interface DispatchContact {
  department: DispatchDept;
  contactInfo: string;
}

const REGISTRY = {
  POLICE: ['Jayanagar PS — synthetic desk: +91-80-XXXX-1100', 'Indiranagar PS — duty room: +91-80-XXXX-2200'],
  CHILD_WELFARE: ['Bengaluru CWC — Childline coordination (demo): +91-80-XXXX-1098', 'District Child Protection Unit — intake'],
  MEDICAL: ['St. John’s Ambulance bridge (demo)', 'NIMHANS 24×7 crisis desk (synthetic routing)'],
  WOMEN_PROTECTION_OFFICER: ['Mahila Sahayavani — Jayanagar cluster (demo)', 'One Stop Centre — Bengaluru Urban'],
  MENTAL_HEALTH_CARE: ['Vandrevala Foundation helpline (demo)', 'NIMHANS Tele-MANAS routing'],
  LEGAL_AID: ['Karnataka SLSA — Bengaluru panel (demo)', 'DLSA referral desk'],
  COMMUNITY_ESCALATION: ['NGO safe-house network coordinator (synthetic)', 'Anti-trafficking cell liaison (demo)'],
} as const satisfies Record<Exclude<DispatchDept, 'NONE'>, string[]>;

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

/** Deterministic synthetic contact for a department (factory: edit `REGISTRY` only). */
export function getContactForDepartment(
  dept: DispatchDept,
  salt = 0
): string {
  if (dept === 'NONE') return 'No external dispatch (informational)';
  const list = REGISTRY[dept];
  return pick(list, salt);
}

export function buildDispatchContacts(
  departments: DispatchDept[],
  salt = 0
): DispatchContact[] {
  const unique = [...new Set(departments)].filter((d) => d !== 'NONE');
  return unique.map((department, i) => ({
    department,
    contactInfo: getContactForDepartment(department, salt + i),
  }));
}
