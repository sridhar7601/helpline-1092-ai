'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DispatchDept, Intent, Urgency } from '@/lib/enums';
import type { DispatchProposal } from '@/lib/ai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft } from 'lucide-react';

const INTENTS: Intent[] = [
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
const URGENCIES: Urgency[] = ['IMMEDIATE', 'URGENT', 'STANDARD', 'INFORMATIONAL'];
const DEPTS: DispatchDept[] = [
  'POLICE',
  'CHILD_WELFARE',
  'MEDICAL',
  'WOMEN_PROTECTION_OFFICER',
  'MENTAL_HEALTH_CARE',
  'LEGAL_AID',
  'COMMUNITY_ESCALATION',
  'NONE',
];

export default function VerifyPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [intent, setIntent] = useState<Intent>('OTHER');
  const [urgency, setUrgency] = useState<Urgency>('STANDARD');
  const [dispatchDept, setDispatchDept] = useState<DispatchDept>('NONE');
  const [notes, setNotes] = useState('');
  const [proposal, setProposal] = useState<DispatchProposal | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<DispatchDept[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) throw new Error('load');
        const c = await res.json();
        if (c.status !== 'PENDING_VERIFICATION') {
          setError('This case is not awaiting verification.');
        }
        setSummary(c.summary ?? '');
        setReasoning(c.reasoning ?? '');
        setConfidence(c.confidence ?? null);
        setIntent((c.intent as Intent) ?? 'OTHER');
        setUrgency((c.urgency as Urgency) ?? 'STANDARD');
        setDispatchDept((c.dispatchDept as DispatchDept) ?? 'NONE');
        setNotes(c.verifierNotes ?? '');
        const p = c.proposal as DispatchProposal | null;
        setProposal(p);
        if (p?.departments?.length) {
          setSelectedDepts(p.departments.filter((d: DispatchDept) => d !== 'NONE'));
        } else if (c.dispatchDept) {
          setSelectedDepts([c.dispatchDept].filter((d: DispatchDept) => d !== 'NONE'));
        }
      } catch {
        setError('Failed to load case.');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const toggleDept = (d: DispatchDept) => {
    setSelectedDepts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const verifyAndDispatch = async () => {
    setBusy(true);
    setError(null);
    try {
      const put = await fetch(`/api/cases/${caseId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          urgency,
          dispatchDept: dispatchDept || selectedDepts[0] || 'NONE',
          verifierNotes: notes,
        }),
      });
      if (!put.ok) throw new Error('verify');
      const depts =
        selectedDepts.length > 0 ? selectedDepts : dispatchDept ? [dispatchDept] : ['NONE'];
      const post = await fetch(`/api/cases/${caseId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: depts }),
      });
      if (!post.ok) {
        const j = await post.json().catch(() => ({}));
        throw new Error(j.error ?? 'dispatch');
      }
      router.push(`/cases/${caseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/escalate`, { method: 'POST' });
      if (!res.ok) throw new Error('escalate');
      router.push(`/cases/${caseId}`);
    } catch {
      setError('Escalation failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-fuchsia-700 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <Card className="border-fuchsia-100">
          <CardHeader>
            <CardTitle>Operator verification</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review AI reasoning, override if needed, then dispatch. Nothing routes externally without explicit
              confirmation.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Case brief</Label>
              <p className="mt-1 text-sm rounded-md border bg-background p-3 leading-relaxed">{summary || '—'}</p>
            </div>
            <div>
              <Label>Model reasoning</Label>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{reasoning || '—'}</p>
              {confidence != null && (
                <Badge variant="outline" className="mt-2">
                  Confidence {(confidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            {proposal && (
              <div className="rounded-lg border bg-fuchsia-50/50 p-3 text-sm">
                <p className="font-medium text-fuchsia-900">Recomputed dispatch proposal</p>
                <p className="text-muted-foreground mt-1">{proposal.reason}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="intent">Intent</Label>
                <select
                  id="intent"
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as Intent)}
                >
                  {INTENTS.map((i) => (
                    <option key={i} value={i}>
                      {i.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="urgency">Urgency</Label>
                <select
                  id="urgency"
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as Urgency)}
                >
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {u.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="dept">Primary dispatch (record)</Label>
                <select
                  id="dept"
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={dispatchDept}
                  onChange={(e) => setDispatchDept(e.target.value as DispatchDept)}
                >
                  {DEPTS.map((d) => (
                    <option key={d} value={d}>
                      {d.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Dispatch rows to create</Label>
              <p className="text-xs text-muted-foreground mb-2">Toggle departments for multi-agency demo routing.</p>
              <div className="flex flex-wrap gap-2">
                {DEPTS.filter((d) => d !== 'NONE').map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDept(d)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selectedDepts.includes(d) ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-background'
                    }`}
                  >
                    {d.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Verifier notes</Label>
              <Textarea
                id="notes"
                className="mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Audit notes, overrides, coordination…"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-fuchsia-600 hover:bg-fuchsia-700"
                disabled={busy}
                onClick={() => void verifyAndDispatch()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify &amp; dispatch
              </Button>
              <Button variant="destructive" type="button" disabled={busy} onClick={() => void escalate()}>
                Escalate
              </Button>
              <Link href={`/cases/${caseId}`}>
                <Button variant="outline" type="button">
                  Case file
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
