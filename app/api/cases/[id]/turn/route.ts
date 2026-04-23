import { NextRequest, NextResponse } from 'next/server';
import type { Language } from '@/lib/enums';
import { db } from '@/lib/db';
import { redactPii, piiFlagsToJson } from '@/lib/pii';
import { classifyTurn, proposeDispatch } from '@/lib/ai';
import type { DispatchProposal } from '@/lib/ai';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const body = await request.json();
    const { role, text, language: langBody } = body;
    if (!role || typeof text !== 'string') {
      return NextResponse.json({ error: 'role and text are required' }, { status: 400 });
    }

    const caseRow = await db.case.findUnique({
      where: { id: caseId },
      include: { turns: true, flags: true },
    });
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (caseRow.status !== 'INTAKE_IN_PROGRESS') {
      return NextResponse.json({ error: 'Intake is closed for this case' }, { status: 400 });
    }

    const language = (langBody ?? caseRow.language) as Language;
    const { redactedText, piiFlags } = redactPii(text);
    const piiJson = piiFlagsToJson(piiFlags);

    const callerTurn = await db.turn.create({
      data: {
        caseId,
        role,
        language,
        rawText: text,
        redactedText: role === 'caller' ? redactedText : text,
        piiFlags: role === 'caller' ? piiJson : null,
        intent: null,
      },
    });

    if (role !== 'caller') {
      return NextResponse.json({ turn: callerTurn, agentPrompt: null, classification: null });
    }

    const priorCallerCount = caseRow.turns.filter((t) => t.role === 'caller').length;
    const classification = await classifyTurn(text, language, {
      callerTurnCount: priorCallerCount,
      lastIntent: caseRow.intent,
    });

    await db.case.update({
      where: { id: caseId },
      data: {
        intent: classification.intent,
        urgency: classification.urgency,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        language,
      },
    });

    for (const f of classification.flags) {
      const exists = caseRow.flags.some((x) => x.label === f.label);
      if (!exists) {
        await db.caseFlag.create({
          data: { caseId, label: f.label, details: f.details ?? null },
        });
      }
    }

    await db.turn.update({
      where: { id: callerTurn.id },
      data: { intent: classification.intent },
    });

    const agentPrompt =
      classification.suggestedQuestions[0] ??
      'Thank you for trusting the helpline. Are you in a safe place to talk right now?';

    const agentTurn = await db.turn.create({
      data: {
        caseId,
        role: 'agent',
        language,
        rawText: agentPrompt,
        redactedText: agentPrompt,
        piiFlags: null,
        intent: null,
      },
    });

    const turnsAfter = await db.turn.count({ where: { caseId } });
    let proposedDispatch: DispatchProposal | null = null;
    if (turnsAfter >= 4) {
      const allTurns = await db.turn.findMany({
        where: { caseId },
        orderBy: { timestamp: 'asc' },
        select: { role: true, redactedText: true },
      });
      proposedDispatch = await proposeDispatch({
        language,
        turns: allTurns,
        intent: classification.intent,
        urgency: classification.urgency,
      });
    }

    return NextResponse.json({
      turn: { ...callerTurn, redactedText, piiFlags: piiJson },
      agentPrompt,
      agentTurn,
      classification,
      proposedDispatch,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to record turn' }, { status: 500 });
  }
}
