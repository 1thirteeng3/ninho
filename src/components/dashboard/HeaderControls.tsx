"use client";

import React from "react";
import {
  Calendar,
  Cloud,
  Database,
  Flame,
  RefreshCw,
  RotateCcw,
  Sparkles,
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
  { value: "2026-09", label: "Setembro 2026", tag: "Renda Zero" },
  { value: "2026-10", label: "Outubro 2026", tag: "Histórico" },
  { value: "2026-11", label: "Novembro 2026", tag: "Mês Atual" },
  { value: "2026-12", label: "Dezembro 2026", tag: "Projeção" },
  { value: "2027-01", label: "Janeiro 2027", tag: "Projeção" },
  { value: "2027-02", label: "Fevereiro 2027", tag: "Projeção" },
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
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#090A0F]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand Identity */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-emerald-500/20 shadow-inner">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#090A0F]"
                  title={
                    isConnectedToSheets
                      ? "Conectado ao Google Sheets"
                      : "Operando com Engine Local"
                  }
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnectedToSheets ? "bg-emerald-400" : "bg-sky-400"
                    }`}
                  />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    Ninho
                  </h1>
                  <span className="hidden rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 sm:inline-flex">
                    Caixa Único + Cota Livre
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">
                  Governança Financeira ·{" "}
                  <span className="text-sky-300 font-medium">Giovanni</span> &{" "}
                  <span className="text-pink-300 font-medium">Maria Luiza</span>
                </p>
              </div>
            </div>

            {/* Mobile Sync Button */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                type="button"
                onClick={onSyncTasks}
                disabled={isSyncing}
                className="pressable inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11131A] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-50"
                title="Sincronizar fila do Google Tasks"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-emerald-400 ${
                    isSyncing ? "animate-spin" : ""
                  }`}
                />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Month/Year Selector */}
            <div className="relative flex items-center rounded-xl border border-white/[0.08] bg-[#11131A] px-2.5 py-1.5 text-xs text-slate-200 shadow-sm">
              <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-indigo-400" />
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
                    className="bg-[#11131A] text-white"
                  >
                    {m.label} {m.tag ? `(${m.tag})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented Control: Bimodalidade Temporal (Caixa vs Competência) */}
            <div
              role="group"
              aria-label="Regime de Visualização Temporal"
              className="inline-flex rounded-xl border border-white/[0.08] bg-[#11131A] p-1"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("CAIXA")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  viewMode === "CAIXA"
                    ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Filtra pela data de efetivo desembolso financeiro ou vencimento da fatura"
              >
                <Wallet className="h-3.5 w-3.5 text-indigo-400" />
                <span>Visão Caixa</span>
                <span className="hidden xl:inline text-[10px] text-indigo-300/75">
                  (Faturas)
                </span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("COMPETENCIA")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  viewMode === "COMPETENCIA"
                    ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Filtra pela data real do ato da compra (fato gerador)"
              >
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span>Visão Competência</span>
                <span className="hidden xl:inline text-[10px] text-cyan-300/75">
                  (Compras)
                </span>
              </button>
            </div>

            {/* Segmented Control: Fonte de Dados (Demo | Pior Caso | Google Sheets Live) */}
            <div
              role="group"
              aria-label="Fonte de Dados"
              className="inline-flex rounded-xl border border-white/[0.08] bg-[#11131A] p-1"
            >
              <button
                type="button"
                onClick={() => onDataSourceModeChange("DEMO")}
                className={`pressable flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "DEMO"
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Database className="h-3 w-3 text-emerald-400" />
                <span>Dados Demo</span>
              </button>
              <button
                type="button"
                onClick={() => onDataSourceModeChange("WORST_CASE")}
                className={`pressable flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "WORST_CASE"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Stress-Test (break-ui): strings gigantes, dízimas 3x/12x/24x, cota estourada e mês de renda zero"
              >
                <Flame className="h-3 w-3 text-amber-400" />
                <span>Pior Caso</span>
              </button>
              <button
                type="button"
                onClick={() => onDataSourceModeChange("LIVE")}
                className={`pressable flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  dataSourceMode === "LIVE"
                    ? "bg-sky-500/20 text-sky-200 border border-sky-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={
                  isConnectedToSheets
                    ? "Conectado ao Google Sheets Web App"
                    : "GAS_URL não configurado — usará fallback seguro local"
                }
              >
                <Cloud className="h-3 w-3 text-sky-400" />
                <span>Sheets Live</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isConnectedToSheets ? "bg-emerald-400" : "bg-slate-500"
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
                className="pressable inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15 hover:border-emerald-500/40 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-emerald-400 ${
                    isSyncing ? "animate-spin" : ""
                  }`}
                />
                <span>🔄 Sincronizar Tasks</span>
              </button>

              {dataSourceMode !== "LIVE" && (
                <button
                  type="button"
                  onClick={onResetDemo}
                  className="pressable inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#11131A] px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-white/20"
                  title="Restaurar dataset em memória para o estado inicial"
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
