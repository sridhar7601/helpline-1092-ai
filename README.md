# SahayakAI — 1092 Helpline Intake

AI-assisted intake for India’s **1092** women and child distress helpline: browser **Web Speech API** (Kannada, Hindi, English, Marathi, Telugu), **mock** intent and urgency classification with explainable reasoning, **PII redaction** on transcripts, and a **synthetic dispatch registry** for Bengaluru-style routing. Operators **verify before dispatch** — no silent routing.

> **PanIIT AI for Bharat Hackathon** — Theme 12: AI for 1092 Helpline

## Quick start

```bash
cd theme12-helpline-1092
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Start new call** for live intake (Chrome recommended for speech).

## Demo data

- `npm run seed` — clears cases and inserts **30** synthetic cases (mixed intents, 5 stamped with today’s date, one low-confidence mental-health case, one operator-override note in verifier notes).
- Deterministic generator uses **Faker seed 42**.

## Architecture

See [docs/diagrams/architecture.png](docs/diagrams/architecture.png) (and `.svg` / `.mmd` sources). Regenerate with:

```bash
npx --yes @mermaid-js/mermaid-cli -i docs/diagrams/architecture.mmd -o docs/diagrams/architecture.png -w 2400 -H 1800 -b white
npx --yes @mermaid-js/mermaid-cli -i docs/diagrams/architecture.mmd -o docs/diagrams/architecture.svg -b white
```

**Note:** SQLite stores categorical fields as strings (same values as the brief’s enums) because this Prisma + SQLite toolchain validates enums inconsistently; application types live in `lib/enums.ts`.

## Tech stack

- Next.js (App Router) + TypeScript  
- Prisma + SQLite  
- Tailwind CSS v3 + shadcn-style UI primitives  
- Tremor charts (dashboard donut)  
- Web Speech API (`lib/speech.ts`)  
- Mock AI behind `USE_MOCK_AI` (`lib/ai.ts`)

## Documentation

Full write-up: [docs/solution-document.md](docs/solution-document.md) · PDF: [docs/solution-document.pdf](docs/solution-document.pdf)

## API (summary)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cases/start` | New intake case |
| POST | `/api/cases/[id]/turn` | Caller/agent turn + classification on caller |
| POST | `/api/cases/[id]/finalize` | Summary + pending verification |
| PUT | `/api/cases/[id]/verify` | Operator overrides + verified flag |
| POST | `/api/cases/[id]/dispatch` | Create dispatch rows + DISPATCHED |
| POST | `/api/cases/[id]/escalate` | ESCALATED |
| GET | `/api/cases` | List `{ total, cases }` |
| GET | `/api/cases/[id]` | Case + turns + flags + dispatches + recomputed `proposal` |
| GET | `/api/dashboard/overview` | JSON metrics (also mirrored on home page via Prisma) |
| GET | `/api/dashboard/heatmap` | Intent × urgency matrix |

## Verification gates

From this directory: `npm install` → `npm run build` → `npx tsc --noEmit` → `npm run seed` → `npm run dev` (landing page loads).
