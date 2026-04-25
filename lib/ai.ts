import type { DispatchDept, Intent, Language, Urgency } from '@/lib/enums';
import { buildDispatchContacts } from './dispatch-registry';
import { isAzureOpenAIEnabled, callJSON, callText } from './azure-openai';

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
  // Real AI path — Azure OpenAI GPT-4o
  if (isAzureOpenAIEnabled()) {
    try {
      return await classifyWithAzure(text, language, priorState);
    } catch (err) {
      console.warn('[ai.classifyTurn] Azure OpenAI failed, falling back to mock:', err);
    }
  }
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true or configure Azure OpenAI');
  }
  const t = normalize(text);
  const flags: Classification['flags'] = [];
  let intent: Intent = 'OTHER';
  let urgency: Urgency = 'STANDARD';
  let confidence = 0.72;
  let reasoning =
    'Mock classifier: multilingual romanized keyword rules (en/kn/hi/mr/te) over caller text — synthetic demo only.';

  // Multilingual lexicon — romanized Kannada/Hindi/Marathi/Telugu alongside English
  // Each regex is intentionally broad to match common conversational variants
  const RX = {
    // Weapons — English + Hindi/Kannada slang
    weapon: /\b(knife|gun|weapon|blade|stick|chuRi|chura|chooda|katti|talwar|peetne)\b/i,
    // Minor / child — Kannada (magu, makkalu, shaale), Hindi (bachcha, ladka, ladki, school), Marathi (mulgaa, mulgi), Telugu (paaapa, biDDa)
    minor: /\b(minor|child|school|student|age\s*\d{1,2}|kid|magu|makkalu|shaale|shaaleyinda|bachcha|bachche|ladka|ladki|chote|mulgaa|mulgi|paapaa|paaapa|paapa|bidd?a)\b/i,
    repeat: /\b(repeat|again|before|last time|hindina|pichhle|punaha|puna|aagal)\b/i,
    location: /\b(jayanagar|indiranagar|koramangala|whitefield|hsr|btm|electronic city|pincode|5600\d{2})\b/i,
    // Domestic violence — adrode/marode (Kannada beating), ganda (husband), bhaya (fear) | pati/maar/peet/ghar/dahej (Hindi) | navra (Marathi) | bharta/koTuTu (Telugu)
    domesticViolence:
      /(beat|hit|slap|violence|husband|dowry|abuse at home|maradalu|ganda|adrode|adre\s*aaguttide|marTodu|hodibittidaane|bhaya\s*aagutte|atte|maamA|pati|patni|peet|maar|maara|maarta|maar\s*raha|dahej|sasural|navra|bharta|baayko|koT[uTtu]|ghar\s*me\s*maar)/i,
    // Missing / abducted child — magu/shaaleyinda (Kannada), bachcha kho gaya, lapata, ghar nahi (Hindi), mulgaa shaalehun (Marathi), biDDa kanipinchaTledu (Telugu)
    missingChild:
      /(missing|lost child|abducted|kidnapped|cannot find (my|the) child|magu\s+(shaaleyinda|kanIalla|hindirugalilla|illa)|hindirugalilla|hindiruga\s*illa|kaaNutti?la|kaaNa(da|le)|kanee\s*illa|bachcha\s*(kho|laapata|nahi\s*aaya|gum)|mulgaa\s*(ghari\s*aalaa\s*nahi|laapata)|biDD?a\s*kanipinchaTledu|bach(a|cha)\s*missing|child\s*kanee?lla)/i,
    // Mental health crisis — saaku enisuttide (Kannada — fed up with life), kill myself, jeene nahi (Hindi), thodawanaar nahi (Marathi)
    mentalHealthCritical:
      /(suicide|kill myself|no reason to live|end it all|die today|saaku\s*enisu|jeevana\s*saaku|jeevana\s*beda|sayuvudu|saava|jeene\s*ka\s*man\s*nahi|jeena\s*nahi|aatmahatya|maranA|chhodi\s*deta|jeevit(a|am)\s*(mida|chaaluga))/i,
    mentalHealthGeneral:
      /(anxious|depressed|counsel|therapy|panic|maathu\s*kelisa|counsellor\s*kaavali|chinte|tension|udaas|udvegan|chinta|paryeshan|kaaranatamu)/i,
    // Medical emergency — behosh, saans nahi, ambulance (Hindi), praaNa (Kannada), bhabhrad (Marathi)
    medicalEmergency:
      /(bleeding|unconscious|not breathing|overdose|ambulance|hospital now|behosh|saans\s*nahi|saans\s*nahi\s*le|s[aá]ns\s*nahi|raktha\s*srava|praaNa\s*hogtide|aspatre|haspataal|chest\s*pain|ambulance\s*bhej|ER\s*beku)/i,
    // Trafficking — agent ne laaya, kaam ke liye, brothel, sold (English/Hindi), bonded labour, kaam-ke-naam-pe (mixed Hindi/English)
    trafficking:
      /(traffick|forced marriage|sold|brothel|lured to work|agent ne laaya|kaam\s*(ke\s*liye|ke\s*naam\s*pe)|ghulaam|bonded\s*(labor|labour)|baahar\s*nahi\s*jaane\s*deta|mein\s*phans\s*gay|forced\s*to\s*marry)/i,
    harassment:
      /(harass|stalk|follow|threaten|eve.?teas|peecha|peechha\s*karta|piecha|dhamkata|dhamka|rojana\s*follow|after\s*school\s*follow|chhed)/i,
    childAbuse:
      /(inappropriate touch|teacher touched|school abuse|minor abuse|teacher\s*ne\s*chhua|achaanak\s*chhua|galat\s*kiya|baccha\s*ko\s*maara|magu\s*ge\s*maara)/i,
    legalAid: /(lawyer|legal|fir|rights|court|section \d+|wakeel|adaalat|kaanoon|kanun|kaanooni)/i,
    informationRequest:
      /(hours|helpline|what is 1092|information|how to complain|samay|jaankaari|maahiti|elli\s*helpline|helpline\s*time)/i,
    ambiguous:
      /(something happened|not sure|confused|help me\b|kuch hua|samajh nahi|gondalala|gondu)/i,
  };

  if (RX.weapon.test(text)) {
    flags.push({ label: 'weapon_mentioned', details: 'Potential weapon reference in transcript' });
  }
  if (RX.minor.test(text)) {
    flags.push({ label: 'minor_involved', details: 'Reference to a minor / child / school / student' });
  }
  if (RX.repeat.test(text)) {
    flags.push({ label: 'repeat_caller', details: 'Possible repeat contact' });
  }
  if (RX.location.test(text)) {
    flags.push({ label: 'location_identified', details: 'Location or pincode cues' });
  }

  if (RX.domesticViolence.test(t)) {
    intent = 'DOMESTIC_VIOLENCE';
    urgency = 'URGENT';
    confidence = 0.91;
    reasoning =
      'Matched domestic distress lexicon (intimate-partner violence terms in English/Kannada/Hindi). Escalation to protection services suggested.';
    // Escalate to IMMEDIATE if minor is involved
    if (RX.minor.test(text)) {
      urgency = 'IMMEDIATE';
      reasoning += ' Minor present — escalated to IMMEDIATE.';
    }
  } else if (RX.missingChild.test(t)) {
    intent = 'MISSING_CHILD';
    urgency = 'IMMEDIATE';
    confidence = 0.93;
    reasoning = 'Missing or abducted child indicators (en/kn/hi) — immediate multi-agency coordination.';
  } else if (RX.mentalHealthCritical.test(t)) {
    intent = 'MENTAL_HEALTH';
    urgency = 'IMMEDIATE';
    confidence = 0.94;
    reasoning = 'Self-harm or acute crisis language (en/kn/hi) — mental health and medical safety routing.';
  } else if (RX.medicalEmergency.test(t)) {
    intent = 'MEDICAL_EMERGENCY';
    urgency = 'IMMEDIATE';
    confidence = 0.92;
    reasoning = 'Medical emergency cues (en/kn/hi) — ambulance / ER pathway with police awareness if needed.';
  } else if (RX.trafficking.test(t)) {
    intent = 'TRAFFICKING';
    urgency = 'IMMEDIATE';
    confidence = 0.9;
    reasoning = 'Trafficking or coercion indicators — police plus community escalation.';
  } else if (RX.childAbuse.test(t)) {
    intent = 'CHILD_ABUSE';
    urgency = 'IMMEDIATE';
    confidence = 0.93;
    reasoning = 'Child safety concern in institutional or caregiver context — CWC + police.';
  } else if (RX.harassment.test(t)) {
    intent = 'HARASSMENT';
    urgency = 'URGENT';
    confidence = 0.86;
    reasoning = 'Harassment or stalking pattern (en/kn/hi) — police reporting and safety planning.';
  } else if (RX.legalAid.test(t)) {
    intent = 'LEGAL_AID_REQUEST';
    urgency = 'STANDARD';
    confidence = 0.78;
    reasoning = 'Legal information or representation request — legal aid routing.';
  } else if (RX.informationRequest.test(t)) {
    intent = 'INFORMATION_REQUEST';
    urgency = 'INFORMATIONAL';
    confidence = 0.81;
    reasoning = 'General information seeking — standard scripted response.';
  } else if (RX.mentalHealthGeneral.test(t)) {
    intent = 'MENTAL_HEALTH';
    urgency = 'URGENT';
    confidence = 0.79;
    reasoning = 'Mental health distress without explicit self-harm — counselling pathway.';
  } else if (RX.ambiguous.test(t)) {
    intent = 'OTHER';
    urgency = 'STANDARD';
    confidence = 0.42;
    reasoning =
      'Ambiguous narrative — low confidence; operator review required before dispatch.';
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
  if (isAzureOpenAIEnabled()) {
    try {
      return await proposeDispatchWithAzure(case_);
    } catch (err) {
      console.warn('[ai.proposeDispatch] Azure OpenAI failed, falling back to mock:', err);
    }
  }
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true or configure Azure OpenAI');
  }
  const blob = case_.turns.map((x) => x.redactedText).join(' ');
  const t = normalize(blob);
  let departments: DispatchDept[] = ['POLICE'];
  let reason = 'Default safety routing to nearest police desk (synthetic).';
  let confidence = 0.75;

  // Multilingual lexicons (en/kn/hi/mr/te romanized) for dispatch routing
  const isDV =
    /(violence|husband|dowry|beat|slap|maardalu|ganda|adrode|hodibittidaane|pati|maar|peet|dahej|navra|bharta|koTuTu)/i.test(
      t
    );
  const hasMinor = /\b(child|minor|school|kid|magu|makkalu|shaale|bachcha|ladka|ladki|mulgaa|mulgi|paaapa|biDDa)\b/i.test(t);
  const isMissing =
    /(missing|abduct|lost child|magu\s+(shaaleyinda|hindirugalilla)|hindirugalilla|kanee\s*illa|bachcha\s*(kho|lapata|nahi\s*aaya|gum)|laapata|biDD?a\s*kanipinchaTledu)/i.test(
      t
    );
  const isMedical =
    /(bleeding|unconscious|breathing|overdose|hospital|ambulance|behosh|saans\s*nahi|s[aá]ns\s*nahi|raktha\s*srava|aspatre|haspataal)/i.test(
      t
    );
  const isMentalCritical =
    /(suicide|kill myself|end it|saaku\s*enisu|jeevana\s*saaku|jeevana\s*beda|sayuvudu|jeene\s*nahi|aatmahatya|maranA|chhodi\s*deta)/i.test(
      t
    );
  const isTrafficking =
    /(traffick|forced marriage|sold|brothel|agent ne laaya|kaam\s*(ke\s*liye|ke\s*naam\s*pe)|bonded\s*(labor|labour))/i.test(
      t
    );
  const isChildAbuse =
    /(inappropriate touch|child abuse|teacher touched|teacher\s*ne\s*chhua|galat\s*kiya|magu\s*ge\s*maara)/i.test(
      t
    );
  const isHarassment = /(harass|stalk|peecha|peechha\s*karta|dhamkata|chhed|after\s*school\s*follow)/i.test(t);
  const isLegal = /(lawyer|legal|fir|rights|wakeel|adaalat|kaanoon|kanun)/i.test(t);
  const isInfo = /(hours|information|what is 1092|samay|jaankaari|maahiti|elli\s*helpline)/i.test(t);

  if (isDV) {
    departments = ['POLICE', 'WOMEN_PROTECTION_OFFICER'];
    if (hasMinor) departments.push('CHILD_WELFARE');
    reason =
      'Domestic violence indicators (en/kn/hi). WPO + police coordination' +
      (hasMinor ? ' with child-welfare addition (minor present).' : '.');
    confidence = 0.88;
  } else if (isMissing) {
    departments = ['POLICE', 'CHILD_WELFARE'];
    reason = 'Missing child protocol — police search plus child welfare.';
    confidence = 0.9;
  } else if (isMedical) {
    departments = ['MEDICAL', 'POLICE'];
    reason = 'Medical emergency with police awareness for scene safety.';
    confidence = 0.91;
  } else if (isMentalCritical) {
    departments = ['MENTAL_HEALTH_CARE', 'MEDICAL'];
    reason = 'Acute crisis — mental health care with medical backup.';
    confidence = 0.92;
  } else if (isTrafficking) {
    departments = ['POLICE', 'COMMUNITY_ESCALATION'];
    if (hasMinor) departments.push('CHILD_WELFARE');
    reason = 'Trafficking indicators — anti-trafficking liaison' + (hasMinor ? ' and child protection.' : '.');
    confidence = 0.89;
  } else if (isChildAbuse) {
    departments = ['CHILD_WELFARE', 'POLICE'];
    reason = 'Child protection mandatory reporting pathway.';
    confidence = 0.9;
  } else if (isHarassment) {
    departments = ['POLICE'];
    reason = 'Harassment — police intake and safety advisories.';
    confidence = 0.82;
  } else if (isLegal) {
    departments = ['LEGAL_AID'];
    reason = 'Legal aid referral — non-emergency desk.';
    confidence = 0.8;
  } else if (isInfo) {
    departments = ['NONE'];
    reason = 'Information-only case — no external dispatch.';
    confidence = 0.77;
  }

  const contacts = buildDispatchContacts(departments, case_.turns.length);

  return { departments, reason, contacts, confidence };
}

