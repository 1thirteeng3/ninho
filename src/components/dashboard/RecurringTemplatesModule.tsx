"use client";

import React, { useMemo, useState } from "react";
import { CalendarCheck2, Plus, Repeat, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  filterTransactionsByMonth,
  roundCurrency,
} from "@/lib/domain/financial-engine";
import {
  CategorySchema,
  type Category,
  type FlowType,
  type Member,
  type RecurringTemplate,
  type Scope,
  type Transaction,
} from "@/lib/domain/types";
import { formatBRL, formatYearMonthLabel } from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

interface RecurringTemplatesModuleProps {
  templates: RecurringTemplate[];
  transactions: Transaction[];
  yearMonth: string;
  dataSourceMode: DataSourceMode;
  onDataChanged: () => Promise<void> | void;
}

export function RecurringTemplatesModule({
  templates,
  transactions,
  yearMonth,
  dataSourceMode,
  onDataChanged,
}: RecurringTemplatesModuleProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [flow, setFlow] = useState<FlowType>("CUSTO");
  const [cat, setCat] = useState<Category>("Habitação & Fixos");
  const [conta, setConta] = useState("Conta Conjunta");
  const [paidBy, setPaidBy] = useState<Member>("Giovanni");
  const [scope, setScope] = useState<Scope>("CONJUNTO");
  const [day, setDay] = useState("10");
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const monthTxs = useMemo(
    () => filterTransactionsByMonth(transactions, yearMonth, "COMPETENCIA"),
    [transactions, yearMonth]
  );

  const pendingTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const targetDesc = tpl.descricao.trim().toLowerCase();
      return !monthTxs.some(
        (tx) =>
          tx.descricao.trim().toLowerCase() === targetDesc &&
          Math.abs(Math.abs(tx.valor) - Math.abs(tpl.valor)) < 0.01
      );
    });
  }, [templates, monthTxs]);

  async function handleAddTemplate(e: React.FormEvent) {
    e.preventDefault();
    const numVal = Number(valor.replace(",", "."));
    if (!desc.trim() || !Number.isFinite(numVal) || numVal <= 0) {
      toast.error("Informe descrição e valor válidos.");
      return;
    }
    setIsSaving(true);
    try {
      const recurring: RecurringTemplate = {
        id: `rec_${Date.now()}`,
        descricao: desc.trim(),
        tipo_fluxo: flow,
        categoria: cat,
        valor: roundCurrency(numVal),
        conta: conta.trim() || "Conta Conjunta",
        pago_por: paidBy,
        escopo: scope,
        dia_vencimento: Math.min(31, Math.max(1, parseInt(day, 10) || 10)),
      };
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_RECURRING",
          recurring,
          mode: dataSourceMode,
        }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar o item fixo.");
      toast.success(`Fixo cadastrado: ${recurring.descricao}`);
      setDesc("");
      setValor("");
      setIsFormOpen(false);
      await onDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar fixo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_RECURRING",
          id,
          mode: dataSourceMode,
        }),
      });
      if (!res.ok) throw new Error("Não foi possível remover o item fixo.");
      toast.success("Item fixo removido.");
      await onDataChanged();
    } catch {
      toast.error("Erro ao remover item fixo.");
    }
  }

  async function handleApplyMonth() {
    if (pendingTemplates.length === 0 || isApplying) return;
    setIsApplying(true);
    try {
      const [yStr, mStr] = yearMonth.slice(0, 7).split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const lastDay = new Date(y, m, 0).getDate();

      let applied = 0;
      for (const tpl of pendingTemplates) {
        const dd = String(Math.min(tpl.dia_vencimento, lastDay)).padStart(2, "0");
        const dateISO = `${yStr}-${mStr}-${dd}`;
        const signedVal =
          tpl.tipo_fluxo === "CUSTO" || tpl.tipo_fluxo === "PROVISAO_ANUAL"
            ? -Math.abs(tpl.valor)
            : Math.abs(tpl.valor);

        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data_competencia: dateISO,
            tipo_fluxo: tpl.tipo_fluxo,
            categoria: tpl.categoria,
            descricao: tpl.descricao,
            valor: signedVal,
            conta: tpl.conta,
            pago_por: tpl.pago_por,
            escopo: tpl.escopo,
            total_parcelas: 1,
            mode: dataSourceMode,
          }),
        });
        if (!res.ok) {
          throw new Error(`Falha ao aplicar "${tpl.descricao}".`);
        }
        applied++;
      }

      toast.success(
        `${applied} lançamento(s) fixo(s) aplicado(s) em ${formatYearMonthLabel(yearMonth)}!`
      );
      await onDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar fixos.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <section
      aria-label="Fixos e Recorrentes do Mês"
      className="animate-enter delay-2 surface-card rounded-2xl overflow-hidden"
    >
      <div className="flex flex-col gap-3 border-b border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-editorial text-xl italic tracking-tight text-ink flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[#EC4899]" />
            <span>Fixos &amp; Recorrentes Mensais</span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Salários e contas fixas (aluguel, internet, condomínio) para lançar em 1 clique todo mês
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && (
            <button
              type="button"
              disabled={pendingTemplates.length === 0 || isApplying}
              onClick={handleApplyMonth}
              className="pressable inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F0D18] bg-[#10B981] px-4 py-1.5 text-xs font-bold text-[#064E3B] shadow-[2px_2px_0px_#1F0D18] disabled:opacity-45"
            >
              <CalendarCheck2 className="h-3.5 w-3.5" />
              <span>
                {isApplying
                  ? "Aplicando..."
                  : pendingTemplates.length === 0
                    ? `Tudo lançado em ${formatYearMonthLabel(yearMonth)}`
                    : `Aplicar ${pendingTemplates.length} fixo(s) em ${formatYearMonthLabel(yearMonth)}`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFormOpen((prev) => !prev)}
            className="pressable inline-flex items-center gap-1 rounded-full bg-[#EC4899] px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            {isFormOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{isFormOpen ? "Fechar" : "Novo Fixo"}</span>
          </button>
        </div>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleAddTemplate}
          className="border-b border-hairline bg-[var(--bg-rose-tint)]/60 p-5 text-xs"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Descrição
              </label>
              <input
                type="text"
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ex: Aluguel, Salário, Internet"
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: 1800"
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink tabular-nums focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Tipo
              </label>
              <select
                value={flow}
                onChange={(e) => {
                  const next = e.target.value as FlowType;
                  setFlow(next);
                  if (next === "RENDA") setCat("Salário / Renda");
                  else if (next === "CUSTO") setCat("Habitação & Fixos");
                  else if (next === "INVESTIMENTO") setCat("Casa");
                  else if (next === "PROVISAO_ANUAL")
                    setCat("Fundo Anual (Carro/Impostos)");
                }}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              >
                <option value="CUSTO">Despesa Fixa</option>
                <option value="RENDA">Renda / Salário</option>
                <option value="INVESTIMENTO">Aporte Mensal</option>
                <option value="PROVISAO_ANUAL">Reserva Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Categoria
              </label>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value as Category)}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              >
                {CategorySchema.options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Conta
              </label>
              <input
                type="text"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Responsável
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value as Member)}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              >
                <option value="Giovanni">Giovanni</option>
                <option value="Maria Luiza">Maria Luiza</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Escopo
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              >
                <option value="CONJUNTO">Conjunto</option>
                <option value="INDIVIDUAL_GIOVANNI">Individual Giovanni</option>
                <option value="INDIVIDUAL_MARIA_LUIZA">Individual Maria Luiza</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Dia do mês (1-31)
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="surface-card w-full rounded-xl px-3 py-1.5 text-xs text-ink tabular-nums focus:border-[#EC4899] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="pressable rounded-full bg-[#EC4899] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar Fixo"}
            </button>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="p-6 text-center text-xs text-ink-muted">
          Nenhum item fixo cadastrado ainda. Cadastre salários e contas fixas aqui para aplicar em 1 clique todo mês.
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {templates.map((tpl) => {
            const isApplied = !pendingTemplates.some((p) => p.id === tpl.id);
            return (
              <div
                key={tpl.id}
                className="flex items-center justify-between gap-4 px-6 py-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink truncate">
                      {tpl.descricao}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isApplied
                          ? "bg-teal-500/10 text-[#0F766E] dark:text-emerald-300"
                          : "surface-subtle text-ink-secondary"
                      }`}
                    >
                      {isApplied ? "Lançado no mês" : "Pendente no mês"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-ink-secondary truncate">
                    Dia {tpl.dia_vencimento} · {tpl.categoria} · {tpl.conta} ·{" "}
                    {tpl.pago_por}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span
                    className={`font-semibold ${
                      tpl.tipo_fluxo === "RENDA"
                        ? "text-[#0F766E] dark:text-emerald-400"
                        : "text-ink"
                    }`}
                  >
                    {tpl.tipo_fluxo === "RENDA" ? "+" : "-"}
                    {formatBRL(tpl.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="pressable rounded-lg p-1.5 text-ink-muted hover:bg-rose-500/10 hover:text-[#EC4899]"
                    title="Remover fixo"
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
