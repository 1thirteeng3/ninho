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
  filterTransactionsByMonth,
  projectFutureInvoices,
} from "@/lib/domain/financial-engine";
import type { DashboardPayload, ViewMode } from "@/lib/domain/types";
import {
  getRealisticDemoDataset,
  getWorstCaseDataset,
} from "@/lib/mocks/demo-datasets";

export type WorkspaceTab =
  | "OVERVIEW"
  | "LOGS"
  | "INVESTMENTS"
  | "INSTALLMENTS"
  | "GOVERNANCE"
  | "ALL";

export default function NinhoDashboardPage() {
  const [yearMonth, setYearMonth] = useState<string>("2026-11");
  const [viewMode, setViewMode] = useState<ViewMode>("CAIXA");
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>("DEMO");
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("OVERVIEW");
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
          ? `${data.syncedTasks} lançamento(s) importado(s)!`
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

  const monthLogsCount = useMemo(
    () =>
      filterTransactionsByMonth(payload.transacoes, yearMonth, viewMode).length,
    [payload.transacoes, yearMonth, viewMode]
  );

  const pendingInstallmentsCount = useMemo(() => {
    const ymPrefix = yearMonth.trim().slice(0, 7);
    const activePayablePlans = new Set(
      payload.transacoes
        .filter(
          (t) =>
            t.tipo_fluxo === "CUSTO" &&
            t.total_parcelas > 1 &&
            t.data_caixa.slice(0, 7) > ymPrefix
        )
        .map(
          (t) =>
            t.id_plano_parcelas.trim() ||
            `${t.descricao.replace(/\s*\(\d+\/\d+\).*$/, "")}_${t.data_competencia}`
        )
    );
    const activeReceivables = (payload.recebiveis ?? []).filter(
      (r) => r.status !== "CONCLUIDO" && r.parcelas_recebidas < r.total_parcelas
    ).length;

    return activePayablePlans.size + activeReceivables;
  }, [payload.transacoes, payload.recebiveis, yearMonth]);

  const workspaceTabs: readonly {
    id: WorkspaceTab;
    label: string;
    badge?: number;
  }[] = [
    { id: "OVERVIEW", label: "Visão Geral" },
    { id: "LOGS", label: "Extrato & Logs", badge: monthLogsCount },
    {
      id: "INVESTMENTS",
      label: "Investimentos & Ativos",
      badge: (payload.ativos ?? []).length,
    },
    {
      id: "INSTALLMENTS",
      label: "Parcelas & A Receber",
      badge: pendingInstallmentsCount,
    },
    { id: "GOVERNANCE", label: "Mesada & Reserva Anual" },
    { id: "ALL", label: "Ver Tudo" },
  ];

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
        {/* Omnibox Lançamento Rápido */}
        <QuickEntryBar
          yearMonth={yearMonth}
          dataSourceMode={dataSourceMode}
          onTransactionCreated={() => fetchDashboardData(dataSourceMode)}
        />

        {/* Hero Editorial de Balanço Mensal */}
        <KpiSummaryRow
          allocation={allocation}
          transactions={payload.transacoes}
          yearMonth={yearMonth}
          viewMode={viewMode}
        />

        {/* Navegação Editorial por Abas de Contexto */}
        <nav
          aria-label="Navegação por contexto financeiro"
          className="flex items-center gap-1.5 overflow-x-auto border-b border-hairline pb-3"
        >
          {workspaceTabs.map((tab) => {
            const isActive = activeWorkspaceTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveWorkspaceTab(tab.id)}
                className={`pressable inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#BE123C] text-white font-semibold shadow-2xs"
                    : "surface-card text-ink-secondary hover:text-ink"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[var(--bg-subtle)] text-ink-secondary"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: VISÃO GERAL */}
        {activeWorkspaceTab === "OVERVIEW" && (
          <div className="space-y-6">
            <section
              aria-label="Gráficos do Mês e Metas"
              className="animate-enter delay-1 grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <MacroAllocationChart allocation={allocation} />
              <InvestmentGoalsChart goals={payload.investimentos} />
            </section>

            <DynamicAllocationTable
              allocation={allocation}
              goals={payload.investimentos}
              transactions={payload.transacoes}
              yearMonth={yearMonth}
              viewMode={viewMode}
            />

            <CoupleGovernanceModule
              settlement={settlement}
              futureInvoices={futureInvoices}
              provisions={payload.provisoes}
            />
          </div>
        )}

        {/* TAB 2: EXTRATO & LOGS */}
        {activeWorkspaceTab === "LOGS" && (
          <TransactionLogsModule
            transactions={payload.transacoes}
            yearMonth={yearMonth}
            viewMode={viewMode}
            dataSourceMode={dataSourceMode}
            onDataChanged={() => fetchDashboardData(dataSourceMode)}
          />
        )}

        {/* TAB 3: INVESTIMENTOS & ATIVOS */}
        {activeWorkspaceTab === "INVESTMENTS" && (
          <div className="space-y-6">
            <InvestmentGoalsChart goals={payload.investimentos} />
            <InvestmentAssetsManager
              assets={payload.ativos ?? []}
              goals={payload.investimentos}
              dataSourceMode={dataSourceMode}
              onDataChanged={() => fetchDashboardData(dataSourceMode)}
            />
          </div>
        )}

        {/* TAB 4: PARCELAS & A RECEBER */}
        {activeWorkspaceTab === "INSTALLMENTS" && (
          <InstallmentsManagerModule
            transactions={payload.transacoes}
            receivables={payload.recebiveis ?? []}
            yearMonth={yearMonth}
            dataSourceMode={dataSourceMode}
            onDataChanged={() => fetchDashboardData(dataSourceMode)}
          />
        )}

        {/* TAB 5: MESADA & RESERVA ANUAL */}
        {activeWorkspaceTab === "GOVERNANCE" && (
          <CoupleGovernanceModule
            settlement={settlement}
            futureInvoices={futureInvoices}
            provisions={payload.provisoes}
          />
        )}

        {/* TAB 6: VER TUDO */}
        {activeWorkspaceTab === "ALL" && (
          <div className="space-y-6">
            <section
              aria-label="Gráficos do Mês e Metas"
              className="animate-enter delay-1 grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <MacroAllocationChart allocation={allocation} />
              <InvestmentGoalsChart goals={payload.investimentos} />
            </section>

            <DynamicAllocationTable
              allocation={allocation}
              goals={payload.investimentos}
              transactions={payload.transacoes}
              yearMonth={yearMonth}
              viewMode={viewMode}
            />

            <InvestmentAssetsManager
              assets={payload.ativos ?? []}
              goals={payload.investimentos}
              dataSourceMode={dataSourceMode}
              onDataChanged={() => fetchDashboardData(dataSourceMode)}
            />

            <InstallmentsManagerModule
              transactions={payload.transacoes}
              receivables={payload.recebiveis ?? []}
              yearMonth={yearMonth}
              dataSourceMode={dataSourceMode}
              onDataChanged={() => fetchDashboardData(dataSourceMode)}
            />

            <TransactionLogsModule
              transactions={payload.transacoes}
              yearMonth={yearMonth}
              viewMode={viewMode}
              dataSourceMode={dataSourceMode}
              onDataChanged={() => fetchDashboardData(dataSourceMode)}
            />

            <CoupleGovernanceModule
              settlement={settlement}
              futureInvoices={futureInvoices}
              provisions={payload.provisoes}
            />
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-hairline py-6 text-xs text-ink-muted">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p>
            <strong className="font-editorial text-sm italic text-ink">
              Ninho.
            </strong>{" "}
            Planejamento Financeiro Editorial (Giovanni &amp; Maria Luiza)
          </p>
          <p className="tabular-nums">
            Atualizado às{" "}
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
