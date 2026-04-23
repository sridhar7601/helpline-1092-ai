export interface PiiRedactionResult {
  redactedText: string;
  piiFlags: {
    names: number;
    phones: number;
    addresses: number;
    aadhaar: number;
    schools: number;
  };
}

const COMMON_INDIAN_NAMES = [
  'Ramesh', 'Suresh', 'Rajesh', 'Amit', 'Anita', 'Priya', 'Deepak', 'Kavita',
  'Vijay', 'Sanjay', 'Anil', 'Sunita', 'Neeta', 'Geeta', 'Lakshmi', 'Saraswati',
  'Krishna', 'Radha', 'Shyam', 'Mohan', 'Rohan', 'Sohan', 'Rani', 'Meena',
];

export function redactPii(text: string): PiiRedactionResult {
  let redacted = text;
  const flags = {
    names: 0,
    phones: 0,
    addresses: 0,
    aadhaar: 0,
    schools: 0,
  };

  COMMON_INDIAN_NAMES.forEach((name) => {
    const regex = new RegExp(`\\b${name}\\b`, 'gi');
    const matches = redacted.match(regex);
    if (matches?.length) {
      redacted = redacted.replace(regex, '[REDACTED]');
      flags.names += matches.length;
    }
  });

  const titleCaseRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  const titleCaseMatches = redacted.match(titleCaseRegex);
  if (titleCaseMatches) {
    titleCaseMatches.forEach((match) => {
      redacted = redacted.replace(match, '[REDACTED]');
      flags.names++;
    });
  }

  const phoneRegex = /(\+91[-\s]?)?[6-9]\d{9}\b/g;
  const phoneMatches = redacted.match(phoneRegex);
  if (phoneMatches) {
    redacted = redacted.replace(phoneRegex, '[PHONE_REDACTED]');
    flags.phones = phoneMatches.length;
  }

  const aadhaarRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  const aadhaarMatches = redacted.match(aadhaarRegex);
  if (aadhaarMatches) {
    redacted = redacted.replace(aadhaarRegex, '[AADHAAR_REDACTED]');
    flags.aadhaar = aadhaarMatches.length;
  }

  const addressRegex = /\b\d{6}\b/g;
  const addressMatches = redacted.match(addressRegex);
  if (addressMatches) {
    redacted = redacted.replace(addressRegex, '[PINCODE_REDACTED]');
    flags.addresses = addressMatches.length;
  }

  const schoolRegex = /\b\w+\s+(School|Vidyalaya|College|High School|Primary School)\b/gi;
  const schoolMatches = redacted.match(schoolRegex);
  if (schoolMatches) {
    redacted = redacted.replace(schoolRegex, '[SCHOOL_REDACTED]');
    flags.schools = schoolMatches.length;
  }

  return {
    redactedText: redacted,
    piiFlags: flags,
  };
}

/** Persisted on `Turn.piiFlags` — counts per category */
export function piiFlagsToJson(flags: PiiRedactionResult['piiFlags']): string {
  return JSON.stringify({
    name: flags.names,
    phone: flags.phones,
    address: flags.addresses,
    aadhaar: flags.aadhaar,
    school: flags.schools,
  });
}

export function countPiiItems(flags: PiiRedactionResult['piiFlags']): number {
  return flags.names + flags.phones + flags.addresses + flags.aadhaar + flags.schools;
}

/** Sum numeric entries from `Turn.piiFlags` JSON */
export function countPiiFromSerialized(json: string | null): number {
  if (!json) return 0;
  try {
    const o = JSON.parse(json) as Record<string, number>;
    return Object.values(o).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  } catch {
    return 0;
  }
}
