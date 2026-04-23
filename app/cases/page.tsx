'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CaseStatus, Intent, Urgency } from '@/lib/enums';

type CaseRow = {
  id: string;
  caseNumber: string;
  language: string;
  intent: string | null;
  urgency: string | null;
  status: string;
  createdAt: string;
};

export default function CasesListPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [intent, setIntent] = useState('');
  const [urgency, setUrgency] = useState('');

  const load = async () => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (intent) q.set('intent', intent);
    if (urgency) q.set('urgency', urgency);
    const res = await fetch(`/api/cases?${q.toString()}`);
    const data = await res.json();
    setCases(data.cases ?? []);
    setTotal(data.total ?? 0);
  };

  useEffect(() => {
    void load();
  }, [status, intent, urgency]);

  return (
    <div className="min-h-screen bg-muted/20 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fuchsia-800">Cases</h1>
            <p className="text-sm text-muted-foreground">{total} matching records</p>
          </div>
          <Link href="/">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <select
                className="rounded-md border bg-background px-2 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Any</option>
                {(
                  [
                    'INTAKE_IN_PROGRESS',
                    'PENDING_VERIFICATION',
                    'DISPATCHED',
                    'CLOSED',
                    'ESCALATED',
                  ] as CaseStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Intent</label>
              <select
                className="rounded-md border bg-background px-2 py-2 text-sm min-w-[10rem]"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="">Any</option>
                {(
                  [
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
                  ] as Intent[]
                ).map((i) => (
                  <option key={i} value={i}>
                    {i.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Urgency</label>
              <select
                className="rounded-md border bg-background px-2 py-2 text-sm"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="">Any</option>
                {(['IMMEDIATE', 'URGENT', 'STANDARD', 'INFORMATIONAL'] as Urgency[]).map((u) => (
                  <option key={u} value={u}>
                    {u.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setStatus('');
                setIntent('');
                setUrgency('');
              }}
            >
              Clear
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3">Case #</th>
                  <th className="text-left p-3">Language</th>
                  <th className="text-left p-3">Intent</th>
                  <th className="text-left p-3">Urgency</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/cases/${c.id}`)}
                  >
                    <td className="p-3 font-medium">{c.caseNumber}</td>
                    <td className="p-3">{c.language}</td>
                    <td className="p-3">
                      {c.intent ? <Badge variant="outline">{c.intent.replace(/_/g, ' ')}</Badge> : '—'}
                    </td>
                    <td className="p-3">
                      {c.urgency ? <Badge variant="secondary">{c.urgency.replace(/_/g, ' ')}</Badge> : '—'}
                    </td>
                    <td className="p-3 text-xs">{c.status.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{format(new Date(c.createdAt), 'MMM d HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cases.length === 0 && (
              <p className="p-6 text-muted-foreground text-sm">No cases. Run npm run seed.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
