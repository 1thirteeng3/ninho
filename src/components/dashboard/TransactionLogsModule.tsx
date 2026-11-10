"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  ScrollText,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  filterTransactionsByMonth,
  roundCurrency,
} from "@/lib/domain/financial-engine";
import type { Member, Transaction, ViewMode } from "@/lib/domain/types";
import {
  formatBRL,
  formatShortDate,
  getFlowBadgeStyle,
  getMemberBadgeStyle,
  getScopeBadgeLabel,
} from "@/lib/formatters";
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
      className="animate-enter delay-3 rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30">
              <ScrollText className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-white">
              Histórico de Entradas e Saídas (Logs)
            </h2>
          </div>
          <p className="mt-1 text-xs text-rose-200/75">
            Extrato completo de tudo que entrou, saiu ou foi guardado — pesquise,
            filtre por pessoa ou apague lançamentos feitos por engano
          </p>
        </div>

        {/* Summary Counters */}
        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            Entrou: {formatBRL(totals.entradas)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl border border-rose-400/30 bg-rose-500/15 px-2.5 py-1 font-semibold text-rose-200">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Saiu: {formatBRL(totals.saidas)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/15 px-2.5 py-1 font-semibold text-fuchsia-200">
            <Sparkles className="h-3 w-3" />
            Guardado: {formatBRL(totals.guardado)}
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-500/15 bg-[#120910]/80 p-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Flow Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFlowFilter("ALL")}
            className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
              flowFilter === "ALL"
                ? "bg-rose-500/25 text-rose-100 border border-rose-400/40"
                : "text-rose-200/70 hover:text-white"
            }`}
          >
            Tudo ({baseTransactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("ENTRADA")}
            className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
              flowFilter === "ENTRADA"
                ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                : "text-rose-200/70 hover:text-white"
            }`}
          >
            ↑ Entradas (+)
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("SAIDA")}
            className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
              flowFilter === "SAIDA"
                ? "bg-rose-500/25 text-rose-100 border border-rose-400/40"
                : "text-rose-200/70 hover:text-white"
            }`}
          >
            ↓ Saídas (-)
          </button>
          <button
            type="button"
            onClick={() => setFlowFilter("GUARDADO")}
            className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
              flowFilter === "GUARDADO"
                ? "bg-fuchsia-500/20 text-fuchsia-100 border border-fuchsia-400/40"
                : "text-rose-200/70 hover:text-white"
            }`}
          >
            ✦ Investimentos & Reserva
          </button>
        </div>

        {/* Right Controls: Member + Period + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Member Filter */}
          <div className="inline-flex rounded-lg border border-rose-500/20 bg-[#1B0E18] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMemberFilter("ALL")}
              className={`pressable rounded-md px-2 py-1 text-[11px] font-medium ${
                memberFilter === "ALL"
                  ? "bg-rose-500/25 text-rose-100"
                  : "text-rose-200/60 hover:text-white"
              }`}
            >
              Casal
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("Giovanni")}
              className={`pressable rounded-md px-2 py-1 text-[11px] font-medium ${
                memberFilter === "Giovanni"
                  ? "bg-rose-500/25 text-rose-100"
                  : "text-rose-200/60 hover:text-white"
              }`}
            >
              Giovanni
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("Maria Luiza")}
              className={`pressable rounded-md px-2 py-1 text-[11px] font-medium ${
                memberFilter === "Maria Luiza"
                  ? "bg-pink-500/25 text-pink-100"
                  : "text-rose-200/60 hover:text-white"
              }`}
            >
              Maria Luiza
            </button>
          </div>

          {/* Period Filter */}
          <div className="inline-flex rounded-lg border border-rose-500/20 bg-[#1B0E18] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriodFilter("MONTH")}
              className={`pressable rounded-md px-2 py-1 text-[11px] font-medium ${
                periodFilter === "MONTH"
                  ? "bg-rose-500/25 text-rose-100"
                  : "text-rose-200/60 hover:text-white"
              }`}
            >
              Mês Selecionado
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter("ALL_TIME")}
              className={`pressable rounded-md px-2 py-1 text-[11px] font-medium ${
                periodFilter === "ALL_TIME"
                  ? "bg-rose-500/25 text-rose-100"
                  : "text-rose-200/60 hover:text-white"
              }`}
            >
              Todo o Histórico
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-rose-300/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição, cartão..."
              className="w-full rounded-lg border border-rose-400/20 bg-[#1B0E18] py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-rose-300/70 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Log Entries List */}
      {filteredLogs.length === 0 ? (
        <div className="mt-4 rounded-xl border border-rose-500/15 bg-[#120910]/50 p-8 text-center text-xs text-rose-200/70">
          Nenhum lançamento encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredLogs.map((tx) => {
            const flowBadge = getFlowBadgeStyle(tx.tipo_fluxo);
            const scopeBadge = getScopeBadgeLabel(tx.escopo);
            const hasDateDivergence = tx.data_competencia !== tx.data_caixa;
            const isIncome = tx.tipo_fluxo === "RENDA";
            const isInvest =
              tx.tipo_fluxo === "INVESTIMENTO" ||
              tx.tipo_fluxo === "PROVISAO_ANUAL";

            return (
              <div
                key={tx.id}
                className="flex flex-col justify-between gap-2.5 rounded-xl border border-rose-500/15 bg-[#120910]/75 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center min-w-0 hover:border-rose-400/35 transition-colors"
              >
                {/* Left: Badges + Description + Dates */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${flowBadge.className}`}
                    >
                      {flowBadge.label}
                    </span>
                    <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-100">
                      {tx.categoria}
                    </span>
                    {tx.total_parcelas > 1 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 tabular-nums">
                        <Layers className="h-2.5 w-2.5" />
                        Parcela {tx.parcela_atual} de {tx.total_parcelas}
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-1 font-semibold text-white break-words"
                    title={tx.descricao}
                  >
                    {tx.descricao}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-rose-200/70 tabular-nums">
                    <span>
                      Compra:{" "}
                      <strong className="text-rose-100">
                        {formatShortDate(tx.data_competencia)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span
                      className={
                        hasDateDivergence ? "text-pink-300 font-medium" : ""
                      }
                    >
                      Fatura/Saída:{" "}
                      <strong>{formatShortDate(tx.data_caixa)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-rose-100">{tx.conta}</span>
                  </div>
                </div>

                {/* Right: Who paid + Scope + Amount + Delete */}
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
                    className={`min-w-[96px] text-right text-sm font-bold tabular-nums ${
                      isIncome
                        ? "text-emerald-300"
                        : isInvest
                          ? "text-fuchsia-300"
                          : "text-rose-200"
                    }`}
                  >
                    {isIncome
                      ? `+ ${formatBRL(Math.abs(tx.valor))}`
                      : isInvest
                        ? formatBRL(Math.abs(tx.valor))
                        : `- ${formatBRL(Math.abs(tx.valor))}`}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(tx)}
                    className="pressable rounded-lg border border-rose-500/20 bg-[#1B0E18] p-1.5 text-rose-300/70 hover:border-rose-400 hover:bg-rose-500/20 hover:text-white"
                    title="Apagar este lançamento do histórico"
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
