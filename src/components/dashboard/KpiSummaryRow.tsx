"use client";

import React, { useMemo } from "react";
import {
  Activity,
  PiggyBank,
  Scale,
  TrendingUp,
} from "lucide-react";
import {
  filterTransactionsByMonth,
  roundCurrency,
  type IncomeAllocationResult,
} from "@/lib/domain/financial-engine";
import type { Transaction, ViewMode } from "@/lib/domain/types";
import { formatBRL, formatPct } from "@/lib/formatters";

interface KpiSummaryRowProps {
  allocation: IncomeAllocationResult;
  transactions: Transaction[];
  yearMonth: string;
  viewMode: ViewMode;
}

export function KpiSummaryRow({
  allocation,
  transactions,
  yearMonth,
  viewMode,
}: KpiSummaryRowProps) {
  const memberIncomeBreakdown = useMemo(() => {
    const monthTxs = filterTransactionsByMonth(
      transactions,
      yearMonth,
      viewMode
    );
    let giovanni = 0;
    let mariaLuiza = 0;

    for (const tx of monthTxs) {
      if (tx.tipo_fluxo === "RENDA") {
        const val = Math.abs(tx.valor);
        if (tx.pago_por === "Giovanni") {
          giovanni = roundCurrency(giovanni + val);
        } else {
          mariaLuiza = roundCurrency(mariaLuiza + val);
        }
      }
    }

    return { giovanni, mariaLuiza };
  }, [transactions, yearMonth, viewMode]);

  const totalPoupado = roundCurrency(
    allocation.investimentosTotal + allocation.provisoesTotal
  );
  const taxaPoupancaPct = roundCurrency(
    allocation.percentualInvestimentos + allocation.percentualProvisoes
  );

  return (
    <section
      aria-label="Indicadores Principais do Mês"
      className="animate-enter delay-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* 1. Renda do Mês (R_m) */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-4 shadow-lg min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Renda do Mês (R_m)
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white tabular-nums truncate">
              {formatBRL(allocation.rendaTotal)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs tabular-nums">
          <span className="text-sky-300 truncate">
            Giovanni: <strong>{formatBRL(memberIncomeBreakdown.giovanni)}</strong>
          </span>
          <span className="text-pink-300 truncate">
            Maria Luiza:{" "}
            <strong>{formatBRL(memberIncomeBreakdown.mariaLuiza)}</strong>
          </span>
        </div>
      </article>

      {/* 2. Custos Operacionais (Neutralidade Descritiva — sem alertas vermelhos) */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-4 shadow-lg min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Custos Operacionais (∑|C_k,m|)
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white tabular-nums truncate">
              {formatBRL(allocation.custosTotal)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-400">
            <Activity className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs tabular-nums">
          <span className="text-slate-400">Peso sobre a renda (α_m):</span>
          <span className="inline-flex items-center rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-200">
            {allocation.rendaTotal > 0
              ? formatPct(allocation.percentualCustos)
              : "0,0% (Sem Renda)"}
          </span>
        </div>
      </article>

      {/* 3. Investimentos & Provisões */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-4 shadow-lg min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Investimentos & Provisões
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-emerald-300 tabular-nums truncate">
              {formatBRL(totalPoupado)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <PiggyBank className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs tabular-nums">
          <span className="text-slate-400 truncate">
            Aportes {formatBRL(allocation.investimentosTotal)} + Sinking{" "}
            {formatBRL(allocation.provisoesTotal)}
          </span>
          <span className="shrink-0 inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-300">
            β_m {formatPct(taxaPoupancaPct)}
          </span>
        </div>
      </article>

      {/* 4. Saldo Residual de Caixa (Delta_m) */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-4 shadow-lg min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Saldo Residual de Caixa (Δ_m)
            </p>
            <p
              className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums truncate ${
                allocation.saldoResidual >= 0
                  ? "text-cyan-300"
                  : "text-amber-300"
              }`}
            >
              {formatBRL(allocation.saldoResidual, true)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <Scale className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs">
          <span className="text-slate-400 truncate">
            {allocation.saldoResidual >= 0
              ? "Liquidez livre disponível para alocação"
              : "Coberto por saldo acumulado / reserva"}
          </span>
          <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-300">
            {viewMode === "CAIXA" ? "Regime Caixa" : "Competência"}
          </span>
        </div>
      </article>
    </section>
  );
}
