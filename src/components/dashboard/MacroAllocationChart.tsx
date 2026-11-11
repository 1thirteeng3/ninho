"use client";

import React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type {
  IncomeAllocationResult,
  MacroAllocationSlice,
} from "@/lib/domain/financial-engine";
import type { Category } from "@/lib/domain/types";
import {
  CATEGORY_COLORS,
  formatBRL,
  formatPct,
} from "@/lib/formatters";

interface MacroAllocationChartProps {
  allocation: IncomeAllocationResult;
}

function getSliceColor(slice: MacroAllocationSlice): string {
  if (slice.tipo === "INVESTIMENTO") return "#C084FC"; // Orchid Lavender Pink
  if (slice.tipo === "PROVISAO_ANUAL") return "#FBBF24"; // Neo-Brutalist Butter Gold
  if (slice.tipo === "SALDO_LIVRE") return "#10B981"; // Neo-Mint
  const cat = slice.label as Category;
  return CATEGORY_COLORS[cat] ?? "#EC4899";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MacroAllocationSlice & { color: string };
  }>;
}

function CustomDonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="surface-card rounded-xl px-3.5 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full shrink-0 border border-[#1F0D18]"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-bold text-ink">{item.label}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 tabular-nums">
        <span className="font-bold text-ink">
          {formatBRL(item.valor)}
        </span>
        <span className="text-[11px] font-semibold text-ink-secondary">
          {formatPct(item.percentualRenda)} da renda
        </span>
      </div>
    </div>
  );
}

export function MacroAllocationChart({
  allocation,
}: MacroAllocationChartProps) {
  const chartData = allocation.macroSlices.map((slice) => ({
    ...slice,
    color: getSliceColor(slice),
  }));

  const totalAllocated = chartData.reduce((acc, s) => acc + s.valor, 0);

  return (
    <article
      aria-label="Para Onde Foi Nossa Renda"
      className="surface-card flex flex-col justify-between rounded-2xl p-6 min-w-0"
    >
      {/* Editorial Neo-Brutalist Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-editorial text-2xl italic tracking-tight text-ink truncate">
            Para Onde Foi Nossa Renda
          </h2>
          <p className="mt-0.5 text-xs font-medium text-ink-secondary">
            Divisão entre despesas do mês, reserva anual e investimentos
          </p>
        </div>
        <span className="surface-subtle shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-ink tabular-nums">
          Entradas: {formatBRL(allocation.rendaTotal)}
        </span>
      </div>

      {/* Chart + Divided Legend List */}
      {chartData.length === 0 ? (
        <div className="my-12 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-ink">
            Nenhuma movimentação registrada neste mês.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Use a barra de lançamento rápido acima para registrar uma entrada ou despesa.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-center gap-5 md:grid-cols-12">
          {/* Neo-Brutalist Donut (rótulo central compacto, sem tocar o anel) */}
          <div className="flex flex-col items-center md:col-span-5">
            <div className="relative h-[216px] w-[216px] max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Pie
                    data={chartData}
                    dataKey="valor"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="var(--border-strong)"
                    strokeWidth={1.75}
                    isAnimationActive={true}
                    animationDuration={400}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="flex max-w-[104px] flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                    Alocado
                  </span>
                  <span className="mt-0.5 text-[13px] font-extrabold leading-tight tracking-[-0.03em] text-ink tabular-nums">
                    {formatBRL(totalAllocated)}
                  </span>
                </div>
              </div>
            </div>
            <span className="surface-subtle mt-2 rounded-full px-3 py-1 text-[10px] font-semibold text-ink-secondary tabular-nums">
              {allocation.rendaTotal > 0
                ? `${formatPct(
                    allocation.percentualCustos +
                      allocation.percentualInvestimentos +
                      allocation.percentualProvisoes
                  )} da renda`
                : "Sem renda no mês"}
            </span>
          </div>
          {/* Clean Divided Legend List */}
          <div className="divide-y divide-hairline md:col-span-7 max-h-60 overflow-y-auto pr-1.5">
            {chartData.map((item) => {
              const barPct = Math.min(100, Math.max(3, item.percentualRenda));
              return (
                <div
                  key={item.id}
                  className="py-2.5 first:pt-0 last:pb-0 text-xs min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-[#1F0D18]"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate font-semibold text-ink">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                      <span className="font-bold text-ink">
                        {formatBRL(item.valor)}
                      </span>
                      <span className="w-11 text-right text-[11px] font-medium text-ink-secondary">
                        {formatPct(item.percentualRenda)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-[#1F0D18]/40 bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5 text-xs text-ink-secondary">
        <span className="font-medium">Equilíbrio mensal entre presente e futuro</span>
        <span className="tabular-nums font-bold text-ink">
          Gastos {formatPct(allocation.percentualCustos)} · Guardado{" "}
          {formatPct(
            allocation.percentualInvestimentos + allocation.percentualProvisoes
          )}
        </span>
      </div>
    </article>
  );
}
