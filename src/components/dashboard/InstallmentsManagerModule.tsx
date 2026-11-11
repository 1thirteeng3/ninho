"use client";

import React, { useMemo, useState } from "react";
import { Check, CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  projectFutureInvoices,
  roundCurrency,
} from "@/lib/domain/financial-engine";
import {
  CategorySchema,
  type Category,
  type Member,
  type ReceivablePlan,
  type Transaction,
} from "@/lib/domain/types";
import {
  formatBRL,
  formatShortDate,
  formatYearMonthLabel,
} from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

const PURCHASE_CATEGORIES: readonly Category[] = [
  "Habitação & Fixos",
  "Carro",
  "Saúde",
  "Estudos (Custeio)",
  "Lazer",
  "Cota Individual",
];

interface InstallmentsManagerModuleProps {
  transactions: Transaction[];
  receivables: ReceivablePlan[];
  yearMonth: string;
  dataSourceMode: DataSourceMode;
  onDataChanged: () => Promise<void> | void;
}

interface GroupedPayablePlan {
  planKey: string;
  title: string;
  categoria: Category;
  conta: string;
  pago_por: Member;
  totalParcelas: number;
  paidCount: number;
  remainingCount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  unitAmount: number;
  nextDueDate: string | null;
  installments: Transaction[];
}

