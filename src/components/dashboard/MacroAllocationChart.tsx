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
  if (slice.tipo === "INVESTIMENTO") return "#9F1239"; // Deep Berry / Plum
  if (slice.tipo === "PROVISAO_ANUAL") return "#D97706"; // Terracotta Amber
  if (slice.tipo === "SALDO_LIVRE") return "#0F766E"; // Sage Teal
  const cat = slice.label as Category;
  return CATEGORY_COLORS[cat] ?? "#BE123C";
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
    <div className="surface-card rounded-xl px-3.5 py-2.5 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-semibold text-ink">{item.label}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 tabular-nums">
        <span className="font-semibold text-ink">
          {formatBRL(item.valor)}
        </span>
        <span className="text-[11px] font-medium text-ink-secondary">
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
      {/* Editorial Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-editorial text-xl italic tracking-tight text-ink truncate">
            Para Onde Foi Nossa Renda
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Divisão entre despesas do mês, reserva anual e investimentos
          </p>
        </div>
        <span className="surface-subtle shrink-0 rounded-full px-3 py-1 text-[11px] font-medium text-ink-secondary tabular-nums">
          Entradas: {formatBRL(allocation.rendaTotal)}
        </span>
      </div>

      {/* Chart + Divided Legend List */}
      {chartData.length === 0 ? (
        <div className="my-12 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-ink">
            Nenhuma movimentação registrada neste mês.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Use a barra de lançamento rápido acima para registrar uma entrada ou despesa.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          {/* Refined Recharts Donut */}
          <div className="relative h-56 w-full md:col-span-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="valor"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={96}
                  paddingAngle={2}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                  isAnimationActive={true}
                  animationDuration={450}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Typographic KPI Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                Total Alocado
              </span>
              <span className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {formatBRL(totalAllocated)}
              </span>
              <span className="text-[11px] text-ink-secondary tabular-nums">
                {allocation.rendaTotal > 0
                  ? `${formatPct(
                      allocation.percentualCustos +
                        allocation.percentualInvestimentos +
                        allocation.percentualProvisoes
                    )} da renda`
                  : "Sem renda"}
              </span>
            </div>
          </div>

          {/* Clean Divided Legend List (Zero nested boxes) */}
          <div className="divide-y divide-hairline md:col-span-7 max-h-64 overflow-y-auto pr-1">
            {chartData.map((item) => {
              const barPct = Math.min(100, Math.max(2, item.percentualRenda));
              return (
                <div
                  key={item.id}
                  className="py-2.5 first:pt-0 last:pb-0 text-xs min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate font-medium text-ink">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="font-semibold text-ink">
                        {formatBRL(item.valor)}
                      </span>
                      <span className="w-12 text-right text-[11px] text-ink-secondary">
                        {formatPct(item.percentualRenda)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
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
        <span>Equilíbrio mensal entre presente e futuro</span>
        <span className="tabular-nums font-medium text-ink">
          Gastos {formatPct(allocation.percentualCustos)} · Guardado{" "}
          {formatPct(
            allocation.percentualInvestimentos + allocation.percentualProvisoes
          )}
        </span>
      </div>
    </article>
  );
}
