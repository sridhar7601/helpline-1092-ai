'use client';

import { DonutChart } from '@tremor/react';

export function UrgencyDonut({ data }: { data: { name: string; value: number }[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <p className="text-sm text-muted-foreground">No urgency data yet.</p>;
  return (
    <DonutChart
      className="h-52"
      data={filtered}
      index="name"
      category="value"
      colors={['rose', 'orange', 'amber', 'slate']}
    />
  );
}