export function InstallmentsManagerModule({
  transactions,
  receivables,
  yearMonth,
  dataSourceMode,
  onDataChanged,
}: InstallmentsManagerModuleProps) {
  const [activeTab, setActiveTab] = useState<"PAYABLES" | "RECEIVABLES">(
    "PAYABLES"
  );

  // New Payable Purchase Form
  const [isNewPayableOpen, setIsNewPayableOpen] = useState(false);
  const [payableDesc, setPayableDesc] = useState("");
  const [payableTotal, setPayableTotal] = useState("");
  const [payableCount, setPayableCount] = useState("3");
  const [payableAccount, setPayableAccount] = useState("Nubank Conjunta");
  const [payableCategory, setPayableCategory] =
    useState<Category>("Habitação & Fixos");
  const [payableMember, setPayableMember] = useState<Member>("Giovanni");
  const [isSavingPayable, setIsSavingPayable] = useState(false);

  // New Receivable Form
  const [isNewReceivableOpen, setIsNewReceivableOpen] = useState(false);
  const [recDesc, setRecDesc] = useState("");
  const [recPayer, setRecPayer] = useState("");
  const [recTotal, setRecTotal] = useState("");
  const [recCount, setRecCount] = useState("2");
  const [recDate, setRecDate] = useState(`${yearMonth.slice(0, 7)}-20`);
  const [recAccount, setRecAccount] = useState("Nubank Conjunta");
  const [recReceiver, setRecReceiver] = useState<
    "Casal" | "Giovanni" | "Maria Luiza"
  >("Casal");
  const [isSavingReceivable, setIsSavingReceivable] = useState(false);

  const payablePlans = useMemo<GroupedPayablePlan[]>(() => {
    const map = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      if (tx.tipo_fluxo !== "CUSTO" || tx.total_parcelas <= 1) {
        continue;
      }
      const key =
        tx.id_plano_parcelas.trim() ||
        `${tx.descricao.replace(/\s*\(\d+\/\d+\).*$/, "")}_${tx.data_competencia}`;
      const list = map.get(key) ?? [];
      list.push(tx);
      map.set(key, list);
    }

    const ymPrefix = yearMonth.trim().slice(0, 7);
    const result: GroupedPayablePlan[] = [];

    for (const [planKey, list] of map.entries()) {
      const sorted = [...list].sort(
        (a, b) => a.parcela_atual - b.parcela_atual
      );
      const first = sorted[0];
      if (!first) continue;

      const cleanTitle = first.descricao
        .replace(/\s*\(\d+\/\d+\).*$/, "")
        .trim();

      const totalParcelas = first.total_parcelas;
      const paidTxs = sorted.filter((t) => t.data_caixa.slice(0, 7) <= ymPrefix);
      const futureTxs = sorted.filter(
        (t) => t.data_caixa.slice(0, 7) > ymPrefix
      );

      const totalAmount = roundCurrency(
        sorted.reduce((acc, t) => acc + Math.abs(t.valor), 0)
      );
      const paidAmount = roundCurrency(
        paidTxs.reduce((acc, t) => acc + Math.abs(t.valor), 0)
      );
      const remainingAmount = roundCurrency(
        futureTxs.reduce((acc, t) => acc + Math.abs(t.valor), 0)
      );
      const unitAmount = roundCurrency(
        Math.abs(first.valor) || totalAmount / Math.max(1, totalParcelas)
      );

      result.push({
        planKey,
        title: cleanTitle,
        categoria: first.categoria,
        conta: first.conta,
        pago_por: first.pago_por,
        totalParcelas,
        paidCount: paidTxs.length,
        remainingCount: futureTxs.length,
        totalAmount,
        paidAmount,
        remainingAmount,
        unitAmount,
        nextDueDate: futureTxs[0]?.data_caixa ?? null,
        installments: sorted,
      });
    }

    return result.sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [transactions, yearMonth]);

  const futureInvoices = useMemo(
    () => projectFutureInvoices(transactions, yearMonth),
    [transactions, yearMonth]
  );

  const payableSummary = useMemo(() => {
    const totalRemaining = roundCurrency(
      payablePlans.reduce((acc, p) => acc + p.remainingAmount, 0)
    );
    const totalPaid = roundCurrency(
      payablePlans.reduce((acc, p) => acc + p.paidAmount, 0)
    );
    return { totalRemaining, totalPaid };
  }, [payablePlans]);

  const receivableSummary = useMemo(() => {
    let totalExpected = 0;
    let totalReceived = 0;
    let totalPending = 0;

    for (const r of receivables) {
      const unit = r.valor_total / Math.max(1, r.total_parcelas);
      const receivedVal = roundCurrency(unit * r.parcelas_recebidas);
      const pendingVal = roundCurrency(Math.max(0, r.valor_total - receivedVal));
      totalExpected = roundCurrency(totalExpected + r.valor_total);
      totalReceived = roundCurrency(totalReceived + receivedVal);
      totalPending = roundCurrency(totalPending + pendingVal);
    }

    return { totalExpected, totalReceived, totalPending };
  }, [receivables]);

  async function handleCreatePayable(e: React.FormEvent) {
    e.preventDefault();
    const desc = payableDesc.trim();
    const val = Number(payableTotal.replace(",", "."));
    const count = Math.max(2, Math.min(120, parseInt(payableCount, 10) || 2));

    if (!desc) {
      toast.error("Informe a descrição da compra parcelada.");
      return;
    }
    if (!Number.isFinite(val) || val <= 0) {
      toast.error("Informe o valor total da compra.");
      return;
    }

    setIsSavingPayable(true);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_competencia: `${yearMonth.slice(0, 7)}-10`,
          tipo_fluxo: "CUSTO",
          categoria: CategorySchema.parse(payableCategory),
          descricao: desc,
          valor: -Math.abs(roundCurrency(val)),
          conta: payableAccount.trim() || "Nubank Conjunta",
          pago_por: payableMember,
          escopo: "CONJUNTO",
          total_parcelas: count,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível cadastrar a compra parcelada.");
      }

      toast.success(
        `Compra parcelada cadastrada: ${desc} em ${count}x de ${formatBRL(
          roundCurrency(val / count)
        )}`
      );
      setPayableDesc("");
      setPayableTotal("");
      setIsNewPayableOpen(false);
      await onDataChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar compra parcelada."
      );
    } finally {
      setIsSavingPayable(false);
    }
  }

  async function handleAdvancePayableInstallment(planKey: string, title: string) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAY_NEXT_INSTALLMENT",
          planIdOrTxId: planKey,
          yearMonth,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível antecipar a parcela.");
      }

      toast.success(`Parcela antecipada no mês: ${title}`);
      await onDataChanged();
    } catch {
      toast.error("Erro ao dar baixa na parcela.");
    }
  }

  async function handleCreateReceivable(e: React.FormEvent) {
    e.preventDefault();
    const desc = recDesc.trim();
    const payer = recPayer.trim();
    const total = Number(recTotal.replace(",", "."));
    const count = Math.max(1, Math.min(60, parseInt(recCount, 10) || 1));

    if (!desc) {
      toast.error("Informe o que você tem a receber.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Informe um valor total válido.");
      return;
    }

    setIsSavingReceivable(true);
    try {
      const newRec: ReceivablePlan = {
        id: `rec_${Date.now()}`,
        descricao: desc,
        pagador_origem: payer || "Terceiro",
        recebedor: recReceiver,
        valor_total: roundCurrency(total),
        total_parcelas: count,
        parcelas_recebidas: 0,
        proximo_vencimento: recDate || `${yearMonth.slice(0, 7)}-20`,
        conta_destino: recAccount.trim() || "Nubank Conjunta",
        status: "EM_ANDAMENTO",
      };

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_RECEIVABLE",
          receivable: newRec,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível cadastrar o valor a receber.");
      }

      toast.success(
        `Valor a receber cadastrado: ${desc} (${count}x de ${formatBRL(
          roundCurrency(total / count)
        )})`
      );
      setRecDesc("");
      setRecPayer("");
      setRecTotal("");
      setIsNewReceivableOpen(false);
      await onDataChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao cadastrar recebível."
      );
    } finally {
      setIsSavingReceivable(false);
    }
  }

  async function handleReceiveInstallment(rec: ReceivablePlan) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECEIVE_INSTALLMENT",
          id: rec.id,
          yearMonth,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível registrar o recebimento.");
      }

      const unitVal = roundCurrency(
        rec.valor_total / Math.max(1, rec.total_parcelas)
      );

      toast.success(
        `Parcela recebida! +${formatBRL(unitVal)} adicionado nas Entradas do mês`,
        {
          description: `${rec.descricao} • Pagador: ${rec.pagador_origem}`,
        }
      );
      await onDataChanged();
    } catch {
      toast.error("Erro ao registrar recebimento da parcela.");
    }
  }

  async function handleDeleteReceivable(rec: ReceivablePlan) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_RECEIVABLE",
          id: rec.id,
          mode: dataSourceMode,
        }),
      });

      if (res.ok) {
        toast.success(`Removido da lista: ${rec.descricao}`);
        await onDataChanged();
      }
    } catch {
      toast.error("Erro ao remover item.");
    }
  }

  return (
    <section
      aria-label="Central de Parcelas a Pagar e a Receber"
      className="animate-enter delay-2 surface-card rounded-2xl overflow-hidden"
    >
      {/* Editorial Header + Clean Segmented Tabs */}
      <div className="flex flex-col gap-3 border-b border-hairline px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-editorial text-xl italic tracking-tight text-ink">
            Central de Parcelas &amp; Valores a Receber
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Compras parceladas nos cartões, cronograma de faturas e recebíveis do casal
          </p>
        </div>

        {/* Clean Pill Switcher */}
        <div className="surface-subtle inline-flex rounded-full p-0.5 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("PAYABLES")}
            className={`pressable rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === "PAYABLES"
                ? "surface-card text-ink font-semibold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Parcelas a Pagar ({payablePlans.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECEIVABLES")}
            className={`pressable rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === "RECEIVABLES"
                ? "surface-card text-ink font-semibold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Valores a Receber ({receivables.length})
          </button>
        </div>
      </div>

      {/* TAB 1: PARCELAS A PAGAR */}
      {activeTab === "PAYABLES" ? (
        <div className="p-6 space-y-6">
          {/* Summary Strip + Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div className="flex flex-wrap items-center gap-6 text-xs tabular-nums">
              <div>
                <span className="text-ink-secondary">Já quitado: </span>
                <strong className="font-semibold text-[#0F766E] dark:text-emerald-400">
                  {formatBRL(payableSummary.totalPaid)}
                </strong>
              </div>
              <div>
                <span className="text-ink-secondary">
                  Saldo nas próximas faturas:{" "}
                </span>
                <strong className="font-semibold text-ink">
                  {formatBRL(payableSummary.totalRemaining)}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNewPayableOpen((prev) => !prev)}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#EC4899] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova Compra Parcelada</span>
            </button>
          </div>

          {/* Inline Form: Nova Compra Parcelada */}
          {isNewPayableOpen && (
            <form
              onSubmit={handleCreatePayable}
              className="surface-subtle rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">
                  Registrar Nova Compra Parcelada
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewPayableOpen(false)}
                  className="pressable rounded-lg p-1 text-ink-muted hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    O que foi comprado?
                  </label>
                  <input
                    type="text"
                    required
                    value={payableDesc}
                    onChange={(e) => setPayableDesc(e.target.value)}
                    placeholder="Ex: Geladeira Inox, Passagens Aéreas..."
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#EC4899] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={payableTotal}
                    onChange={(e) => setPayableTotal(e.target.value)}
                    placeholder="Ex: 1800"
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#EC4899] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Parcelas
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="48"
                    required
                    value={payableCount}
                    onChange={(e) => setPayableCount(e.target.value)}
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#EC4899] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Categoria
                  </label>
                  <select
                    value={payableCategory}
                    onChange={(e) =>
                      setPayableCategory(e.target.value as Category)
                    }
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
                  >
                    {PURCHASE_CATEGORIES.map((c) => (
                      <option
                        key={c}
                        value={c}
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Cartão &amp; Autor
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={payableAccount}
                      onChange={(e) => setPayableAccount(e.target.value)}
                      placeholder="Nubank"
                      className="surface-card w-1/2 rounded-xl px-2.5 py-2 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
                    />
                    <select
                      value={payableMember}
                      onChange={(e) =>
                        setPayableMember(e.target.value as Member)
                      }
                      className="surface-card w-1/2 rounded-xl px-2 py-2 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
                    >
                      <option value="Giovanni">Giovanni</option>
                      <option value="Maria Luiza">Maria Luiza</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewPayableOpen(false)}
                  className="pressable surface-card rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayable}
                  className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#EC4899] px-4 py-1.5 text-xs font-semibold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {isSavingPayable ? "Salvando..." : "Parcelar Compra"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Payable Installment Cards */}
          {payablePlans.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              Nenhuma compra parcelada encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {payablePlans.map((plan) => {
                const progressPct = Math.min(
                  100,
                  Math.max(
                    0,
                    roundCurrency((plan.paidCount / plan.totalParcelas) * 100)
                  )
                );
                const isDone = plan.remainingCount === 0;

                return (
                  <article
                    key={plan.planKey}
                    className="flex flex-col justify-between rounded-xl border border-hairline bg-[var(--bg-subtle)]/25 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-ink-secondary">
                          {plan.categoria} · {plan.conta}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            isDone
                              ? "bg-teal-500/10 text-[#0F766E] dark:text-emerald-300"
                              : "surface-rose-tint text-[#EC4899] dark:text-[#FB7185]"
                          }`}
                        >
                          {plan.paidCount} de {plan.totalParcelas} pagas
                        </span>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-ink">
                          {plan.title}
                        </h3>
                        <span className="text-xs font-semibold text-ink tabular-nums shrink-0">
                          {formatBRL(plan.unitAmount)}/mês
                        </span>
                      </div>

                      {/* Thin Progress Bar (h-1.5) */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                        <div
                          className="h-full rounded-full bg-[#EC4899] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs tabular-nums">
                      <div className="space-x-3 text-ink-secondary">
                        <span>
                          Total:{" "}
                          <strong className="font-semibold text-ink">
                            {formatBRL(plan.totalAmount)}
                          </strong>
                        </span>
                        <span>
                          Restante:{" "}
                          <strong className="font-semibold text-[#EC4899] dark:text-rose-400">
                            {formatBRL(plan.remainingAmount)}
                          </strong>
                        </span>
                      </div>

                      {!isDone && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdvancePayableInstallment(
                              plan.planKey,
                              plan.title
                            )
                          }
                          className="pressable surface-card inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-ink hover:border-[#EC4899] hover:text-[#EC4899]"
                          title="Adiantar a próxima parcela para a fatura atual"
                        >
                          <CheckCircle2 className="h-3 w-3 text-[#EC4899]" />
                          <span>Adiantar parcela</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Monthly Future Invoices Strip */}
          {futureInvoices.length > 0 && (
            <div className="border-t border-hairline pt-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary mb-3">
                Projeção das Próximas Faturas
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                {futureInvoices.slice(0, 4).map((proj) => (
                  <div
                    key={proj.yearMonth}
                    className="rounded-xl border border-hairline bg-[var(--bg-subtle)]/25 p-3.5 text-xs tabular-nums"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        {formatYearMonthLabel(proj.yearMonth)}
                      </span>
                      <span className="text-[11px] text-ink-muted">
                        {proj.installments.length} parc.
                      </span>
                    </div>
                    <p className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-[#EC4899] dark:text-rose-400">
                      {formatBRL(proj.totalCommitted)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: VALORES E PARCELAS A RECEBER */
        <div className="p-6 space-y-6">
          {/* Summary Bar + Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div className="flex flex-wrap items-center gap-6 text-xs tabular-nums">
              <div>
                <span className="text-ink-secondary">Já recebido: </span>
                <strong className="font-semibold text-[#0F766E] dark:text-emerald-400">
                  {formatBRL(receivableSummary.totalReceived)}
                </strong>
              </div>
              <div>
                <span className="text-ink-secondary">A receber: </span>
                <strong className="font-semibold text-ink">
                  {formatBRL(receivableSummary.totalPending)}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNewReceivableOpen((prev) => !prev)}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Valor a Receber</span>
            </button>
          </div>

          {/* Inline Form: Novo Valor a Receber */}
          {isNewReceivableOpen && (
            <form
              onSubmit={handleCreateReceivable}
              className="surface-subtle rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">
                  Cadastrar Valor ou Parcelas a Receber
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewReceivableOpen(false)}
                  className="pressable rounded-lg p-1 text-ink-muted hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    required
                    value={recDesc}
                    onChange={(e) => setRecDesc(e.target.value)}
                    placeholder="Ex: Venda do Notebook, Reembolso Médico..."
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Pagador
                  </label>
                  <input
                    type="text"
                    required
                    value={recPayer}
                    onChange={(e) => setRecPayer(e.target.value)}
                    placeholder="Ex: Amigo Lucas, Convênio..."
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={recTotal}
                    onChange={(e) => setRecTotal(e.target.value)}
                    placeholder="Ex: 1500"
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#0F766E] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    required
                    value={recCount}
                    onChange={(e) => setRecCount(e.target.value)}
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#0F766E] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Próximo Vencimento
                  </label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="surface-card w-full rounded-xl px-2.5 py-2 text-xs text-ink focus:border-[#0F766E] focus:outline-none tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Conta Destino
                  </label>
                  <input
                    type="text"
                    value={recAccount}
                    onChange={(e) => setRecAccount(e.target.value)}
                    placeholder="Ex: Nubank Conjunta, Itaú Conjunta..."
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#0F766E] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                    Titular Recebedor
                  </label>
                  <select
                    value={recReceiver}
                    onChange={(e) =>
                      setRecReceiver(
                        e.target.value as "Casal" | "Giovanni" | "Maria Luiza"
                      )
                    }
                    className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#0F766E] focus:outline-none"
                  >
                    <option value="Casal">Casal (Conta Conjunta)</option>
                    <option value="Giovanni">Giovanni</option>
                    <option value="Maria Luiza">Maria Luiza</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewReceivableOpen(false)}
                  className="pressable surface-card rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingReceivable}
                  className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {isSavingReceivable
                      ? "Salvando..."
                      : "Salvar Valor a Receber"}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Receivables List */}
          {receivables.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              Nenhum valor a receber cadastrado no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {receivables.map((rec) => {
                const unitVal = roundCurrency(
                  rec.valor_total / Math.max(1, rec.total_parcelas)
                );
                const receivedVal = roundCurrency(
                  unitVal * rec.parcelas_recebidas
                );
                const pendingVal = roundCurrency(
                  Math.max(0, rec.valor_total - receivedVal)
                );
                const pct = Math.min(
                  100,
                  Math.max(
                    0,
                    roundCurrency(
                      (rec.parcelas_recebidas /
                        Math.max(1, rec.total_parcelas)) *
                        100
                    )
                  )
                );
                const isCompleted =
                  rec.status === "CONCLUIDO" ||
                  rec.parcelas_recebidas >= rec.total_parcelas;

                return (
                  <article
                    key={rec.id}
                    className="flex flex-col justify-between rounded-xl border border-hairline bg-[var(--bg-subtle)]/25 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-ink-secondary">
                          {rec.pagador_origem} · {rec.conta_destino}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                            isCompleted
                              ? "bg-teal-500/10 text-[#0F766E] dark:text-emerald-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {rec.parcelas_recebidas} de {rec.total_parcelas}{" "}
                          recebidas
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-ink">
                        {rec.descricao}
                      </h3>

                      <p className="mt-1 text-xs text-ink-secondary tabular-nums">
                        Parcela:{" "}
                        <strong className="font-semibold text-ink">
                          {formatBRL(unitVal)}
                        </strong>{" "}
                        · Próx. vencimento:{" "}
                        {formatShortDate(rec.proximo_vencimento)}
                      </p>

                      {/* Thin Progress bar (h-1.5) */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                        <div
                          className="h-full rounded-full bg-[#0F766E] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 border-t border-hairline pt-3">
                      <div className="flex items-center justify-between text-xs tabular-nums mb-3">
                        <span className="text-ink-secondary">
                          Total:{" "}
                          <strong className="font-semibold text-ink">
                            {formatBRL(rec.valor_total)}
                          </strong>
                        </span>
                        <span className="text-ink-secondary">
                          Pendente:{" "}
                          <strong className="font-semibold text-[#0F766E] dark:text-emerald-400">
                            {formatBRL(pendingVal)}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {!isCompleted ? (
                          <button
                            type="button"
                            onClick={() => handleReceiveInstallment(rec)}
                            className="pressable flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-95"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Receber parcela ({formatBRL(unitVal)})</span>
                          </button>
                        ) : (
                          <span className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-[#0F766E] dark:text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                            Concluído
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteReceivable(rec)}
                          className="pressable rounded-lg p-1.5 text-ink-muted hover:bg-rose-500/10 hover:text-[#EC4899]"
                          title="Excluir registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