export async function generateSummary(case_: CaseLikeForAi): Promise<string> {
  if (isAzureOpenAIEnabled()) {
    try {
      return await generateSummaryWithAzure(case_);
    } catch (err) {
      console.warn('[ai.generateSummary] Azure OpenAI failed, falling back to mock:', err);
    }
  }
  if (process.env.USE_MOCK_AI === 'false') {
    throw new Error('Real AI not implemented — set USE_MOCK_AI=true or configure Azure OpenAI');
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

// ───────────────────────────────────────────────────────────────────────────
// Azure OpenAI (GPT-4o) implementations
// ───────────────────────────────────────────────────────────────────────────

const VALID_INTENTS: Intent[] = [
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
];

const VALID_URGENCY: Urgency[] = ['IMMEDIATE', 'URGENT', 'STANDARD', 'INFORMATIONAL'];

const VALID_DEPTS: DispatchDept[] = [
  'POLICE',
  'CHILD_WELFARE',
  'MEDICAL',
  'WOMEN_PROTECTION_OFFICER',
  'MENTAL_HEALTH_CARE',
  'LEGAL_AID',
  'COMMUNITY_ESCALATION',
  'NONE',
];

async function classifyWithAzure(
  text: string,
  language: Language,
  priorState: { callerTurnCount: number; lastIntent?: string | null }
): Promise<Classification> {
  const systemPrompt = `You are an AI intake assistant for India's 1092 women & child distress helpline. You help operators classify a caller's situation accurately. Be careful, calm, and never silently dispatch — your output is reviewed by a human operator before any action is taken.

You receive a caller's most recent utterance (PII-redacted), the language they're speaking in, and prior conversation state. Return a strict JSON object matching this schema:

{
  "intent": one of [${VALID_INTENTS.join(', ')}],
  "urgency": one of [${VALID_URGENCY.join(', ')}],
  "confidence": 0.0 to 1.0 (how confident you are),
  "reasoning": one or two sentences explaining the classification, in English,
  "flags": array of {"label": string, "details": string} — only include flags that clearly apply. Recognised labels: weapon_mentioned, minor_involved, repeat_caller, location_identified, pregnant_or_postpartum, elderly_involved, immediate_danger, language_mixed,
  "suggestedQuestions": array of 2 to 3 short questions (in English) the operator should ask next, intent-specific
}

Rules:
- The caller may speak Kannada, Hindi, English, Marathi, or Telugu (or mix). Understand all of them.
- If caller text is ambiguous, classify as OTHER with confidence below 0.5.
- IMMEDIATE means risk to life or to a minor in the next minutes. URGENT means within hours. STANDARD means today. INFORMATIONAL means no dispatch needed.
- DOMESTIC_VIOLENCE includes intimate partner abuse, dowry harassment, in-laws assault.
- TRAFFICKING includes forced marriage, bonded labour, sold for sex work.
- LEGAL_AID_REQUEST is for callers seeking legal advice or FIR help, not currently in danger.
- Output ONLY the JSON object. No surrounding prose.`;

  const userPrompt = `Caller language: ${language}
Prior caller turns: ${priorState.callerTurnCount}
Prior intent (if any): ${priorState.lastIntent ?? 'none'}
Caller utterance (redacted): "${text}"`;

  type RawResponse = {
    intent?: string;
    urgency?: string;
    confidence?: number;
    reasoning?: string;
    flags?: { label: string; details?: string }[];
    suggestedQuestions?: string[];
  };

  const raw = await callJSON<RawResponse>(systemPrompt, userPrompt, 1);

  // Validate and coerce
  const intent: Intent = VALID_INTENTS.includes(raw.intent as Intent)
    ? (raw.intent as Intent)
    : 'OTHER';
  const urgency: Urgency = VALID_URGENCY.includes(raw.urgency as Urgency)
    ? (raw.urgency as Urgency)
    : 'STANDARD';
  const confidence = Math.max(0, Math.min(1, raw.confidence ?? 0.7));
  const reasoning =
    raw.reasoning?.toString().trim() ||
    'Azure GPT-4o classification (no explicit reasoning returned).';
  const flags = Array.isArray(raw.flags)
    ? raw.flags
        .filter((f) => f && typeof f.label === 'string')
        .slice(0, 6)
        .map((f) => ({ label: f.label, details: f.details ?? '' }))
    : [];
  const suggestedQuestions = Array.isArray(raw.suggestedQuestions)
    ? raw.suggestedQuestions.slice(0, 3).map((s) => String(s).trim()).filter(Boolean)
    : buildSuggestedQuestions(intent, priorState.callerTurnCount);

  return {
    intent,
    urgency,
    confidence,
    reasoning: `${reasoning} [GPT-4o]`,
    flags,
    suggestedQuestions:
      suggestedQuestions.length > 0
        ? suggestedQuestions
        : buildSuggestedQuestions(intent, priorState.callerTurnCount),
  };
}

async function proposeDispatchWithAzure(case_: CaseLikeForAi): Promise<DispatchProposal> {
  const systemPrompt = `You are an AI dispatch advisor for India's 1092 women & child distress helpline. Given a case (transcript turns + classified intent and urgency), propose which departments should respond. A human operator confirms before any actual dispatch.

Departments available: ${VALID_DEPTS.join(', ')}.

Return strict JSON:
{
  "departments": array of department names from the list (1 to 4 entries; use NONE only for purely informational calls),
  "reason": one or two sentences explaining the routing logic in English,
  "confidence": 0.0 to 1.0
}

Rules:
- Domestic violence usually needs POLICE + WOMEN_PROTECTION_OFFICER, plus CHILD_WELFARE if minors are involved.
- Missing child needs POLICE + CHILD_WELFARE.
- Medical emergency needs MEDICAL + POLICE for scene safety.
- Trafficking needs POLICE + COMMUNITY_ESCALATION + CHILD_WELFARE if minors.
- Mental health crisis with self-harm needs MENTAL_HEALTH_CARE + MEDICAL.
- Information-only calls return ["NONE"] with confidence below 0.6.
- Output ONLY the JSON object.`;

  const transcript = case_.turns
    .map((t) => `[${t.role}]: ${t.redactedText}`)
    .join('\n');
  const userPrompt = `Caller language: ${case_.language}
Classified intent: ${case_.intent ?? 'unknown'}
Classified urgency: ${case_.urgency ?? 'unknown'}

Transcript:
${transcript}`;

  type RawResponse = {
    departments?: string[];
    reason?: string;
    confidence?: number;
  };

  const raw = await callJSON<RawResponse>(systemPrompt, userPrompt, 1);

  const departments: DispatchDept[] = Array.isArray(raw.departments)
    ? raw.departments
        .filter((d): d is DispatchDept => VALID_DEPTS.includes(d as DispatchDept))
        .slice(0, 4)
    : ['POLICE'];
  const reason = raw.reason?.toString().trim() || 'GPT-4o dispatch routing.';
  const confidence = Math.max(0, Math.min(1, raw.confidence ?? 0.8));
  const finalDepartments = departments.length > 0 ? departments : (['POLICE'] as DispatchDept[]);
  const contacts = buildDispatchContacts(finalDepartments, case_.turns.length);

  return {
    departments: finalDepartments,
    reason: `${reason} [GPT-4o]`,
    contacts,
    confidence,
  };
}

async function generateSummaryWithAzure(case_: CaseLikeForAi): Promise<string> {
  const systemPrompt = `You are an AI assistant generating a concise case summary for a 1092 helpline operator. The summary must be:
- 2 to 4 sentences in English
- Professional and factual
- Reflect the caller's situation, classified intent, and urgency
- Mention any flags (minor_involved, weapon_mentioned, etc.) that are relevant
- End with a one-line note: "Operator must verify all extracted details before dispatch."

The PII has already been redacted in the transcript. Do not invent details — only summarise what's in the transcript.`;

  const transcript = case_.turns
    .map((t) => `[${t.role}]: ${t.redactedText}`)
    .join('\n');
  const userPrompt = `Language: ${case_.language}
Intent: ${case_.intent ?? 'OTHER'}
Urgency: ${case_.urgency ?? 'STANDARD'}

Transcript:
${transcript}`;

  const text = await callText(systemPrompt, userPrompt, 300);
  return text || `Brief (${case_.intent ?? 'OTHER'}, ${case_.urgency ?? 'STANDARD'}): GPT-4o summary unavailable. Operator must review transcript directly.`;
}
