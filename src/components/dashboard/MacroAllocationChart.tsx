"use client";

import React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
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
  if (slice.tipo === "INVESTIMENTO") return "#10B981"; // Emerald
  if (slice.tipo === "PROVISAO_ANUAL") return "#F59E0B"; // Amber
  if (slice.tipo === "SALDO_LIVRE") return "#38BDF8"; // Sky
  const cat = slice.label as Category;
  return CATEGORY_COLORS[cat] ?? "#6366F1";
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
    <div className="rounded-xl border border-white/15 bg-[#090A0F]/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span className="font-semibold text-white">{item.label}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-4 tabular-nums">
        <span className="text-slate-300 font-medium">
          {formatBRL(item.valor)}
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
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
      aria-label="Módulo 1: Distribuição Macro da Renda"
      className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-5 shadow-lg min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <PieChartIcon className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              Módulo 1 · Distribuição Macro da Renda
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Alocação descritiva entre Categorias de Custo, Provisões 1/12 e
            Investimentos
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-slate-300 tabular-nums">
          R_m: {formatBRL(allocation.rendaTotal)}
        </span>
      </div>

      {/* Chart + Legend Grid */}
      {chartData.length === 0 ? (
        <div className="my-10 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-300">
            Nenhuma movimentação registrada neste mês/regime.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Utilize a barra QuickEntry (Cmd+K) acima para lançar uma transação.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-12">
          {/* Recharts Donut */}
          <div className="relative h-60 w-full md:col-span-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="valor"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="rgba(9,10,15,0.8)"
                  strokeWidth={2}
                  isAnimationActive={true}
                  animationDuration={500}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center KPI overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Mapeado
              </span>
              <span className="mt-0.5 text-sm font-semibold text-white tabular-nums">
                {formatBRL(totalAllocated)}
              </span>
              <span className="text-[11px] text-emerald-400 tabular-nums">
                {allocation.rendaTotal > 0
                  ? `${formatPct(
                      allocation.percentualCustos +
                        allocation.percentualInvestimentos +
                        allocation.percentualProvisoes
                    )} alocado`
                  : "Renda R$ 0"}
              </span>
            </div>
          </div>

          {/* Interactive Legend List */}
          <div className="flex flex-col gap-2 md:col-span-7 max-h-64 overflow-y-auto pr-1">
            {chartData.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-[#090A0F]/60 px-3 py-2 text-xs min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate font-medium text-slate-200">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                  <span className="font-semibold text-white">
                    {formatBRL(item.valor)}
                  </span>
                  <span className="w-14 text-right rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {formatPct(item.percentualRenda)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note on Descriptive Neutrality */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
        <span>
          Observabilidade Descritiva: proporções reais sobre R_m sem alertas
          punitivos.
        </span>
        <span className="tabular-nums text-slate-300">
          Custos {formatPct(allocation.percentualCustos)} · Poupança{" "}
          {formatPct(
            allocation.percentualInvestimentos + allocation.percentualProvisoes
          )}
        </span>
      </div>
    </article>
  );
}
