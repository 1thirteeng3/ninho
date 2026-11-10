"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CoupleGovernanceModule } from "@/components/dashboard/CoupleGovernanceModule";
import { DynamicAllocationTable } from "@/components/dashboard/DynamicAllocationTable";
import {
  HeaderControls,
  type DataSourceMode,
} from "@/components/dashboard/HeaderControls";
import { InvestmentGoalsChart } from "@/components/dashboard/InvestmentGoalsChart";
import { KpiSummaryRow } from "@/components/dashboard/KpiSummaryRow";
import { MacroAllocationChart } from "@/components/dashboard/MacroAllocationChart";
import { QuickEntryBar } from "@/components/dashboard/QuickEntryBar";
import {
  calculateCoupleSettlement,
  calculateIncomeAllocation,
  projectFutureInvoices,
} from "@/lib/domain/financial-engine";
import type { DashboardPayload, ViewMode } from "@/lib/domain/types";
import {
  getRealisticDemoDataset,
  getWorstCaseDataset,
} from "@/lib/mocks/demo-datasets";

export default function NinhoDashboardPage() {
  const [yearMonth, setYearMonth] = useState<string>("2026-11");
  const [viewMode, setViewMode] = useState<ViewMode>("CAIXA");
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>("DEMO");
  const [isConnectedToSheets, setIsConnectedToSheets] =
    useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Instant initial state with realistic dataset for 0ms first render
  const [payload, setPayload] = useState<DashboardPayload>(() =>
    getRealisticDemoDataset("2026-11")
  );

  const fetchDashboardData = useCallback(
    async (targetMode: DataSourceMode) => {
      try {
        const res = await fetch(`/api/sheets?mode=${targetMode}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Erro ao consultar API de dados.");
        }

        const data = (await res.json()) as DashboardPayload & {
          isConnectedToSheets?: boolean;
          warning?: string;
        };

        if (Array.isArray(data.transacoes)) {
          setPayload({
            transacoes: data.transacoes,
            investimentos: data.investimentos ?? [],
            provisoes: data.provisoes ?? [],
            config: data.config ?? [],
            timestamp: data.timestamp ?? new Date().toISOString(),
            mode: data.mode,
          });
        }
        setIsConnectedToSheets(Boolean(data.isConnectedToSheets));

        if (targetMode === "LIVE" && data.warning) {
          toast.info(data.warning);
        }
      } catch {
        // Fallback local se houver erro de rede
        const fallback =
          targetMode === "WORST_CASE"
            ? getWorstCaseDataset(yearMonth)
            : getRealisticDemoDataset(yearMonth);
        setPayload(fallback);
      }
    },
    [yearMonth]
  );

  useEffect(() => {
    void fetchDashboardData(dataSourceMode);
  }, [dataSourceMode, fetchDashboardData]);

  function handleDataSourceModeChange(nextMode: DataSourceMode) {
    setDataSourceMode(nextMode);
    if (nextMode === "WORST_CASE") {
      toast.warning("Modo Stress-Test (Pior Caso) ativado", {
        description:
          "Exibindo strings sem espaços, dízimas 3x/12x/24x, cotas excedidas e setembro com Renda Zero.",
      });
    } else if (nextMode === "DEMO") {
      toast.info("Modo Demonstração Realista ativado", {
        description:
          "Exibindo dados de Giovanni & Maria Luiza com encontro de contas e metas bifurcadas.",
      });
    }
  }

  function handleSyncTasks() {
    if (isSyncing) return;
    setIsSyncing(true);

    const syncPromise = (async () => {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SYNC_TASKS",
          mode: dataSourceMode,
        }),
      });
      if (!response.ok) {
        throw new Error("Falha ao sincronizar fila do Google Tasks.");
      }
      const data = (await response.json()) as {
        syncedTasks?: number;
        message?: string;
      };
      await fetchDashboardData(dataSourceMode);
      return data;
    })().finally(() => {
      setIsSyncing(false);
    });

    toast.promise(syncPromise, {
      loading: "Consultando fila de lançamentos no Google Tasks...",
      success: (data) =>
        data.syncedTasks && data.syncedTasks > 0
          ? `✅ ${data.syncedTasks} tarefa(s) importada(s) do Google Tasks!`
          : data.message ??
            "Fila do Google Tasks verificada e dashboard sincronizado.",
      error: (err) =>
        err instanceof Error
          ? err.message
          : "Erro ao sincronizar com Google Tasks.",
    });
  }

  async function handleResetDemo() {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO" }),
      });
      if (res.ok) {
        await fetchDashboardData(dataSourceMode);
        toast.success("Dataset restaurado para o estado original.");
      }
    } catch {
      toast.error("Não foi possível restaurar o dataset.");
    }
  }

  // Pure domain computations (O(N), 0ms latency)
  const allocation = useMemo(
    () =>
      calculateIncomeAllocation(payload.transacoes, yearMonth, viewMode),
    [payload.transacoes, yearMonth, viewMode]
  );

  const settlement = useMemo(
    () =>
      calculateCoupleSettlement(
        payload.transacoes,
        payload.config,
        yearMonth,
        viewMode
      ),
    [payload.transacoes, payload.config, yearMonth, viewMode]
  );

  const futureInvoices = useMemo(
    () => projectFutureInvoices(payload.transacoes, yearMonth),
    [payload.transacoes, yearMonth]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderControls
        yearMonth={yearMonth}
        onYearMonthChange={setYearMonth}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        dataSourceMode={dataSourceMode}
        onDataSourceModeChange={handleDataSourceModeChange}
        isConnectedToSheets={isConnectedToSheets}
        isSyncing={isSyncing}
        onSyncTasks={handleSyncTasks}
        onResetDemo={handleResetDemo}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Omnibox Quick Entry Bar (Cmd+K) */}
        <QuickEntryBar
          yearMonth={yearMonth}
          dataSourceMode={dataSourceMode}
          onTransactionCreated={() => fetchDashboardData(dataSourceMode)}
        />

        {/* 4 Main KPI Cards */}
        <KpiSummaryRow
          allocation={allocation}
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
        />

        {/* Module 1 & Module 2: Macro Allocation & Investment Goals Donuts */}
        <section
          aria-label="Gráficos de Alocação e Metas"
          className="animate-enter delay-2 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <MacroAllocationChart allocation={allocation} />
          <InvestmentGoalsChart goals={payload.investimentos} />
        </section>

        {/* Module 3: Dynamic Allocation Table & Auditable Ledger */}
        <DynamicAllocationTable
          allocation={allocation}
          goals={payload.investimentos}
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
        />

        {/* Module 4: Couple Governance (Settlement L_u,m, Future Invoices & Sinking Funds) */}
        <CoupleGovernanceModule
          settlement={settlement}
          futureInvoices={futureInvoices}
          provisions={payload.provisoes}
        />
      </main>

      <footer className="mt-12 border-t border-white/[0.06] bg-[#090A0F]/80 py-5 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p>
            <strong className="text-slate-300">Ninho</strong> · Arquitetura de
            Governança e Inteligência Financeira Conjugal (Giovanni & Maria
            Luiza)
          </p>
          <p className="tabular-nums">
            Neutralidade Descritiva · Precisão ao Centavo · Atualizado em{" "}
            {new Date(payload.timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </footer>
    </div>
  );
}
