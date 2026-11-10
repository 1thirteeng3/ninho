"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  ListFilter,
  Table2,
} from "lucide-react";
import {
  filterTransactionsByMonth,
  roundCurrency,
  type IncomeAllocationResult,
} from "@/lib/domain/financial-engine";
import type {
  Category,
  InvestmentGoal,
  Transaction,
  ViewMode,
} from "@/lib/domain/types";
import {
  CATEGORY_COLORS,
  formatBRL,
  formatPct,
  formatShortDate,
  getFlowBadgeStyle,
  getMemberBadgeStyle,
  getScopeBadgeLabel,
} from "@/lib/formatters";

interface DynamicAllocationTableProps {
  allocation: IncomeAllocationResult;
  goals: InvestmentGoal[];
  transactions: Transaction[];
  yearMonth: string;
  viewMode: ViewMode;
}

export function DynamicAllocationTable({
  allocation,
  goals,
  transactions,
  yearMonth,
  viewMode,
}: DynamicAllocationTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<{
    custos: boolean;
    provisoes: boolean;
    investimentos: boolean;
  }>({
    custos: true,
    provisoes: true,
    investimentos: true,
  });

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    string | "ALL"
  >("ALL");

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, yearMonth, viewMode),
    [transactions, yearMonth, viewMode]
  );

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryFilter === "ALL") {
      return monthTransactions;
    }
    return monthTransactions.filter(
      (tx) => tx.categoria === selectedCategoryFilter
    );
  }, [monthTransactions, selectedCategoryFilter]);

  function toggleGroup(group: "custos" | "provisoes" | "investimentos") {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }

  return (
    <section
      aria-label="Módulo 3: Planilha Dinâmica de Alocação e Auditoria"
      className="animate-enter delay-3 rounded-2xl border border-white/[0.08] bg-[#11131A] p-5 shadow-lg min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Table2 className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              Módulo 3 · Planilha Dinâmica de Alocação Mensal & Ledger Auditável
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Espelho contábil descritivo das 6 categorias de Custo, Provisões
            Anuais e Metas de Investimento
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-lg border border-white/10 bg-[#090A0F] px-2.5 py-1 text-slate-300 tabular-nums">
            {monthTransactions.length} lançamentos no mês
          </span>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#090A0F]/60">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 pl-4 pr-3">Grupo / Categoria Oficial</th>
              <th className="px-3 py-3 text-right">Realizado no Mês</th>
              <th className="px-3 py-3 text-right">% da Renda (R_m)</th>
              <th className="px-4 py-3">Proporção Visual / Progresso da Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {/* GRUPO 1: CUSTOS OPERACIONAIS */}
            <tr className="bg-indigo-500/[0.06]">
              <td className="py-2.5 pl-4 pr-3 font-semibold text-indigo-200">
                <button
                  type="button"
                  onClick={() => toggleGroup("custos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.custos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  )}
                  <span>1. Custos Operacionais (6 Categorias)</span>
                </button>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
                {formatBRL(allocation.custosTotal)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-indigo-200 tabular-nums">
                {formatPct(allocation.percentualCustos)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualCustos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Neutro descritivo
                  </span>
                </div>
              </td>
            </tr>

            {expandedGroups.custos &&
              allocation.categoriasCusto.map((item) => {
                const color = CATEGORY_COLORS[item.categoria] ?? "#6366F1";
                const barWidth = Math.min(
                  100,
                  Math.max(0, item.percentualRenda)
                );
                const isSelected = selectedCategoryFilter === item.categoria;

                return (
                  <tr
                    key={item.categoria}
                    onClick={() =>
                      setSelectedCategoryFilter(
                        isSelected ? "ALL" : item.categoria
                      )
                    }
                    className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      isSelected ? "bg-indigo-500/10" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-9 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-slate-200">
                          {item.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-100 tabular-nums">
                      {formatBRL(item.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                      {formatPct(item.percentualRenda)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {/* GRUPO 2: PROVISÕES ANUAIS (SINKING FUNDS) */}
            <tr className="bg-amber-500/[0.06]">
              <td className="py-2.5 pl-4 pr-3 font-semibold text-amber-200">
                <button
                  type="button"
                  onClick={() => toggleGroup("provisoes")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.provisoes ? (
                    <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <span>2. Provisões Anuais (Sinking Funds 1/12)</span>
                </button>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
                {formatBRL(allocation.provisoesTotal)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-amber-200 tabular-nums">
                {formatPct(allocation.percentualProvisoes)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualProvisoes)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-amber-300/80">
                    IPVA · Seguro · Revisão
                  </span>
                </div>
              </td>
            </tr>

            {expandedGroups.provisoes && (
              <tr
                onClick={() =>
                  setSelectedCategoryFilter(
                    selectedCategoryFilter === "Fundo Anual (Carro/Impostos)"
                      ? "ALL"
                      : "Fundo Anual (Carro/Impostos)"
                  )
                }
                className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                  selectedCategoryFilter === "Fundo Anual (Carro/Impostos)"
                    ? "bg-amber-500/10"
                    : ""
                }`}
              >
                <td className="py-2.5 pl-9 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <span className="font-medium text-slate-200">
                      Fundo Anual (Carro/Impostos)
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-slate-100 tabular-nums">
                  {formatBRL(allocation.provisoesTotal)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                  {formatPct(allocation.percentualProvisoes)}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-slate-400">
                  Cota mensal recomendada: R$ 500,00 (R$ 6.000,00 / 12 meses)
                </td>
              </tr>
            )}

            {/* GRUPO 3: INVESTIMENTOS & METAS */}
            <tr className="bg-emerald-500/[0.06]">
              <td className="py-2.5 pl-4 pr-3 font-semibold text-emerald-200">
                <button
                  type="button"
                  onClick={() => toggleGroup("investimentos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.investimentos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>3. Investimentos & Metas de Acumulação</span>
                </button>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-emerald-300 tabular-nums">
                {formatBRL(allocation.investimentosTotal)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-emerald-200 tabular-nums">
                {formatPct(allocation.percentualInvestimentos)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualInvestimentos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-emerald-300/80">
                    Progresso rumo ao Valor Alvo
                  </span>
                </div>
              </td>
            </tr>

            {expandedGroups.investimentos &&
              allocation.categoriasInvestimento.map((invItem) => {
                const matchingGoal = goals.find(
                  (g) => g.nome === invItem.categoria
                );
                const saldoAtual = matchingGoal?.saldo_bruto_atual ?? 0;
                const valorAlvo = matchingGoal?.valor_alvo ?? 0;
                const goalPct =
                  valorAlvo > 0
                    ? roundCurrency((saldoAtual / valorAlvo) * 100)
                    : 0;
                const clampedGoalPct = Math.min(100, Math.max(0, goalPct));
                const color =
                  CATEGORY_COLORS[invItem.categoria as Category] ?? "#10B981";
                const isSelected =
                  selectedCategoryFilter === invItem.categoria;

                return (
                  <tr
                    key={invItem.categoria}
                    onClick={() =>
                      setSelectedCategoryFilter(
                        isSelected ? "ALL" : invItem.categoria
                      )
                    }
                    className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      isSelected ? "bg-emerald-500/10" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-9 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-slate-200">
                          {invItem.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-300 tabular-nums">
                      {formatBRL(invItem.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                      {formatPct(invItem.percentualRenda)}
                    </td>
                    <td className="px-4 py-2.5">
                      {matchingGoal ? (
                        <div className="flex flex-wrap items-center gap-2 tabular-nums">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${clampedGoalPct}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-300">
                            {formatBRL(saldoAtual)} / {formatBRL(valorAlvo)} —{" "}
                            <strong className="text-emerald-300">
                              {formatPct(goalPct)}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Auditable Transactions Ledger for the Selected Month */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Transações Auditáveis do Mês (
              {viewMode === "CAIXA" ? "Visão Caixa" : "Visão Competência"})
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCategoryFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("ALL")}
                className="pressable inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200"
              >
                <Filter className="h-3 w-3" />
                <span>Filtro: {selectedCategoryFilter} (Limpar)</span>
              </button>
            )}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-[#090A0F]/40 p-6 text-center text-xs text-slate-400">
            Nenhuma transação encontrada para o filtro selecionado neste mês.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
            {filteredTransactions.map((tx) => {
              const flowBadge = getFlowBadgeStyle(tx.tipo_fluxo);
              const scopeBadge = getScopeBadgeLabel(tx.escopo);
              const hasDateDivergence = tx.data_competencia !== tx.data_caixa;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#090A0F]/70 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center min-w-0"
                >
                  {/* Left: Description + Category + Dates */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${flowBadge.className}`}
                      >
                        {flowBadge.label}
                      </span>
                      <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                        {tx.categoria}
                      </span>
                      {tx.total_parcelas > 1 && (
                        <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 tabular-nums">
                          <Layers className="h-2.5 w-2.5" />
                          Parcela {tx.parcela_atual}/{tx.total_parcelas}
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-1 font-medium text-white break-words"
                      title={tx.descricao}
                    >
                      {tx.descricao}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                      <span>
                        Comp: <strong>{formatShortDate(tx.data_competencia)}</strong>
                      </span>
                      <span>•</span>
                      <span
                        className={
                          hasDateDivergence ? "text-cyan-300 font-medium" : ""
                        }
                      >
                        Caixa: <strong>{formatShortDate(tx.data_caixa)}</strong>
                      </span>
                      <span>•</span>
                      <span className="text-slate-300">{tx.conta}</span>
                    </div>
                  </div>

                  {/* Right: Member + Scope + Amount */}
                  <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getMemberBadgeStyle(
                          tx.pago_por
                        )}`}
                      >
                        {tx.pago_por}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${scopeBadge.className}`}
                      >
                        {scopeBadge.label}
                      </span>
                    </div>

                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.valor >= 0 ? "text-emerald-300" : "text-white"
                      }`}
                    >
                      {formatBRL(tx.valor, tx.valor > 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
