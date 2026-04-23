import Link from 'next/link';
import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UrgencyDonut } from '@/components/urgency-donut';
import { Phone, ShieldAlert, ClipboardCheck, Truck, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { startNewCall } from '@/app/actions/start-call';

async function loadDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [casesToday, immediateToday, pendingVerification, dispatchedTotal, urgencyGroups, recent] =
    await Promise.all([
      db.case.count({ where: { createdAt: { gte: today } } }),
      db.case.count({ where: { urgency: 'IMMEDIATE', createdAt: { gte: today } } }),
      db.case.count({ where: { status: 'PENDING_VERIFICATION' } }),
      db.case.count({ where: { status: 'DISPATCHED' } }),
      db.case.groupBy({
        by: ['urgency'],
        _count: { urgency: true },
        where: { urgency: { not: null } },
      }),
      db.case.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          caseNumber: true,
          intent: true,
          urgency: true,
          status: true,
          createdAt: true,
          callerPseudonym: true,
          confidence: true,
        },
      }),
    ]);

  const heatmap = await db.case.findMany({
    where: { intent: { not: null }, urgency: { not: null } },
    select: { intent: true, urgency: true },
  });

  const matrix: Record<string, Record<string, number>> = {};
  for (const r of heatmap) {
    const i = r.intent!;
    const u = r.urgency!;
    if (!matrix[i]) matrix[i] = {};
    matrix[i][u] = (matrix[i][u] ?? 0) + 1;
  }

  const donutData = urgencyGroups
    .filter((g) => g.urgency)
    .map((g) => ({ name: (g.urgency as string).replace(/_/g, ' '), value: g._count.urgency }));

  return {
    casesToday,
    immediateToday,
    pendingVerification,
    dispatchedTotal,
    donutData,
    matrix,
    recent,
  };
}

function urgencyBadgeVariant(u: string | null) {
  if (u === 'IMMEDIATE') return 'destructive';
  if (u === 'URGENT') return 'default';
  return 'secondary';
}

export default async function DashboardPage() {
  const d = await loadDashboard();

  return (
    <main className="min-h-screen bg-gradient-to-b from-fuchsia-50/80 to-background">
      <div className="container mx-auto max-w-7xl p-6 md:p-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-fuchsia-700 tracking-tight">SahayakAI</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              AI-assisted intake for India&apos;s 1092 helpline — voice in Kannada, Hindi, English, Marathi, and
              Telugu; mock classification; PII redaction; dispatch registry. Operator-in-the-loop by design.
            </p>
            <p className="text-xs text-fuchsia-600 mt-2 font-medium">PanIIT AI for Bharat — Theme 12</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cases">
              <Button variant="outline">All cases</Button>
            </Link>
            <form action={startNewCall}>
              <Button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                Start new call
              </Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-fuchsia-100">
            <CardHeader className="pb-2">
              <CardDescription>Cases today</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{d.casesToday}</CardTitle>
            </CardHeader>
            <CardContent>
              <Phone className="h-5 w-5 text-fuchsia-500" />
            </CardContent>
          </Card>
          <Card className="border-rose-100 bg-rose-50/50">
            <CardHeader className="pb-2">
              <CardDescription>Immediate (today)</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-rose-700">{d.immediateToday}</CardTitle>
            </CardHeader>
            <CardContent>
              <ShieldAlert className="h-5 w-5 text-rose-600" />
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardHeader className="pb-2">
              <CardDescription>Pending verification</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{d.pendingVerification}</CardTitle>
            </CardHeader>
            <CardContent>
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
            </CardContent>
          </Card>
          <Card className="border-fuchsia-100">
            <CardHeader className="pb-2">
              <CardDescription>Dispatched (total)</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{d.dispatchedTotal}</CardTitle>
            </CardHeader>
            <CardContent>
              <Truck className="h-5 w-5 text-fuchsia-600" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Urgency distribution</CardTitle>
              <CardDescription>All seeded + live cases in SQLite</CardDescription>
            </CardHeader>
            <CardContent>
              <UrgencyDonut data={d.donutData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Intent × urgency heatmap</CardTitle>
              <CardDescription>Counts across the demo dataset</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <HeatmapTable matrix={d.matrix} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-fuchsia-600" />
              Recent intakes
            </CardTitle>
            <CardDescription>Latest 10 cases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">Run npm run seed to load demo cases.</p>
            ) : (
              d.recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="font-semibold">{c.caseNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.callerPseudonym} · {format(c.createdAt, 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.intent && <Badge variant="outline">{c.intent.replace(/_/g, ' ')}</Badge>}
                    {c.urgency && (
                      <Badge variant={urgencyBadgeVariant(c.urgency)}>{c.urgency.replace(/_/g, ' ')}</Badge>
                    )}
                    <Badge variant="secondary">{c.status.replace(/_/g, ' ')}</Badge>
                    {(c.confidence ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        conf {(c.confidence ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function HeatmapTable({ matrix }: { matrix: Record<string, Record<string, number>> }) {
  const intents = Object.keys(matrix).sort();
  const urgencies = ['IMMEDIATE', 'URGENT', 'STANDARD', 'INFORMATIONAL'];
  if (!intents.length) return <p className="text-sm text-muted-foreground">No classified cases yet.</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left p-2 border bg-muted/50">Intent</th>
          {urgencies.map((u) => (
            <th key={u} className="p-2 border bg-muted/50 text-center whitespace-nowrap">
              {u.slice(0, 3)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {intents.map((intent) => (
          <tr key={intent}>
            <td className="p-2 border font-medium whitespace-nowrap">{intent.replace(/_/g, ' ')}</td>
            {urgencies.map((u) => (
              <td key={u} className="p-2 border text-center tabular-nums">
                {matrix[intent]?.[u] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
