"use client";

import React, { useMemo } from "react";
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

  // Proportions for the continuous Apple Card / Apple Storage balance bar
  const compositionSlices = useMemo(() => {
    const baseTotal = Math.max(
      allocation.rendaTotal,
      allocation.custosTotal +
        allocation.investimentosTotal +
        allocation.provisoesTotal +
        Math.max(0, allocation.saldoResidual),
      1
    );

    const gastosPct = Math.max(0, (allocation.custosTotal / baseTotal) * 100);
    const investPct = Math.max(
      0,
      (allocation.investimentosTotal / baseTotal) * 100
    );
    const reservaPct = Math.max(
      0,
      (allocation.provisoesTotal / baseTotal) * 100
    );
    const sobraPct = Math.max(
      0,
      (Math.max(0, allocation.saldoResidual) / baseTotal) * 100
    );

    return {
      gastosPct,
      investPct,
      reservaPct,
      sobraPct,
    };
  }, [allocation]);

  return (
    <section
      aria-label="Resumo do Mês"
      className="animate-enter delay-1 surface-card rounded-2xl overflow-hidden"
    >
      {/* 4-Column Unified Editorial Panel */}
      <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {/* Coluna 1: Entradas do Mês */}
        <article className="flex flex-col justify-between p-5 min-w-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
              Entradas do Mês
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink tabular-nums truncate">
              {formatBRL(allocation.rendaTotal)}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-secondary tabular-nums truncate">
            Giovanni{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(memberIncomeBreakdown.giovanni)}
            </strong>{" "}
            · Maria Luiza{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(memberIncomeBreakdown.mariaLuiza)}
            </strong>
          </p>
        </article>

        {/* Coluna 2: Gastos do Mês */}
        <article className="flex flex-col justify-between p-5 min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
                Gastos do Mês
              </p>
              <span className="text-xs font-medium text-[#BE123C] tabular-nums">
                {allocation.rendaTotal > 0
                  ? `${formatPct(allocation.percentualCustos)} da renda`
                  : "Sem renda"}
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink tabular-nums truncate">
              {formatBRL(allocation.custosTotal)}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-secondary truncate">
            Despesas fixas, cartões e dia a dia
          </p>
        </article>

        {/* Coluna 3: Guardado p/ o Futuro */}
        <article className="flex flex-col justify-between p-5 min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
                Guardado p/ o Futuro
              </p>
              <span className="text-xs font-medium text-[#9F1239] dark:text-[#FB7185] tabular-nums">
                {formatPct(taxaPoupancaPct)} da renda
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink tabular-nums truncate">
              {formatBRL(totalPoupado)}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-secondary tabular-nums truncate">
            Metas {formatBRL(allocation.investimentosTotal)} · Reserva Anual{" "}
            {formatBRL(allocation.provisoesTotal)}
          </p>
        </article>

        {/* Coluna 4: Sobra Livre na Conta */}
        <article className="flex flex-col justify-between p-5 min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
                Sobra Livre na Conta
              </p>
              <span className="text-[11px] font-medium text-ink-muted">
                {viewMode === "CAIXA" ? "Fatura do Mês" : "Data da Compra"}
              </span>
            </div>
            <p
              className={`mt-2 text-3xl font-semibold tracking-[-0.03em] tabular-nums truncate ${
                allocation.saldoResidual >= 0
                  ? "text-[#0F766E] dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatBRL(allocation.saldoResidual, true)}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-secondary truncate">
            {allocation.saldoResidual >= 0
              ? "Disponível livre na conta conjunta"
              : "Coberto pela reserva acumulada"}
          </p>
        </article>
      </div>

      {/* Apple Card / Apple Storage Continuous Balance Bar Footer */}
      <div className="border-t border-hairline bg-[var(--bg-subtle)]/50 px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-medium text-ink-secondary">
            Composição da renda no mês
          </span>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#BE123C]" />
              Gastos ({formatPct(allocation.percentualCustos)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#9F1239]" />
              Investimentos ({formatPct(allocation.percentualInvestimentos)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D97706]" />
              Reserva Anual ({formatPct(allocation.percentualProvisoes)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0F766E]" />
              Sobra Livre ({formatBRL(Math.max(0, allocation.saldoResidual))})
            </span>
          </div>
        </div>

        <div className="mt-2 h-2 w-full rounded-full overflow-hidden flex gap-0.5 bg-[var(--border-hairline)]">
          {compositionSlices.gastosPct > 0 && (
            <div
              className="h-full bg-[#BE123C] transition-all duration-300"
              style={{ width: `${compositionSlices.gastosPct}%` }}
              title={`Gastos: ${formatBRL(allocation.custosTotal)}`}
            />
          )}
          {compositionSlices.investPct > 0 && (
            <div
              className="h-full bg-[#9F1239] transition-all duration-300"
              style={{ width: `${compositionSlices.investPct}%` }}
              title={`Investimentos: ${formatBRL(allocation.investimentosTotal)}`}
            />
          )}
          {compositionSlices.reservaPct > 0 && (
            <div
              className="h-full bg-[#D97706] transition-all duration-300"
              style={{ width: `${compositionSlices.reservaPct}%` }}
              title={`Reserva Anual: ${formatBRL(allocation.provisoesTotal)}`}
            />
          )}
          {compositionSlices.sobraPct > 0 && (
            <div
              className="h-full bg-[#0F766E] transition-all duration-300"
              style={{ width: `${compositionSlices.sobraPct}%` }}
              title={`Sobra Livre: ${formatBRL(allocation.saldoResidual)}`}
            />
          )}
        </div>
      </div>
    </section>
  );
}
