"use client";

import React from "react";
import {
  Calendar,
  Cloud,
  Database,
  Flame,
  Heart,
  RefreshCw,
  RotateCcw,
  Wallet,
} from "lucide-react";
import type { ViewMode } from "@/lib/domain/types";

export type DataSourceMode = "DEMO" | "WORST_CASE" | "LIVE";

export interface MonthOption {
  value: string;
  label: string;
  tag?: string;
}

export const AVAILABLE_MONTHS: readonly MonthOption[] = [
  { value: "2026-09", label: "Setembro 2026", tag: "Sem Renda" },
  { value: "2026-10", label: "Outubro 2026", tag: "Mês Anterior" },
  { value: "2026-11", label: "Novembro 2026", tag: "Mês Atual" },
  { value: "2026-12", label: "Dezembro 2026", tag: "Próximas Faturas" },
  { value: "2027-01", label: "Janeiro 2027", tag: "Próximas Faturas" },
  { value: "2027-02", label: "Fevereiro 2027", tag: "Próximas Faturas" },
];

interface HeaderControlsProps {
  yearMonth: string;
  onYearMonthChange: (yearMonth: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dataSourceMode: DataSourceMode;
  onDataSourceModeChange: (mode: DataSourceMode) => void;
  isConnectedToSheets: boolean;
  isSyncing: boolean;
  onSyncTasks: () => void;
  onResetDemo: () => void;
}

export function HeaderControls({
  yearMonth,
  onYearMonthChange,
  viewMode,
  onViewModeChange,
  dataSourceMode,
  onDataSourceModeChange,
  isConnectedToSheets,
  isSyncing,
  onSyncTasks,
  onResetDemo,
}: HeaderControlsProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-rose-500/20 bg-[#120910]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand Identity */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-500 shadow-lg shadow-rose-500/20">
                <Heart className="h-5 w-5 text-white fill-white/90" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#120910]"
                  title={
                    isConnectedToSheets
                      ? "Conectado à Planilha Google"
                      : "Funcionando com dados locais"
                  }
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnectedToSheets ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                    Ninho
                  </h1>
                  <span className="hidden rounded-full border border-rose-400/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-200 sm:inline-flex">
                    Finanças do Casal
                  </span>
                </div>
                <p className="truncate text-xs text-rose-200/75">
                  Nosso planejamento ·{" "}
                  <span className="text-rose-200 font-semibold">Giovanni</span>{" "}
                  &{" "}
                  <span className="text-pink-300 font-semibold">
                    Maria Luiza
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile Sync Button */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={onSyncTasks}
                disabled={isSyncing}
                className="pressable inline-flex items-center gap-1.5 rounded-xl border border-rose-400/25 bg-[#1B0E18] px-2.5 py-1.5 text-xs font-medium text-rose-100 hover:border-rose-400/40 hover:bg-rose-500/10 disabled:opacity-50"
                title="Sincronizar tarefas"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-rose-400 ${
                    isSyncing ? "animate-spin" : ""
                  }`}
                />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Month/Year Selector */}
            <div className="relative flex items-center rounded-xl border border-rose-500/20 bg-[#1B0E18] px-2.5 py-1.5 text-xs text-rose-100 shadow-sm">
              <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-rose-400" />
              <label htmlFor="month-select" className="sr-only">
                Mês de Referência
              </label>
              <select
                id="month-select"
                value={yearMonth}
                onChange={(e) => onYearMonthChange(e.target.value)}
                className="bg-transparent pr-2 text-base sm:text-xs font-medium text-white focus:outline-none cursor-pointer tabular-nums"
              >
                {AVAILABLE_MONTHS.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    className="bg-[#1B0E18] text-white"
                  >
                    {m.label} {m.tag ? `(${m.tag})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented Control: Fatura vs Data da Compra */}
            <div
              role="group"
              aria-label="Como ver os gastos do mês"
              className="inline-flex rounded-xl border border-rose-500/20 bg-[#1B0E18] p-1"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("CAIXA")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  viewMode === "CAIXA"
                    ? "bg-rose-500/25 text-rose-100 border border-rose-400/40 shadow-xs"
                    : "text-rose-200/70 hover:text-white"
                }`}
                title="Mostra o que realmente sai do bolso ou vence na fatura deste mês"
              >
                <Wallet className="h-3.5 w-3.5 text-rose-400" />
                <span>Pela Fatura</span>
                <span className="hidden xl:inline text-[10px] text-rose-300">
                  (Quando sai do bolso)
                </span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("COMPETENCIA")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  viewMode === "COMPETENCIA"
                    ? "bg-pink-500/25 text-pink-100 border border-pink-400/40 shadow-xs"
                    : "text-rose-200/70 hover:text-white"
                }`}
                title="Mostra as compras pela data em que foram feitas"
              >
                <Calendar className="h-3.5 w-3.5 text-pink-400" />
                <span>Pela Data da Compra</span>
              </button>
            </div>

            {/* Segmented Control: Fonte de Dados */}
            <div
              role="group"
              aria-label="Fonte de Dados"
              className="inline-flex rounded-xl border border-rose-500/20 bg-[#1B0E18] p-1"
            >
              <button
                type="button"
                onClick={() => onDataSourceModeChange("DEMO")}
                className={`pressable flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "DEMO"
                    ? "bg-rose-500/25 text-rose-100 border border-rose-400/40"
                    : "text-rose-200/70 hover:text-white"
                }`}
              >
                <Database className="h-3 w-3 text-rose-400" />
                <span>Dados de Exemplo</span>
              </button>
              <button
                type="button"
                onClick={() => onDataSourceModeChange("WORST_CASE")}
                className={`pressable flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "WORST_CASE"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                    : "text-rose-200/70 hover:text-white"
                }`}
                title="Cenário de teste com compras longas, muitas parcelas e mesada estourada"
              >
                <Flame className="h-3 w-3 text-amber-400" />
                <span>Teste Extremo</span>
              </button>
              <button
                type="button"
                onClick={() => onDataSourceModeChange("LIVE")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "LIVE"
                    ? "bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-400/40"
                    : "text-rose-200/70 hover:text-white"
                }`}
                title={
                  isConnectedToSheets
                    ? "Conectado à Planilha Google"
                    : "Planilha Google (modo demonstração ativo)"
                }
              >
                <Cloud className="h-3 w-3 text-fuchsia-400" />
                <span>Planilha Google</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isConnectedToSheets ? "bg-emerald-400" : "bg-rose-400/50"
                  }`}
                />
              </button>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                type="button"
                onClick={onSyncTasks}
                disabled={isSyncing}
                className="pressable inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/25 hover:border-rose-400/50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-rose-300 ${
                    isSyncing ? "animate-spin" : ""
                  }`}
                />
                <span>Sincronizar</span>
              </button>

              {dataSourceMode !== "LIVE" && (
                <button
                  type="button"
                  onClick={onResetDemo}
                  className="pressable inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-[#1B0E18] px-2.5 py-1.5 text-xs font-medium text-rose-200/70 hover:text-white hover:border-rose-400/40"
                  title="Restaurar dados iniciais de exemplo"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
