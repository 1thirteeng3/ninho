"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
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
      className="animate-enter delay-2 surface-card rounded-2xl overflow-hidden min-w-0"
    >
      {/* Editorial Header */}
      <div className="flex flex-col gap-2 border-b border-hairline px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-editorial text-xl italic tracking-tight text-ink truncate">
            Resumo por Categoria do Mês
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Acompanhamento de gastos cotidianos, reserva anual e aportes nas metas
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {selectedCategoryFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter("ALL")}
              className="pressable surface-rose-tint inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[#EC4899]"
            >
              <Filter className="h-3 w-3" />
              <span>{selectedCategoryFilter} ×</span>
            </button>
          )}
          <span className="surface-subtle rounded-full px-3 py-1 text-[11px] font-medium text-ink-secondary tabular-nums">
            {monthTransactions.length} lançamentos
          </span>
        </div>
      </div>

      {/* Financial Magazine Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-hairline bg-[var(--bg-subtle)]/60 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
              <th className="py-3 pl-6 pr-3">Grupo / Categoria</th>
              <th className="px-4 py-3 text-right">Valor no Mês</th>
              <th className="px-4 py-3 text-right">Fatia da Renda</th>
              <th className="py-3 pl-4 pr-6">Proporção &amp; Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {/* GRUPO 1: GASTOS DO DIA A DIA */}
            <tr className="bg-[var(--bg-subtle)]/35">
              <td className="py-3 pl-6 pr-3 font-semibold text-ink">
                <button
                  type="button"
                  onClick={() => toggleGroup("custos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.custos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-ink-secondary" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-ink-secondary" />
                  )}
                  <span>1. Gastos do Dia a Dia e Contas Fixas</span>
                </button>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                {formatBRL(allocation.custosTotal)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#EC4899] tabular-nums">
                {formatPct(allocation.percentualCustos)}
              </td>
              <td className="py-3 pl-4 pr-6">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#EC4899] transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualCustos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-muted shrink-0">
                    Despesas mensais
                  </span>
                </div>
              </td>
            </tr>

            {expandedGroups.custos &&
              allocation.categoriasCusto.map((item) => {
                const color = CATEGORY_COLORS[item.categoria] ?? "#EC4899";
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
                    className={`cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]/40 ${
                      isSelected ? "bg-[var(--bg-rose-tint)]" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-11 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-ink">
                          {item.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink tabular-nums">
                      {formatBRL(item.valor)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-secondary tabular-nums">
                      {formatPct(item.percentualRenda)}
                    </td>
                    <td className="py-2.5 pl-4 pr-6">
                      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

            {/* GRUPO 2: RESERVA P/ DESPESAS ANUAIS */}
            <tr className="bg-[var(--bg-subtle)]/35">
              <td className="py-3 pl-6 pr-3 font-semibold text-ink">
                <button
                  type="button"
                  onClick={() => toggleGroup("provisoes")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.provisoes ? (
                    <ChevronDown className="h-3.5 w-3.5 text-ink-secondary" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-ink-secondary" />
                  )}
                  <span>2. Reserva p/ Despesas Anuais (IPVA / Seguro)</span>
                </button>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                {formatBRL(allocation.provisoesTotal)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#D97706] tabular-nums">
                {formatPct(allocation.percentualProvisoes)}
              </td>
              <td className="py-3 pl-4 pr-6">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#D97706] transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualProvisoes)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-muted shrink-0">
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
                className={`cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]/40 ${
                  selectedCategoryFilter === "Fundo Anual (Carro/Impostos)"
                    ? "bg-[var(--bg-rose-tint)]"
                    : ""
                }`}
              >
                <td className="py-2.5 pl-11 pr-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#D97706]" />
                    <span className="font-medium text-ink">
                      Fundo Anual (Carro/Impostos)
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-ink tabular-nums">
                  {formatBRL(allocation.provisoesTotal)}
                </td>
                <td className="px-4 py-2.5 text-right text-ink-secondary tabular-nums">
                  {formatPct(allocation.percentualProvisoes)}
                </td>
                <td className="py-2.5 pl-4 pr-6 text-[11px] text-ink-secondary">
                  Meta mensal sugerida de R$ 500,00 para cobrir R$ 6.000,00/ano
                </td>
              </tr>
            )}

            {/* GRUPO 3: INVESTIMENTOS DO MÊS */}
            <tr className="bg-[var(--bg-subtle)]/35">
              <td className="py-3 pl-6 pr-3 font-semibold text-ink">
                <button
                  type="button"
                  onClick={() => toggleGroup("investimentos")}
                  className="pressable inline-flex items-center gap-1.5"
                >
                  {expandedGroups.investimentos ? (
                    <ChevronDown className="h-3.5 w-3.5 text-ink-secondary" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-ink-secondary" />
                  )}
                  <span>3. Investimentos do Mês &amp; Caixinhas</span>
                </button>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                {formatBRL(allocation.investimentosTotal)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#C084FC] dark:text-[#FB7185] tabular-nums">
                {formatPct(allocation.percentualInvestimentos)}
              </td>
              <td className="py-3 pl-4 pr-6">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#C084FC] transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, allocation.percentualInvestimentos)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-muted shrink-0">
                    Aportes nas metas
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
                  CATEGORY_COLORS[invItem.categoria as Category] ?? "#C084FC";
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
                    className={`cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]/40 ${
                      isSelected ? "bg-[var(--bg-rose-tint)]" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-11 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-ink">
                          {invItem.categoria}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink tabular-nums">
                      {formatBRL(invItem.valor)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-secondary tabular-nums">
                      {formatPct(invItem.percentualRenda)}
                    </td>
                    <td className="py-2.5 pl-4 pr-6">
                      {matchingGoal ? (
                        <div className="flex flex-wrap items-center gap-3 tabular-nums">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${clampedGoalPct}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-ink-secondary">
                            {formatBRL(saldoAtual)} / {formatBRL(valorAlvo)} (
                            <strong className="font-semibold text-ink">
                              {formatPct(goalPct)}
                            </strong>
                            )
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-muted">—</span>
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
