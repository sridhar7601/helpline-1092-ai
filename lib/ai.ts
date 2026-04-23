import type { DispatchDept, Intent, Language, Urgency } from '@/lib/enums';
import { buildDispatchContacts } from './dispatch-registry';

export interface Classification {
  intent: Intent;
  urgency: Urgency;
  confidence: number;
  reasoning: string;
  flags: { label: string; details?: string }[];
  suggestedQuestions: string[];
}

export interface DispatchProposal {
  departments: DispatchDept[];
  reason: string;
  contacts: { department: DispatchDept; contactInfo: string }[];
  confidence: number;
}

export interface CaseTurnInput {
  role: string;
  redactedText: string;
}

export interface CaseLikeForAi {
  language: Language;
  turns: { role: string; redactedText: string }[];
  intent?: string | null;
  urgency?: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

export async function classifyTurn(
  text: string,
  language: Language,
  priorState: { callerTurnCount: number; lastIntent?: string | null }
): Promise<Classification> {
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true');
  }
  const t = normalize(text);
  const flags: Classification['flags'] = [];
  let intent: Intent = 'OTHER';
  let urgency: Urgency = 'STANDARD';
  let confidence = 0.72;
  let reasoning =
    'Mock classifier: keyword and phrase rules over caller text (synthetic demo only).';

  if (/\b(knife|gun|weapon|blade|stick)\b/i.test(text)) {
    flags.push({ label: 'weapon_mentioned', details: 'Potential weapon reference in transcript' });
  }
  if (/\b(minor|child|school|student|age\s*\d{1,2}|kid)\b/i.test(text)) {
    flags.push({ label: 'minor_involved', details: 'Reference to a minor or school context' });
  }
  if (/\b(repeat|again|before|last time)\b/i.test(text)) {
    flags.push({ label: 'repeat_caller', details: 'Possible repeat contact' });
  }
  if (/\b(jayanagar|indiranagar|koramangala|pincode|5600)\b/i.test(text)) {
    flags.push({ label: 'location_identified', details: 'Location or pincode cues' });
  }

  if (/beat|hit|slap|violence|husband|dowry|abuse at home|maradalu/i.test(t)) {
    intent = 'DOMESTIC_VIOLENCE';
    urgency = 'URGENT';
    confidence = 0.91;
    reasoning =
      'Matched domestic distress lexicon (violence / intimate partner context). Escalation to protection services suggested.';
  } else if (/missing|lost child|abducted|kidnapped|cannot find (my|the) child/i.test(t)) {
    intent = 'MISSING_CHILD';
    urgency = 'IMMEDIATE';
    confidence = 0.93;
    reasoning = 'Missing or abducted child indicators — immediate multi-agency coordination.';
  } else if (/suicide|kill myself|no reason to live|end it all|die today/i.test(t)) {
    intent = 'MENTAL_HEALTH';
    urgency = 'IMMEDIATE';
    confidence = 0.94;
    reasoning = 'Self-harm or acute crisis language — mental health and medical safety routing.';
  } else if (/bleeding|unconscious|not breathing|overdose|ambulance|hospital now/i.test(t)) {
    intent = 'MEDICAL_EMERGENCY';
    urgency = 'IMMEDIATE';
    confidence = 0.92;
    reasoning = 'Medical emergency cues — ambulance / ER pathway with police awareness if needed.';
  } else if (/traffick|forced marriage|sold|brothel|lured to work/i.test(t)) {
    intent = 'TRAFFICKING';
    urgency = 'IMMEDIATE';
    confidence = 0.9;
    reasoning = 'Trafficking or coercion indicators — police plus community escalation.';
  } else if (/harass|stalk|follow|threaten|eve.?teas/i.test(t)) {
    intent = 'HARASSMENT';
    urgency = 'URGENT';
    confidence = 0.86;
    reasoning = 'Harassment or stalking pattern — police reporting and safety planning.';
  } else if (/inappropriate touch|teacher touched|school abuse|minor abuse/i.test(t)) {
    intent = 'CHILD_ABUSE';
    urgency = 'IMMEDIATE';
    confidence = 0.93;
    reasoning = 'Child safety concern in institutional or caregiver context — CWC + police.';
  } else if (/lawyer|legal|fir|rights|court|section \d+/i.test(t)) {
    intent = 'LEGAL_AID_REQUEST';
    urgency = 'STANDARD';
    confidence = 0.78;
    reasoning = 'Legal information or representation request — legal aid routing.';
  } else if (/hours|helpline|what is 1092|information|how to complain/i.test(t)) {
    intent = 'INFORMATION_REQUEST';
    urgency = 'INFORMATIONAL';
    confidence = 0.81;
    reasoning = 'General information seeking — standard scripted response.';
  } else if (/something happened|not sure|confused|help me\b/i.test(t)) {
    intent = 'OTHER';
    urgency = 'STANDARD';
    confidence = 0.42;
    reasoning =
      'Ambiguous narrative — low confidence; operator review required before dispatch.';
  } else if (/anxious|depressed|counsel|therapy|panic/i.test(t)) {
    intent = 'MENTAL_HEALTH';
    urgency = 'URGENT';
    confidence = 0.79;
    reasoning = 'Mental health distress without explicit self-harm — counselling pathway.';
  }

  const langNote =
    language === 'KANNADA'
      ? ' (Kannada intake — mock rules are language-agnostic for demo.)'
      : '';
  reasoning += langNote;

  const suggestedQuestions = buildSuggestedQuestions(intent, priorState.callerTurnCount);

