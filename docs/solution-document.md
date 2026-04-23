# SahayakAI — Theme 12 Solution Document

## Problem

India’s **1092** helpline must handle multilingual distress calls quickly, classify risk, protect caller privacy, and route to police, child welfare, medical, or counselling channels — with **full accountability** and **no silent automated dispatch**.

## Approach

**SahayakAI** is a Next.js operator console that:

1. Captures speech in the browser (**Web Speech API**) for Kannada, Hindi, English, Marathi, and Telugu (`lib/speech.ts`).
2. Stores each turn with **raw** and **redacted** text; the UI shows **redacted** transcripts (`lib/pii.ts`).
3. Runs a **mock-first** classifier (`lib/ai.ts`, `USE_MOCK_AI=true`) returning intent (10 categories), urgency (4 levels), confidence, reasoning, risk flags, and suggested follow-up questions.
4. Proposes **synthetic** dispatch targets from a **registry** (`lib/dispatch-registry.ts`) — extendable in one file.
5. Forces an **operator verification** step before `DISPATCHED` status and dispatch rows are written.

## Data model

Prisma + SQLite: `Case`, `Turn`, `CaseFlag`, `Dispatch` — enums for `Language`, `Intent`, `Urgency`, `DispatchDept`, `CaseStatus` (see `prisma/schema.prisma`).

## Explainability & audit

- Every caller turn stores classifier output on the case and optional flags as `CaseFlag` rows.
- Verification captures **verifier notes** and timestamps.
- Case detail includes a printable **audit trail** tab (turns, verification, dispatches).

## Limitations (MVP)

- No real telephony or department APIs; all contacts are **synthetic**.
- Speech quality depends on browser and microphone; demo uses **mock AI** only (`USE_MOCK_AI=true`).

## How to run

See [README.md](../README.md) in the repository root for this theme.

## Regenerating the PDF

From the theme root (with [pandoc](https://pandoc.org/) and Google Chrome installed):

```bash
pandoc docs/solution-document.md -o /tmp/sahayakai-solution.html --standalone --metadata title="SahayakAI Theme 12"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$(pwd)/docs/solution-document.pdf" "file:///tmp/sahayakai-solution.html"
```

Adjust the Chrome path on Linux or Windows as needed.
