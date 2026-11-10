"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CoupleGovernanceModule } from "@/components/dashboard/CoupleGovernanceModule";
import { DynamicAllocationTable } from "@/components/dashboard/DynamicAllocationTable";
import {
  HeaderControls,
  type DataSourceMode,
} from "@/components/dashboard/HeaderControls";
import { InstallmentsManagerModule } from "@/components/dashboard/InstallmentsManagerModule";
import { InvestmentAssetsManager } from "@/components/dashboard/InvestmentAssetsManager";
import { InvestmentGoalsChart } from "@/components/dashboard/InvestmentGoalsChart";
import { KpiSummaryRow } from "@/components/dashboard/KpiSummaryRow";
import { MacroAllocationChart } from "@/components/dashboard/MacroAllocationChart";
import { QuickEntryBar } from "@/components/dashboard/QuickEntryBar";
import { TransactionLogsModule } from "@/components/dashboard/TransactionLogsModule";
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
          throw new Error("Erro ao consultar dados.");
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
            ativos: data.ativos ?? [],
            recebiveis: data.recebiveis ?? [],
            timestamp: data.timestamp ?? new Date().toISOString(),
            mode: data.mode,
          });
        }
        setIsConnectedToSheets(Boolean(data.isConnectedToSheets));

        if (targetMode === "LIVE" && data.warning) {
          toast.info(data.warning);
        }
      } catch {
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
      toast.warning("Modo de Teste Extremo ativado", {
        description:
          "Exibindo compras longas, parcelamentos longos, mesadas estouradas e mês sem renda.",
      });
    } else if (nextMode === "DEMO") {
      toast.info("Dados de Exemplo ativados", {
        description:
          "Exibindo o planejamento de Giovanni & Maria Luiza com ativos, parcelas e logs.",
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
        throw new Error("Não foi possível sincronizar tarefas.");
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
      loading: "Verificando novos lançamentos...",
      success: (data) =>
        data.syncedTasks && data.syncedTasks > 0
          ? `✅ ${data.syncedTasks} lançamento(s) importado(s)!`
          : data.message ?? "Tudo atualizado!",
      error: (err) =>
        err instanceof Error ? err.message : "Erro ao sincronizar.",
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
        toast.success("Dados restaurados para o estado inicial.");
      }
    } catch {
      toast.error("Não foi possível restaurar os dados.");
    }
  }

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
        {/* Lançamento Rápido */}
        <QuickEntryBar
          yearMonth={yearMonth}
          dataSourceMode={dataSourceMode}
          onTransactionCreated={() => fetchDashboardData(dataSourceMode)}
        />

        {/* 4 Indicadores Principais do Mês */}
        <KpiSummaryRow
          allocation={allocation}
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
        />

        {/* Gráficos Principais: Para Onde Foi a Renda & Nossas Metas */}
        <section
          aria-label="Gráficos do Mês e Metas"
          className="animate-enter delay-2 grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <MacroAllocationChart allocation={allocation} />
          <InvestmentGoalsChart goals={payload.investimentos} />
        </section>

        {/* Gestor Interativo de Ativos de Investimento (Tipo de Ativo, Quanto Rende, Modificar/Adicionar) */}
        <InvestmentAssetsManager
          assets={payload.ativos ?? []}
          goals={payload.investimentos}
          dataSourceMode={dataSourceMode}
          onDataChanged={() => fetchDashboardData(dataSourceMode)}
        />

        {/* Central de Parcelas a Pagar e Valores a Receber */}
        <InstallmentsManagerModule
          transactions={payload.transacoes}
          receivables={payload.recebiveis ?? []}
          yearMonth={yearMonth}
          dataSourceMode={dataSourceMode}
          onDataChanged={() => fetchDashboardData(dataSourceMode)}
        />

        {/* Visualização Completa de Logs (Extrato do que Entrou e Saiu) */}
        <TransactionLogsModule
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
          dataSourceMode={dataSourceMode}
          onDataChanged={() => fetchDashboardData(dataSourceMode)}
        />

        {/* Resumo por Categoria do Mês */}
        <DynamicAllocationTable
          allocation={allocation}
          goals={payload.investimentos}
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
        />

        {/* Mesada Livre Individual & Caixinha de Despesas Anuais */}
        <CoupleGovernanceModule
          settlement={settlement}
          futureInvoices={futureInvoices}
          provisions={payload.provisoes}
        />
      </main>

      <footer className="mt-12 border-t border-rose-500/15 bg-[#120910]/90 py-5 text-xs text-rose-200/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p>
            <strong className="text-rose-100">Ninho</strong> · Planejamento
            Financeiro do Casal (Giovanni & Maria Luiza)
          </p>
          <p className="tabular-nums">
            Simples, acolhedor e atualizado às{" "}
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
