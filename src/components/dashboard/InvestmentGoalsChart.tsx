"use client";

import React, { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Compass, Landmark, Sparkles } from "lucide-react";
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
    <div className="rounded-xl border border-rose-400/25 bg-[#120910]/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-semibold text-white">{item.nome}</span>
        </div>
        <span className="rounded border border-rose-400/20 bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-200">
          {item.tipo === "PATRIMONIO"
            ? "Futuro & Patrimônio"
            : "Sonhos & Planos"}
        </span>
      </div>
      <div className="mt-2 space-y-1 tabular-nums text-[11px]">
        <div className="flex justify-between gap-4">
          <span className="text-rose-200/75">Saldo Atual com Rendimento:</span>
          <span className="font-semibold text-white">
            {formatBRL(item.saldo_bruto_atual)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-200/75">Valor Aplicado por Nós:</span>
          <span className="text-rose-100">
            {formatBRL(item.total_aportado)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-200/75">Rendimento Ganho:</span>
          <span className="font-medium text-emerald-300">
            {formatBRL(item.rendimento, true)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-rose-500/20 pt-1">
          <span className="text-rose-200/75">
            Meta ({formatBRL(item.valor_alvo)}):
          </span>
          <span className="font-semibold text-pink-300">
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

    const data: GoalChartDatum[] = goals.map((g) => {
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
        (g.tipo === "PATRIMONIO" ? "#EC4899" : "#FB7185");

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
      className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20 min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300">
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              Nossas Metas & Patrimônio Acumulado
            </h2>
          </div>
          <p className="mt-1 text-xs text-rose-200/70">
            Progresso das nossas metas com o valor aplicado e quanto já rendeu
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums">
          <Sparkles className="h-3 w-3" />
          Rendimento: {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>

      {/* Summary Badges */}
      <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-pink-500/25 bg-pink-500/[0.08] px-3.5 py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-pink-200 truncate">
              Patrimônio de Longo Prazo
            </span>
            <span className="rounded bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-pink-100">
              FUTURO
            </span>
          </div>
          <p className="mt-1 text-base font-bold text-white tabular-nums truncate">
            {formatBRL(summary.patrimonioBruto)}
          </p>
          <p className="text-[11px] text-rose-200/70 truncate">
            Casa Própria + Reserva do Casal
          </p>
        </div>

        <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-3.5 py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-rose-200 truncate">
              Planos & Objetivos Próximos
            </span>
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100">
              SONHOS
            </span>
          </div>
          <p className="mt-1 text-base font-bold text-white tabular-nums truncate">
            {formatBRL(summary.consumoDiferidoBruto)}
          </p>
          <p className="text-[11px] text-rose-200/70 truncate">
            Viagens + Estudos & Cursos
          </p>
        </div>
      </div>

      {/* Chart + Goals List */}
      <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-12">
        <div className="relative h-56 w-full md:col-span-5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={nonZeroChartData}
                dataKey="saldo_bruto_atual"
                nameKey="nome"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
                stroke="rgba(18,9,16,0.9)"
                strokeWidth={2}
                isAnimationActive={true}
                animationDuration={500}
              >
                {nonZeroChartData.map((entry) => (
                  <Cell key={entry.id_meta} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomGoalTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-rose-200/70">
              Total Guardado
            </span>
            <span className="mt-0.5 text-sm font-bold text-white tabular-nums">
              {formatBRL(summary.totalBruto)}
            </span>
            <span className="text-[11px] text-rose-200/75 tabular-nums">
              Aplicado {formatBRL(summary.totalAportado)}
            </span>
          </div>
        </div>

        {/* Detailed Goals Breakdown */}
        <div className="flex flex-col gap-2 md:col-span-7">
          {summary.data.map((goal) => {
            const clampedBarPct = Math.min(100, Math.max(0, goal.progressoPct));
            return (
              <div
                key={goal.id_meta}
                className="rounded-xl border border-rose-500/15 bg-[#120910]/70 px-3 py-2 text-xs min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: goal.color }}
                    />
                    <span className="truncate font-medium text-white">
                      {goal.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="font-semibold text-white">
                      {formatBRL(goal.saldo_bruto_atual)}
                    </span>
                    <span className="text-[11px] text-rose-200/60">
                      / {formatBRL(goal.valor_alvo)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rose-500/15">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clampedBarPct}%`,
                        backgroundColor: goal.color,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right text-[11px] font-medium text-rose-200 tabular-nums">
                    {formatPct(goal.progressoPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rose-500/15 pt-3 text-[11px] text-rose-200/75">
        <span className="inline-flex items-center gap-1">
          <Compass className="h-3.5 w-3.5 text-rose-400" />
          Total Aplicado do Bolso: {formatBRL(summary.totalAportado)}
        </span>
        <span className="tabular-nums text-emerald-300 font-medium">
          Ganho com Rendimentos: {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>
    </article>
  );
}
