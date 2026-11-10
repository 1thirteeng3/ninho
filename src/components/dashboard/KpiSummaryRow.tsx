"use client";

import React, { useMemo } from "react";
import {
  PiggyBank,
  ShoppingBag,
  Sparkles,
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
      aria-label="Resumo do Mês"
      className="animate-enter delay-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* 1. Entradas do Mês */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-4 shadow-lg shadow-rose-950/20 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/75">
              Entradas do Mês
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-white tabular-nums truncate">
              {formatBRL(allocation.rendaTotal)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rose-500/15 pt-2.5 text-xs tabular-nums">
          <span className="text-rose-200 truncate">
            Giovanni:{" "}
            <strong className="text-white">
              {formatBRL(memberIncomeBreakdown.giovanni)}
            </strong>
          </span>
          <span className="text-pink-300 truncate">
            Maria Luiza:{" "}
            <strong className="text-white">
              {formatBRL(memberIncomeBreakdown.mariaLuiza)}
            </strong>
          </span>
        </div>
      </article>

      {/* 2. Gastos do Mês */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-4 shadow-lg shadow-rose-950/20 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/75">
              Gastos do Mês
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-white tabular-nums truncate">
              {formatBRL(allocation.custosTotal)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
            <ShoppingBag className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-rose-500/15 pt-2.5 text-xs tabular-nums">
          <span className="text-rose-200/75">Fatia da renda:</span>
          <span className="inline-flex items-center rounded-md border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-100">
            {allocation.rendaTotal > 0
              ? formatPct(allocation.percentualCustos)
              : "Sem entradas no mês"}
          </span>
        </div>
      </article>

      {/* 3. Guardado no Mês */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-4 shadow-lg shadow-rose-950/20 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/75">
              Guardado no Mês
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-pink-300 tabular-nums truncate">
              {formatBRL(totalPoupado)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-400/30 bg-pink-500/15 text-pink-300">
            <PiggyBank className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-rose-500/15 pt-2.5 text-xs tabular-nums">
          <span className="text-rose-200/75 truncate">
            Investido {formatBRL(allocation.investimentosTotal)} + Reserva{" "}
            {formatBRL(allocation.provisoesTotal)}
          </span>
          <span className="shrink-0 inline-flex items-center rounded-md border border-pink-400/30 bg-pink-500/15 px-2 py-0.5 font-semibold text-pink-200">
            {formatPct(taxaPoupancaPct)}
          </span>
        </div>
      </article>

      {/* 4. Sobra Livre do Mês */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-4 shadow-lg shadow-rose-950/20 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-200/75">
              Sobra Livre do Mês
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums truncate ${
                allocation.saldoResidual >= 0
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {formatBRL(allocation.saldoResidual, true)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-300">
            <Sparkles className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-rose-500/15 pt-2.5 text-xs">
          <span className="text-rose-200/75 truncate">
            {allocation.saldoResidual >= 0
              ? "Disponível livre na conta"
              : "Coberto pela reserva acumulada"}
          </span>
          <span className="shrink-0 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200">
            {viewMode === "CAIXA" ? "Pela Fatura" : "Pela Compra"}
          </span>
        </div>
      </article>
    </section>
  );
}
