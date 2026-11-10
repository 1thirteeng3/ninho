"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
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

  function toggleGroup(group: "custos" | "provisoes" | "investimentos") {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }

  return (
    <section
      aria-label="Resumo por Categoria do Mês"
      className="animate-enter delay-3 rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20 min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
              <Table2 className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              Resumo por Categoria do Mês
            </h2>
          </div>
          <p className="mt-1 text-xs text-rose-200/70">
            Visão organizada dos gastos do dia a dia, reserva para despesas
            anuais e investimentos do mês
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {selectedCategoryFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter("ALL")}
              className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-100"
            >
              <Filter className="h-3 w-3" />
              <span>Categoria: {selectedCategoryFilter} (Limpar)</span>
            </button>
          )}
          <span className="rounded-lg border border-rose-400/20 bg-[#120910] px-2.5 py-1 text-rose-100 tabular-nums">
            {monthTransactions.length} lançamentos no mês
          </span>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-rose-500/15 bg-[#120910]/60">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-rose-500/15 bg-rose-500/[0.04] text-[11px] font-semibold uppercase tracking-wider text-rose-200/75">
              <th className="py-3 pl-4 pr-3">Grupo / Categoria</th>
              <th className="px-3 py-3 text-right">Valor no Mês</th>
              <th className="px-3 py-3 text-right">Fatia da Renda</th>
              <th className="px-4 py-3">Participação Visual / Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-500/10">
            {/* GRUPO 1: GASTOS DO DIA A DIA */}
            <tr className="bg-rose-500/[0.08]">
              <td className="py-2.5 pl-4 pr-3 font-semibold text-rose-100">
                <button
                  type="button"
                  onClick={() => toggleGroup("custos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.custos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span>1. Gastos do Dia a Dia e Contas Fixas</span>
                </button>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
                {formatBRL(allocation.custosTotal)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-rose-200 tabular-nums">
                {formatPct(allocation.percentualCustos)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-rose-500/15">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualCustos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-rose-200/70">
                    Despesas mensais
                  </span>
                </div>
              </td>
            </tr>

            {expandedGroups.custos &&
              allocation.categoriasCusto.map((item) => {
                const color = CATEGORY_COLORS[item.categoria] ?? "#FB7185";
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
                    className={`cursor-pointer transition-colors hover:bg-rose-500/[0.05] ${
                      isSelected ? "bg-rose-500/15" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-9 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-rose-100">
                          {item.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-white tabular-nums">
                      {formatBRL(item.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-rose-200 tabular-nums">
                      {formatPct(item.percentualRenda)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-rose-500/15">
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

            {/* GRUPO 2: RESERVA P/ DESPESAS ANUAIS */}
            <tr className="bg-amber-500/[0.08]">
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
                  <span>2. Reserva p/ Despesas Anuais (IPVA / Seguro)</span>
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
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-rose-500/15">
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
                className={`cursor-pointer transition-colors hover:bg-rose-500/[0.05] ${
                  selectedCategoryFilter === "Fundo Anual (Carro/Impostos)"
                    ? "bg-amber-500/10"
                    : ""
                }`}
              >
                <td className="py-2.5 pl-9 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <span className="font-medium text-rose-100">
                      Fundo Anual (Carro/Impostos)
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-white tabular-nums">
                  {formatBRL(allocation.provisoesTotal)}
                </td>
                <td className="px-3 py-2.5 text-right text-rose-200 tabular-nums">
                  {formatPct(allocation.percentualProvisoes)}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-rose-200/75">
                  Valor mensal sugerido: R$ 500,00 para cobrir R$ 6.000,00 no
                  ano
                </td>
              </tr>
            )}

            {/* GRUPO 3: INVESTIMENTOS DO MÊS */}
            <tr className="bg-pink-500/[0.08]">
              <td className="py-2.5 pl-4 pr-3 font-semibold text-pink-200">
                <button
                  type="button"
                  onClick={() => toggleGroup("investimentos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.investimentos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-pink-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-pink-400" />
                  )}
                  <span>3. Investimentos do Mês & Caixinhas</span>
                </button>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-pink-200 tabular-nums">
                {formatBRL(allocation.investimentosTotal)}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-pink-200 tabular-nums">
                {formatPct(allocation.percentualInvestimentos)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-rose-500/15">
                    <div
                      className="h-full rounded-full bg-pink-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualInvestimentos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-pink-200/80">
                    Progresso das nossas metas
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
                  CATEGORY_COLORS[invItem.categoria as Category] ?? "#EC4899";
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
                    className={`cursor-pointer transition-colors hover:bg-rose-500/[0.05] ${
                      isSelected ? "bg-pink-500/15" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-9 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-rose-100">
                          {invItem.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-pink-200 tabular-nums">
                      {formatBRL(invItem.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-rose-200 tabular-nums">
                      {formatPct(invItem.percentualRenda)}
                    </td>
                    <td className="px-4 py-2.5">
                      {matchingGoal ? (
                        <div className="flex flex-wrap items-center gap-2 tabular-nums">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-rose-500/15">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${clampedGoalPct}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-rose-100">
                            {formatBRL(saldoAtual)} de {formatBRL(valorAlvo)} —{" "}
                            <strong className="text-pink-300">
                              {formatPct(goalPct)}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-rose-200/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
