"use client";

import React, { useMemo, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  filterTransactionsByMonth,
  roundCurrency,
} from "@/lib/domain/financial-engine";
import type { Member, Transaction, ViewMode } from "@/lib/domain/types";
import { formatBRL, formatShortDate } from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

interface TransactionLogsModuleProps {
  transactions: Transaction[];
  yearMonth: string;
  viewMode: ViewMode;
  dataSourceMode: DataSourceMode;
  onDataChanged: () => Promise<void> | void;
}

type LogFlowFilter = "ALL" | "ENTRADA" | "SAIDA" | "GUARDADO";
type LogPeriodFilter = "MONTH" | "ALL_TIME";
type LogMemberFilter = "ALL" | Member;

export function TransactionLogsModule({
  transactions,
  yearMonth,
  viewMode,
  dataSourceMode,
  onDataChanged,
}: TransactionLogsModuleProps) {
  const [flowFilter, setFlowFilter] = useState<LogFlowFilter>("ALL");
  const [periodFilter, setPeriodFilter] = useState<LogPeriodFilter>("MONTH");
  const [memberFilter, setMemberFilter] = useState<LogMemberFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const baseTransactions = useMemo(() => {
    if (periodFilter === "ALL_TIME") {
      return [...transactions].sort((a, b) => {
        const dateA = viewMode === "CAIXA" ? a.data_caixa : a.data_competencia;
        const dateB = viewMode === "CAIXA" ? b.data_caixa : b.data_competencia;
        return dateB.localeCompare(dateA);
      });
    }
    return filterTransactionsByMonth(transactions, yearMonth, viewMode).sort(
      (a, b) => {
        const dateA = viewMode === "CAIXA" ? a.data_caixa : a.data_competencia;
        const dateB = viewMode === "CAIXA" ? b.data_caixa : b.data_competencia;
        return dateB.localeCompare(dateA);
      }
    );
  }, [transactions, periodFilter, yearMonth, viewMode]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return baseTransactions.filter((tx) => {
      if (flowFilter === "ENTRADA" && tx.tipo_fluxo !== "RENDA") {
        return false;
      }
      if (flowFilter === "SAIDA" && tx.tipo_fluxo !== "CUSTO") {
        return false;
      }
      if (
        flowFilter === "GUARDADO" &&
        tx.tipo_fluxo !== "INVESTIMENTO" &&
        tx.tipo_fluxo !== "PROVISAO_ANUAL"
      ) {
        return false;
      }
      if (memberFilter !== "ALL" && tx.pago_por !== memberFilter) {
        return false;
      }
      if (q.length > 0) {
        const hay =
          `${tx.descricao} ${tx.categoria} ${tx.conta} ${tx.pago_por}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [baseTransactions, flowFilter, memberFilter, searchQuery]);

  const totals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let guardado = 0;

    for (const tx of filteredLogs) {
      const abs = Math.abs(tx.valor);
      if (tx.tipo_fluxo === "RENDA") {
        entradas = roundCurrency(entradas + abs);
      } else if (tx.tipo_fluxo === "CUSTO") {
        saidas = roundCurrency(saidas + abs);
      } else if (
        tx.tipo_fluxo === "INVESTIMENTO" ||
        tx.tipo_fluxo === "PROVISAO_ANUAL"
      ) {
        guardado = roundCurrency(guardado + abs);
      }
    }

    return { entradas, saidas, guardado };
  }, [filteredLogs]);

  async function handleDeleteTransaction(tx: Transaction) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_TRANSACTION",
          id: tx.id,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível excluir o registro.");
      }

      toast.success(`Lançamento excluído: ${tx.descricao}`);
      await onDataChanged();
    } catch {
      toast.error("Erro ao excluir lançamento.");
    }
  }

  return (
    <section
      aria-label="Histórico de Entradas e Saídas (Logs)"
      className="animate-enter delay-2 surface-card rounded-2xl overflow-hidden"
    >
      {/* Editorial Header + Summary Counters */}
      <div className="flex flex-col gap-3 border-b border-hairline px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-editorial text-xl italic tracking-tight text-ink">
            Extrato &amp; Histórico de Lançamentos
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Registro completo de entradas, despesas e aportes — pesquise, filtre ou remova itens
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
          <div>
            <span className="text-ink-muted">Entrou: </span>
            <strong className="font-semibold text-[#0F766E] dark:text-emerald-400">
              +{formatBRL(totals.entradas)}
            </strong>
          </div>
          <div>
            <span className="text-ink-muted">Saiu: </span>
            <strong className="font-semibold text-[#EC4899] dark:text-rose-400">
              -{formatBRL(totals.saidas)}
            </strong>
          </div>
          <div>
            <span className="text-ink-muted">Guardado: </span>
            <strong className="font-semibold text-[#C084FC] dark:text-[#FB7185]">
              {formatBRL(totals.guardado)}
            </strong>
          </div>
        </div>
      </div>

      {/* Minimalist Pill Filters + Search Toolbar */}
      <div className="flex flex-col gap-3 border-b border-hairline bg-[var(--bg-subtle)]/40 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Flow Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFlowFilter("ALL")}
            className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
              flowFilter === "ALL"
                ? "bg-[#EC4899] text-white font-semibold"
                : "surface-card text-ink-secondary hover:text-ink"
            }`}
          >
            Todos ({baseTransactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("ENTRADA")}
            className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
              flowFilter === "ENTRADA"
                ? "bg-[#0F766E] text-white font-semibold"
                : "surface-card text-ink-secondary hover:text-ink"
            }`}
          >
            ↑ Entradas
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("SAIDA")}
            className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
              flowFilter === "SAIDA"
                ? "bg-[#EC4899] text-white font-semibold"
                : "surface-card text-ink-secondary hover:text-ink"
            }`}
          >
            ↓ Saídas
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("GUARDADO")}
            className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
              flowFilter === "GUARDADO"
                ? "bg-[#C084FC] text-white font-semibold"
                : "surface-card text-ink-secondary hover:text-ink"
            }`}
          >
            ✦ Investimentos &amp; Reserva
          </button>
        </div>

        {/* Right Controls: Member + Period + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Member Filter */}
          <div className="surface-card inline-flex rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMemberFilter("ALL")}
              className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                memberFilter === "ALL"
                  ? "bg-[var(--bg-subtle)] text-ink font-semibold"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Casal
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("Giovanni")}
              className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                memberFilter === "Giovanni"
                  ? "bg-[var(--bg-subtle)] text-ink font-semibold"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Giovanni
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("Maria Luiza")}
              className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                memberFilter === "Maria Luiza"
                  ? "bg-[var(--bg-subtle)] text-ink font-semibold"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Maria Luiza
            </button>
          </div>

          {/* Period Filter */}
          <div className="surface-card inline-flex rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriodFilter("MONTH")}
              className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                periodFilter === "MONTH"
                  ? "bg-[var(--bg-subtle)] text-ink font-semibold"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              No Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter("ALL_TIME")}
              className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                periodFilter === "ALL_TIME"
                  ? "bg-[var(--bg-subtle)] text-ink font-semibold"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Tudo
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-52">
            <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição, conta..."
              className="surface-card w-full rounded-full py-1.5 pl-8 pr-7 text-xs text-ink placeholder:text-ink-muted focus:border-[#EC4899] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1.5 text-ink-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statement Rows (Single Clean Surface with 1px divide-y) */}
      {filteredLogs.length === 0 ? (
        <div className="p-10 text-center text-xs text-ink-muted">
          Nenhum lançamento encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="divide-y divide-hairline max-h-[520px] overflow-y-auto">
          {filteredLogs.map((tx) => {
            const isIncome = tx.tipo_fluxo === "RENDA";
            const isInvest =
              tx.tipo_fluxo === "INVESTIMENTO" ||
              tx.tipo_fluxo === "PROVISAO_ANUAL";
            const displayDate =
              viewMode === "CAIXA" ? tx.data_caixa : tx.data_competencia;
            const scopeNote =
              tx.escopo === "CONJUNTO" ? "" : " · Individual";

            return (
              <div
                key={tx.id}
                className="group flex items-center justify-between gap-4 px-6 py-3.5 text-xs transition-colors hover:bg-[var(--bg-subtle)]/35 min-w-0"
              >
                {/* Left: Minimalist Circular Indicator + Strong Title + Single Metadata Line */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isIncome
                        ? "bg-teal-500/10 text-[#0F766E] dark:text-emerald-300"
                        : isInvest
                          ? "bg-rose-900/10 text-[#C084FC] dark:text-[#FB7185]"
                          : "bg-rose-500/10 text-[#EC4899] dark:text-rose-300"
                    }`}
                    aria-hidden="true"
                  >
                    {isIncome ? "↑" : isInvest ? "✦" : "↓"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className="truncate font-semibold text-sm text-ink"
                        title={tx.descricao}
                      >
                        {tx.descricao}
                      </p>
                      {tx.total_parcelas > 1 && (
                        <span className="surface-subtle shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary tabular-nums">
                          {tx.parcela_atual}/{tx.total_parcelas}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-ink-secondary tabular-nums">
                      {formatShortDate(displayDate)} · {tx.categoria} ·{" "}
                      {tx.conta} · {tx.pago_por}
                      {scopeNote}
                    </p>
                  </div>
                </div>

                {/* Right: Amount + Subtle Delete Action */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-right text-sm font-semibold tracking-[-0.02em] tabular-nums ${
                      isIncome
                        ? "text-[#0F766E] dark:text-emerald-400"
                        : isInvest
                          ? "text-[#C084FC] dark:text-[#FB7185]"
                          : "text-ink"
                    }`}
                  >
                    {isIncome
                      ? `+${formatBRL(Math.abs(tx.valor))}`
                      : isInvest
                        ? formatBRL(Math.abs(tx.valor))
                        : `-${formatBRL(Math.abs(tx.valor))}`}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(tx)}
                    className="pressable rounded-lg p-1.5 text-ink-muted opacity-70 transition-opacity hover:bg-rose-500/10 hover:text-[#EC4899] group-hover:opacity-100"
                    title="Apagar este lançamento do histórico"
                    aria-label={`Excluir ${tx.descricao}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
