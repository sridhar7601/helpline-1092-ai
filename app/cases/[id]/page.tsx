'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { countPiiFromSerialized } from '@/lib/pii';
import { ArrowLeft } from 'lucide-react';

type FullCase = {
  id: string;
  caseNumber: string;
  callerPseudonym: string;
  language: string;
  intent: string | null;
  urgency: string | null;
  confidence: number | null;
  dispatchDept: string | null;
  dispatchReason: string | null;
  reasoning: string | null;
  summary: string | null;
  verified: boolean;
  verifierNotes: string | null;
  verifiedAt: string | null;
  status: string;
  createdAt: string;
  turns: {
    id: string;
    role: string;
    redactedText: string;
    rawText: string;
    piiFlags: string | null;
    timestamp: string;
  }[];
  flags: { id: string; label: string; details: string | null }[];
  dispatches: {
    id: string;
    department: string;
    contactInfo: string;
    dispatchedAt: string;
    acknowledged: boolean;
  }[];
};

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [c, setC] = useState<FullCase | null>(null);
  const [tab, setTab] = useState<'summary' | 'transcript' | 'flags' | 'dispatches' | 'audit'>('summary');

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) setC(await res.json());
    })();
  }, [id]);

  if (!c) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const tabs = ['summary', 'transcript', 'flags', 'dispatches', 'audit'] as const;

  return (
    <div className="min-h-screen bg-muted/20 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/cases" className="text-sm text-fuchsia-700 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            All cases
          </Link>
          {c.status === 'PENDING_VERIFICATION' && (
            <Link href={`/verify/${c.id}`}>
              <Button size="sm" className="bg-fuchsia-600">
                Open verification
              </Button>
            </Link>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-fuchsia-900">{c.caseNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {c.callerPseudonym} · {c.language.replace(/_/g, ' ')} · {format(new Date(c.createdAt), 'PPpp')}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {c.intent && <Badge variant="outline">{c.intent.replace(/_/g, ' ')}</Badge>}
            {c.urgency && <Badge variant="secondary">{c.urgency.replace(/_/g, ' ')}</Badge>}
            <Badge>{c.status.replace(/_/g, ' ')}</Badge>
            {c.verified && <Badge className="bg-emerald-600">Verified</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b pb-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                tab === t ? 'bg-fuchsia-600 text-white' : 'hover:bg-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'summary' && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="leading-relaxed">{c.summary ?? '—'}</p>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Reasoning</p>
                <p className="text-sm">{c.reasoning ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dispatch reason</p>
                <p className="text-sm">{c.dispatchReason ?? '—'}</p>
              </div>
              {c.confidence != null && (
                <p className="text-xs text-muted-foreground">Last model confidence: {(c.confidence * 100).toFixed(0)}%</p>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'transcript' && (
          <Card>
            <CardHeader>
              <CardTitle>Transcript (redacted view)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
              {c.turns.map((t) => (
                <div key={t.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap gap-2 mb-1 text-xs uppercase text-muted-foreground">
                    <span>{t.role}</span>
                    {t.piiFlags && (
                      <Badge variant="outline" className="text-[10px]">
                        PII score {countPiiFromSerialized(t.piiFlags)}
                      </Badge>
                    )}
                    <span>{format(new Date(t.timestamp), 'HH:mm:ss')}</span>
                  </div>
                  <p>{t.redactedText}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === 'flags' && (
          <Card>
            <CardHeader>
              <CardTitle>Flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {c.flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No flags.</p>
              ) : (
                c.flags.map((f) => (
                  <div key={f.id} className="rounded-md border p-2 text-sm">
                    <Badge variant="outline">{f.label}</Badge>
                    {f.details && <p className="mt-1 text-muted-foreground text-xs">{f.details}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'dispatches' && (
          <Card>
            <CardHeader>
              <CardTitle>Dispatches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {c.dispatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dispatch records.</p>
              ) : (
                c.dispatches.map((d) => (
                  <div key={d.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{d.department.replace(/_/g, ' ')}</p>
                    <p className="text-muted-foreground">{d.contactInfo}</p>
                    <p className="text-xs mt-1">{format(new Date(d.dispatchedAt), 'PPpp')}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'audit' && (
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">
                Synthetic audit view: intake turns, verification timestamp, and dispatch rows.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Case opened at {format(new Date(c.createdAt), 'PPpp')}</li>
                {c.turns.map((t) => (
                  <li key={t.id}>
                    Turn ({t.role}) @ {format(new Date(t.timestamp), 'HH:mm:ss')}
                  </li>
                ))}
                {c.verifiedAt && (
                  <li>Operator verified at {format(new Date(c.verifiedAt), 'PPpp')}</li>
                )}
                {c.verifierNotes && <li>Verifier notes: {c.verifierNotes}</li>}
                {c.dispatches.map((d) => (
                  <li key={d.id}>
                    Dispatched {d.department} @ {format(new Date(d.dispatchedAt), 'PPpp')}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4" type="button" onClick={() => window.print()}>
                Print-friendly export
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
