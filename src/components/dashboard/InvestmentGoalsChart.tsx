"use client";

import React, { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { roundCurrency } from "@/lib/domain/financial-engine";
import type { Category, InvestmentGoal } from "@/lib/domain/types";
import {
  CATEGORY_COLORS,
  formatBRL,
  formatPct,
} from "@/lib/formatters";

interface InvestmentGoalsChartProps {
  goals: InvestmentGoal[];
}

interface GoalChartDatum {
  id_meta: string;
  nome: string;
  tipo: "PATRIMONIO" | "OBJETIVO_CONSUMO";
  valor_alvo: number;
  total_aportado: number;
  saldo_bruto_atual: number;
  rendimento: number;
  progressoPct: number;
  participacaoCarteiraPct: number;
  color: string;
}

interface CustomGoalTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: GoalChartDatum;
  }>;
}

function CustomGoalTooltip({ active, payload }: CustomGoalTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="surface-card rounded-xl px-3.5 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full shrink-0 border border-[#1F0D18]"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-bold text-ink">{item.nome}</span>
        </div>
        <span className="surface-subtle rounded px-1.5 py-0.5 text-[10px] font-bold text-ink">
          {item.tipo === "PATRIMONIO" ? "Patrimônio" : "Objetivo"}
        </span>
      </div>
      <div className="mt-2 space-y-1 tabular-nums text-[11px]">
        <div className="flex justify-between gap-4">
          <span className="text-ink-secondary">Saldo Atual:</span>
          <span className="font-bold text-ink">
            {formatBRL(item.saldo_bruto_atual)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-ink-secondary">Valor Aplicado:</span>
          <span className="text-ink">{formatBRL(item.total_aportado)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-ink-secondary">Rendimento:</span>
          <span className="font-bold text-[#059669] dark:text-emerald-400">
            {formatBRL(item.rendimento, true)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-hairline pt-1">
          <span className="text-ink-secondary">
            Meta ({formatBRL(item.valor_alvo)}):
          </span>
          <span className="font-bold text-[#EC4899]">
            {formatPct(item.progressoPct)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InvestmentGoalsChart({ goals }: InvestmentGoalsChartProps) {
  const summary = useMemo(() => {
    const totalBruto = roundCurrency(
      goals.reduce((acc, g) => acc + g.saldo_bruto_atual, 0)
    );
    const totalAportado = roundCurrency(
      goals.reduce((acc, g) => acc + g.total_aportado, 0)
    );
    const totalAlvo = roundCurrency(
      goals.reduce((acc, g) => acc + g.valor_alvo, 0)
    );
    const rendimentoTotal = roundCurrency(totalBruto - totalAportado);

    const patrimonioBruto = roundCurrency(
      goals
        .filter((g) => g.tipo === "PATRIMONIO")
        .reduce((acc, g) => acc + g.saldo_bruto_atual, 0)
    );
    const consumoDiferidoBruto = roundCurrency(
      goals
        .filter((g) => g.tipo === "OBJETIVO_CONSUMO")
        .reduce((acc, g) => acc + g.saldo_bruto_atual, 0)
    );

    const palette = ["#FF3B9A", "#EC4899", "#C084FC", "#10B981", "#FBBF24"];

    const data: GoalChartDatum[] = goals.map((g, idx) => {
      const rendimento = roundCurrency(g.saldo_bruto_atual - g.total_aportado);
      const progressoPct =
        g.valor_alvo > 0
          ? roundCurrency((g.saldo_bruto_atual / g.valor_alvo) * 100)
          : 0;
      const participacaoCarteiraPct =
        totalBruto > 0
          ? roundCurrency((g.saldo_bruto_atual / totalBruto) * 100)
          : 0;
      const color =
        CATEGORY_COLORS[g.nome as Category] ??
        palette[idx % palette.length] ??
        "#EC4899";

      return {
        ...g,
        rendimento,
        progressoPct,
        participacaoCarteiraPct,
        color,
      };
    });

    return {
      totalBruto,
      totalAportado,
      totalAlvo,
      rendimentoTotal,
      patrimonioBruto,
      consumoDiferidoBruto,
      data,
    };
  }, [goals]);

  const nonZeroChartData = summary.data.filter((d) => d.saldo_bruto_atual > 0);

  return (
    <article
      aria-label="Nossas Metas e Caixinhas"
      className="surface-card flex flex-col justify-between rounded-2xl p-6 min-w-0"
    >
      {/* Editorial Neo-Brutalist Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-editorial text-2xl italic tracking-tight text-ink truncate">
            Metas &amp; Patrimônio Acumulado
          </h2>
          <p className="mt-0.5 text-xs font-medium text-ink-secondary">
            Evolução das nossas caixinhas com capital aplicado e rendimentos
          </p>
        </div>
        <span className="shrink-0 rounded-full border-[1.5px] border-[#1F0D18] bg-[#A7F3D0] px-3 py-1 text-[11px] font-bold text-[#064E3B] shadow-[2px_2px_0px_#1F0D18] tabular-nums">
          Rendimento {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>

      {/* Chart + Divided Goals List */}
      <div className="mt-6 grid grid-cols-1 items-center gap-5 md:grid-cols-12">
        <div className="relative h-52 w-full min-w-[176px] md:col-span-5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={nonZeroChartData}
                dataKey="saldo_bruto_atual"
                nameKey="nome"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={74}
                paddingAngle={2}
                stroke="var(--border-strong)"
                strokeWidth={1.75}
                isAnimationActive={true}
                animationDuration={400}
              >
                {nonZeroChartData.map((entry) => (
                  <Cell key={entry.id_meta} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomGoalTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">
              Patrimônio Total
            </span>
            <span className="mt-0.5 text-sm font-bold tracking-[-0.03em] text-ink tabular-nums">
              {formatBRL(summary.totalBruto)}
            </span>
            <span className="text-[10px] font-medium text-ink-secondary tabular-nums">
              Aplicado {formatBRL(summary.totalAportado)}
            </span>
          </div>
        </div>

        {/* Divided Goals Breakdown */}
        <div className="divide-y divide-hairline md:col-span-7">
          {summary.data.map((goal) => {
            const clampedBarPct = Math.min(100, Math.max(3, goal.progressoPct));
            return (
              <div
                key={goal.id_meta}
                className="py-2.5 first:pt-0 last:pb-0 text-xs min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-[#1F0D18]"
                      style={{ backgroundColor: goal.color }}
                    />
                    <span className="truncate font-semibold text-ink">
                      {goal.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                    <span className="font-bold text-ink">
                      {formatBRL(goal.saldo_bruto_atual)}
                    </span>
                    <span className="text-[11px] font-medium text-ink-muted">
                      / {formatBRL(goal.valor_alvo)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full border border-[#1F0D18]/40 bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clampedBarPct}%`,
                        backgroundColor: goal.color,
                      }}
                    />
                  </div>
                  <span className="w-11 text-right text-[11px] font-bold text-ink-secondary tabular-nums">
                    {formatPct(goal.progressoPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5 text-xs text-ink-secondary tabular-nums">
        <span>
          Futuro &amp; Casa:{" "}
          <strong className="font-bold text-ink">
            {formatBRL(summary.patrimonioBruto)}
          </strong>{" "}
          · Planos:{" "}
          <strong className="font-bold text-ink">
            {formatBRL(summary.consumoDiferidoBruto)}
          </strong>
        </span>
        <span className="font-bold text-[#059669] dark:text-emerald-400">
          Ganho acumulado {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>
    </article>
  );
}
