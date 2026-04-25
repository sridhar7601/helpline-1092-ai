'use client';

import { DonutChart } from '@tremor/react';

const COLOR_SWATCH: Record<string, string> = {
  IMMEDIATE: '#e11d48', // rose-600
  URGENT: '#f97316', // orange-500
  STANDARD: '#f59e0b', // amber-500
  INFORMATIONAL: '#64748b', // slate-500
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { name: string; value: number; totalValue?: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  const total = item.totalValue ?? 0;
  const swatch = COLOR_SWATCH[item.name] ?? '#64748b';
  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: swatch }}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {item.name.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-bold text-slate-900 tabular-nums">{item.value}</span>
        <span className="text-xs text-slate-500">
          case{item.value === 1 ? '' : 's'}
        </span>
        {total > 0 && <span className="text-xs text-slate-400">· {pct}%</span>}
      </div>
    </div>
  );
}

export function UrgencyDonut({ data }: { data: { name: string; value: number }[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length)
    return <p className="text-sm text-muted-foreground">No urgency data yet.</p>;
  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  // Inject totalValue into payload so the tooltip can compute percentage
  const dataWithTotal = filtered.map((d) => ({ ...d, totalValue: total }));

  return (
    <DonutChart
      className="h-52"
      data={dataWithTotal}
      index="name"
      category="value"
      colors={['rose', 'orange', 'amber', 'slate']}
      customTooltip={CustomTooltip}
      showAnimation
      valueFormatter={(v) => v.toString()}
    />
  );
}
