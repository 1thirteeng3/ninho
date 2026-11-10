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
    <div className="rounded-xl border border-white/15 bg-[#090A0F]/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-semibold text-white">{item.nome}</span>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">
          {item.tipo === "PATRIMONIO" ? "Patrimônio Real" : "Consumo Diferido"}
        </span>
      </div>
      <div className="mt-2 space-y-1 tabular-nums text-[11px]">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Saldo Bruto Atual:</span>
          <span className="font-semibold text-white">
            {formatBRL(item.saldo_bruto_atual)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Total Aportado:</span>
          <span className="text-slate-200">{formatBRL(item.total_aportado)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Rentabilidade Implícita:</span>
          <span className="font-medium text-emerald-300">
            {formatBRL(item.rendimento, true)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-1">
          <span className="text-slate-400">Meta ({formatBRL(item.valor_alvo)}):</span>
          <span className="font-semibold text-cyan-300">
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
        (g.tipo === "PATRIMONIO" ? "#10B981" : "#22D3EE");

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
      aria-label="Módulo 2: Composição da Carteira de Metas"
      className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-5 shadow-lg min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              Módulo 2 · Portfólio de Metas & Bifurcação Contábil
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Separação entre Formação de Patrimônio Real e Consumo Diferido
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums">
          <Sparkles className="h-3 w-3" />
          Juros: {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>

      {/* Accounting Separation Badges (Seção 2.2 de arquitetura.txt) */}
      <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-emerald-300 truncate">
              Formação de Patrimônio Real
            </span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
              PATRIMÔNIO
            </span>
          </div>
          <p className="mt-1 text-base font-semibold text-white tabular-nums truncate">
            {formatBRL(summary.patrimonioBruto)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Casa + Reserva & Patrimônio
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-3.5 py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-cyan-300 truncate">
              Provisão de Consumo Diferido
            </span>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
              OBJETIVO_CONSUMO
            </span>
          </div>
          <p className="mt-1 text-base font-semibold text-white tabular-nums truncate">
            {formatBRL(summary.consumoDiferidoBruto)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Viagem + Estudos (Fundo Futuro)
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
                stroke="rgba(9,10,15,0.8)"
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
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Saldo Bruto
            </span>
            <span className="mt-0.5 text-sm font-semibold text-white tabular-nums">
              {formatBRL(summary.totalBruto)}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              Aportado {formatBRL(summary.totalAportado)}
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
                className="rounded-xl border border-white/[0.05] bg-[#090A0F]/60 px-3 py-2 text-xs min-w-0"
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
                    <span className="text-[11px] text-slate-400">
                      / {formatBRL(goal.valor_alvo)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clampedBarPct}%`,
                        backgroundColor: goal.color,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right text-[11px] font-medium text-slate-300 tabular-nums">
                    {formatPct(goal.progressoPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Compass className="h-3.5 w-3.5 text-cyan-400" />
          Capital Aportado Total: {formatBRL(summary.totalAportado)}
        </span>
        <span className="tabular-nums text-emerald-300">
          Rendimento Acumulado: {formatBRL(summary.rendimentoTotal, true)}
        </span>
      </div>
    </article>
  );
}