  return {
    intent,
    urgency,
    confidence,
    reasoning,
    flags,
    suggestedQuestions,
  };
}

function buildSuggestedQuestions(intent: Intent, callerTurns: number): string[] {
  const base: Record<Intent, string[]> = {
    DOMESTIC_VIOLENCE: [
      'Are you safe right now? Is the aggressor with you?',
      'Are children or elders present in the home?',
      'Do you need emergency shelter contact today?',
    ],
    CHILD_ABUSE: [
      'Is the child with you now and physically safe?',
      'When did the incident occur? Any medical attention needed?',
      'Has a school or institution been informed?',
    ],
    MISSING_CHILD: [
      'When and where was the child last seen?',
      'Do you have a recent photo or identifying details?',
      'Have you contacted the nearest police station?',
    ],
    MEDICAL_EMERGENCY: [
      'Is the person conscious and breathing?',
      'What is your nearest landmark or pincode?',
      'Is an ambulance already on the way?',
    ],
    MENTAL_HEALTH: [
      'Are you thinking of harming yourself right now?',
      'Is someone with you who can stay nearby?',
      'Would you like a crisis counsellor on the line?',
    ],
    TRAFFICKING: [
      'Are you able to speak freely at this moment?',
      'Are you in a locked or guarded location?',
      'Can you share the city or district you are in?',
    ],
    HARASSMENT: [
      'Has this been reported before? Any evidence preserved?',
      'Is the harasser known to you?',
      'Do you feel immediate physical danger?',
    ],
    LEGAL_AID_REQUEST: [
      'What kind of legal help do you need — FIR, divorce, custody?',
      'Do you already have a lawyer or case number?',
    ],
    INFORMATION_REQUEST: [
      'Which district are you calling from?',
      'Do you need emergency help or general information?',
    ],
    OTHER: [
      'Can you briefly describe what happened?',
      'Is anyone in immediate danger right now?',
    ],
  };
  const list = base[intent] ?? base.OTHER;
  const offset = Math.min(callerTurns, list.length - 1);
  return list.slice(offset, offset + 3);
}

export async function proposeDispatch(case_: CaseLikeForAi): Promise<DispatchProposal> {
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true');
  }
  const blob = case_.turns.map((x) => x.redactedText).join(' ');
  const t = normalize(blob);
  let departments: DispatchDept[] = ['POLICE'];
  let reason = 'Default safety routing to nearest police desk (synthetic).';
  let confidence = 0.75;

  if (/violence|husband|dowry|beat|slap/i.test(t)) {
    departments = ['POLICE', 'WOMEN_PROTECTION_OFFICER'];
    if (/\b(child|minor|school|kid)\b/i.test(t)) departments.push('CHILD_WELFARE');
    reason =
      'Domestic violence with optional child welfare if minors mentioned — WPO + police coordination.';
    confidence = 0.88;
  } else if (/missing|abduct|lost child/i.test(t)) {
    departments = ['POLICE', 'CHILD_WELFARE'];
    reason = 'Missing child protocol — police search plus child welfare.';
    confidence = 0.9;
  } else if (/bleeding|unconscious|breathing|overdose|hospital/i.test(t)) {
    departments = ['MEDICAL', 'POLICE'];
    reason = 'Medical emergency with police awareness for scene safety.';
    confidence = 0.91;
  } else if (/suicide|kill myself|end it/i.test(t)) {
    departments = ['MENTAL_HEALTH_CARE', 'MEDICAL'];
    reason = 'Acute crisis — mental health care with medical backup.';
    confidence = 0.92;
  } else if (/traffick|forced marriage|sold/i.test(t)) {
    departments = ['POLICE', 'COMMUNITY_ESCALATION', 'CHILD_WELFARE'];
    reason = 'Trafficking indicators — anti-trafficking liaison and child protection.';
    confidence = 0.89;
  } else if (/inappropriate touch|child abuse|teacher touched/i.test(t)) {
    departments = ['CHILD_WELFARE', 'POLICE'];
    reason = 'Child protection mandatory reporting pathway.';
    confidence = 0.9;
  } else if (/harass|stalk/i.test(t)) {
    departments = ['POLICE'];
    reason = 'Harassment — police intake and safety advisories.';
    confidence = 0.82;
  } else if (/lawyer|legal|fir|rights/i.test(t)) {
    departments = ['LEGAL_AID'];
    reason = 'Legal aid referral — non-emergency desk.';
    confidence = 0.8;
  } else if (/hours|information|what is 1092/i.test(t)) {
    departments = ['NONE'];
    reason = 'Information-only case — no external dispatch.';
    confidence = 0.77;
  }

  const contacts = buildDispatchContacts(departments, case_.turns.length);

  return { departments, reason, contacts, confidence };
}

export async function generateSummary(case_: CaseLikeForAi): Promise<string> {
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true');
  }
  const lastCaller = [...case_.turns].reverse().find((x) => x.role === 'caller');
  const intent = case_.intent ?? 'OTHER';
  const urgency = case_.urgency ?? 'STANDARD';
  const excerpt = lastCaller?.redactedText?.slice(0, 220) ?? '(No caller transcript)';
  return [
    `Brief (${intent.replace(/_/g, ' ').toLowerCase()}, ${urgency.toLowerCase()} urgency):`,
    excerpt.endsWith('.') ? excerpt : `${excerpt}…`,
    'Synthetic summary for operator review — all PII shown to the public UI is redacted; verify before dispatch.',
  ].join(' ');
}
