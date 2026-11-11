"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import type { ViewMode } from "@/lib/domain/types";

export type DataSourceMode = "DEMO" | "WORST_CASE" | "LIVE";

export interface MonthOption {
  value: string;
  label: string;
  tag?: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Meses de referência: 12 anteriores e 18 seguintes ao mês atual. */
export function buildAvailableMonths(): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let offset = -12; offset <= 18; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12, 0, 0);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({
      value,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      tag: offset === 0 ? "Mês Atual" : undefined,
    });
  }
  return options;
}

export const AVAILABLE_MONTHS: readonly MonthOption[] = buildAvailableMonths();

interface HeaderControlsProps {
  yearMonth: string;
  onYearMonthChange: (yearMonth: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isConnectedToSheets: boolean;
  isSyncing: boolean;
  onSyncTasks: () => void;
  onOpenSetup: () => void;
}

export function HeaderControls({
  yearMonth,
  onYearMonthChange,
  viewMode,
  onViewModeChange,
  isConnectedToSheets,
  isSyncing,
  onSyncTasks,
  onOpenSetup,
}: HeaderControlsProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("ninho-theme") as
      | "light"
      | "dark"
      | null;
    const initial =
      saved === "dark" || saved === "light"
        ? saved
        : (document.documentElement.getAttribute("data-theme") as
            | "light"
            | "dark") || "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("ninho-theme", next);
  }

  return (
    <header
      className="sticky top-0 z-30 border-b-2 border-[var(--border-strong)] backdrop-blur-md transition-colors"
      style={{
        backgroundColor:
          theme === "dark"
            ? "rgba(22, 11, 18, 0.94)"
            : "rgba(255, 244, 249, 0.94)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: Editorial Neo-Brutalist Brand Identity */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="font-editorial inline-flex items-baseline whitespace-nowrap text-2xl sm:text-[30px] italic tracking-tight text-ink leading-none select-none">
                <span>Ninho</span>
                <span
                  className="ml-0.5 not-italic font-sans font-black"
                  style={{ color: "var(--accent-vivid)" }}
                >
                  .
                </span>
              </h1>

              <span
                className="h-5 w-[2px] shrink-0"
                style={{ backgroundColor: "var(--border-strong)" }}
                aria-hidden="true"
              />

              <div className="flex items-center gap-2 shrink-0">
                <p className="whitespace-nowrap text-xs sm:text-sm font-bold text-ink">
                  Giovanni &amp; Maria Luiza
                </p>
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-[#1F0D18]"
                  style={{
                    backgroundColor: isConnectedToSheets
                      ? "#10B981"
                      : "var(--accent-vivid)",
                  }}
                  title={
                    isConnectedToSheets
                      ? "Conectado à Planilha Google"
                      : "Ambiente local"
                  }
                />
              </div>
            </div>

            {/* Mobile Quick Actions */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={onSyncTasks}
                disabled={isSyncing}
                className="pressable surface-card inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:text-ink disabled:opacity-50"
                title="Sincronizar lançamentos"
                aria-label="Sincronizar lançamentos"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="pressable surface-card inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:text-ink"
                title={
                  theme === "light"
                    ? "Alternar para Modo Noturno Velvet"
                    : "Alternar para Modo Claro Rose-Porcelain"
                }
                aria-label="Alternar tema"
              >
                {theme === "light" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Right: Editorial Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Clean Month Pill Selector */}
            <div className="relative inline-flex items-center surface-card rounded-full px-3 py-1.5 text-xs font-medium text-ink">
              <label htmlFor="month-select" className="sr-only">
                Mês de Referência
              </label>
              <select
                id="month-select"
                value={yearMonth}
                onChange={(e) => onYearMonthChange(e.target.value)}
                className="appearance-none bg-transparent pr-5 text-xs font-semibold text-ink focus:outline-none cursor-pointer tabular-nums"
              >
                {AVAILABLE_MONTHS.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {m.label} {m.tag ? `· ${m.tag}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-muted" />
            </div>

            {/* Compact 2-option Toggle: Fatura do Mês | Data da Compra */}
            <div
              role="group"
              aria-label="Regime de visualização do mês"
              className="surface-subtle inline-flex rounded-full p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("CAIXA")}
                className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "CAIXA"
                    ? "surface-card text-ink font-semibold"
                    : "text-ink-secondary hover:text-ink"
                }`}
                title="Mostra o que vence na fatura ou sai da conta neste mês"
              >
                Fatura do Mês
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("COMPETENCIA")}
                className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "COMPETENCIA"
                    ? "surface-card text-ink font-semibold"
                    : "text-ink-secondary hover:text-ink"
                }`}
                title="Mostra os gastos pela data em que a compra foi realizada"
              >
                Data da Compra
              </button>
            </div>

            {/* Central de Configuração (Onboarding revisitável) */}
            <button
              type="button"
              onClick={onOpenSetup}
              className="pressable inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F0D18] bg-[#FF3B9A] px-3 py-1.5 text-[11px] font-bold text-white shadow-[2px_2px_0px_#1F0D18]"
              title="Configurar cartões, parcelas, ativos, metas e mais"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Configurar</span>
            </button>

            {/* Desktop Icon Controls: Sync, Reset, Theme Toggle */}
            <div className="hidden md:flex items-center gap-1.5">
              <button
                type="button"
                onClick={onSyncTasks}
                disabled={isSyncing}
                className="pressable surface-card inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:text-ink disabled:opacity-50"
                title="Sincronizar lançamentos"
                aria-label="Sincronizar lançamentos"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="pressable surface-card inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary hover:text-ink"
                title={
                  theme === "light"
                    ? "Alternar para Tema Escuro Velvet"
                    : "Alternar para Tema Claro Rose-Porcelain"
                }
                aria-label="Alternar tema Claro Rose ou Escuro Velvet"
              >
                {theme === "light" ? (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#EC4899]" />
                    <span className="hidden xl:inline">Velvet</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5 text-[#FB7185]" />
                    <span className="hidden xl:inline">Rose</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}