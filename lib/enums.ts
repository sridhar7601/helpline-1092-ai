/** String enums stored in SQLite (Prisma schema uses `String` fields). */

export const LANGUAGES = ['KANNADA', 'HINDI', 'ENGLISH', 'MARATHI', 'TELUGU'] as const;
export type Language = (typeof LANGUAGES)[number];

export const URGENCIES = ['IMMEDIATE', 'URGENT', 'STANDARD', 'INFORMATIONAL'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const INTENTS = [
  'DOMESTIC_VIOLENCE',
  'CHILD_ABUSE',
  'MISSING_CHILD',
  'MEDICAL_EMERGENCY',
  'MENTAL_HEALTH',
  'TRAFFICKING',
  'HARASSMENT',
  'LEGAL_AID_REQUEST',
  'INFORMATION_REQUEST',
  'OTHER',
] as const;
export type Intent = (typeof INTENTS)[number];

export const DISPATCH_DEPTS = [
  'POLICE',
  'CHILD_WELFARE',
  'MEDICAL',
  'WOMEN_PROTECTION_OFFICER',
  'MENTAL_HEALTH_CARE',
  'LEGAL_AID',
  'COMMUNITY_ESCALATION',
  'NONE',
] as const;
export type DispatchDept = (typeof DISPATCH_DEPTS)[number];

export const CASE_STATUSES = [
  'INTAKE_IN_PROGRESS',
  'PENDING_VERIFICATION',
  'DISPATCHED',
  'CLOSED',
  'ESCALATED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
