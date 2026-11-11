"use client";

import React, { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { roundCurrency } from "@/lib/domain/financial-engine";
import {
  AssetTypeSchema,
  type AssetType,
  type InvestmentAsset,
  type InvestmentGoal,
} from "@/lib/domain/types";
import { formatBRL, formatPct } from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

const ASSET_TYPES: readonly AssetType[] = AssetTypeSchema.options;

const GOAL_OPTIONS: readonly string[] = [
  "Casa",
  "Viagem",
  "Estudos (Fundo Futuro)",
  "Reserva & Patrimônio",
];

interface InvestmentAssetsManagerProps {
  assets: InvestmentAsset[];
  goals: InvestmentGoal[];
  dataSourceMode: DataSourceMode;
  onDataChanged: () => Promise<void> | void;
}

interface AssetFormState {
  id: string;
  nome: string;
  tipo_ativo: AssetType;
  rendimento: string;
  liquidez: string;
  instituicao: string;
  meta_vinculada: string;
  titular: "Casal" | "Giovanni" | "Maria Luiza";
  valor_aportado: string;
  saldo_atual: string;
}

const EMPTY_FORM: AssetFormState = {
  id: "",
  nome: "",
  tipo_ativo: "CDB",
  rendimento: "110% do CDI",
  liquidez: "Diária",
  instituicao: "Nubank",
  meta_vinculada: "Casa",
  titular: "Casal",
  valor_aportado: "",
  saldo_atual: "",
};

export function InvestmentAssetsManager({
  assets,
  goals,
  dataSourceMode,
  onDataChanged,
}: InvestmentAssetsManagerProps) {
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>("ALL");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const filteredAssets = useMemo(() => {
    if (selectedGoalFilter === "ALL") {
      return assets;
    }
    return assets.filter((a) => a.meta_vinculada === selectedGoalFilter);
  }, [assets, selectedGoalFilter]);

  const totals = useMemo(() => {
    const aportado = roundCurrency(
      filteredAssets.reduce((acc, a) => acc + a.valor_aportado, 0)
    );
    const saldo = roundCurrency(
      filteredAssets.reduce((acc, a) => acc + a.saldo_atual, 0)
    );
    const ganho = roundCurrency(saldo - aportado);
    const ganhoPct =
      aportado > 0 ? roundCurrency((ganho / aportado) * 100) : 0;

    return { aportado, saldo, ganho, ganhoPct };
  }, [filteredAssets]);

  function openNewAssetForm() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      meta_vinculada:
        selectedGoalFilter !== "ALL" ? selectedGoalFilter : "Casa",
    });
    setIsFormOpen(true);
  }

  function openEditAssetForm(asset: InvestmentAsset) {
    setEditingId(asset.id);
    setForm({
      id: asset.id,
      nome: asset.nome,
      tipo_ativo: asset.tipo_ativo,
      rendimento: asset.rendimento,
      liquidez: asset.liquidez,
      instituicao: asset.instituicao,
      meta_vinculada: asset.meta_vinculada,
      titular: asset.titular,
      valor_aportado: String(asset.valor_aportado),
      saldo_atual: String(asset.saldo_atual),
    });
    setIsFormOpen(true);
  }

  async function handleSaveAsset(e: React.FormEvent) {
    e.preventDefault();
    const nome = form.nome.trim();
    const valorAportado = Number(form.valor_aportado.replace(",", "."));
    const saldoAtual = Number(
      (form.saldo_atual.trim() || form.valor_aportado).replace(",", ".")
    );

    if (!nome) {
      toast.error("Informe o nome do ativo de investimento.");
      return;
    }
    if (!Number.isFinite(valorAportado) || valorAportado < 0) {
      toast.error("Informe um valor aplicado válido.");
      return;
    }
    if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
      toast.error("Informe um saldo atual válido.");
      return;
    }

    setIsSaving(true);
    try {
      const payloadAsset: InvestmentAsset = {
        id: editingId ?? `asset_${Date.now()}`,
        nome,
        tipo_ativo: form.tipo_ativo,
        rendimento: form.rendimento.trim() || "100% do CDI",
        liquidez: form.liquidez.trim() || "Diária",
        instituicao: form.instituicao.trim() || "Banco",
        meta_vinculada: form.meta_vinculada,
        titular: form.titular,
        valor_aportado: roundCurrency(valorAportado),
        saldo_atual: roundCurrency(saldoAtual),
      };

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_ASSET",
          asset: payloadAsset,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível salvar o ativo.");
      }

      toast.success(
        editingId
          ? `Ativo atualizado: ${payloadAsset.nome}`
          : `Novo ativo adicionado: ${payloadAsset.nome}`,
        {
          description: `${payloadAsset.tipo_ativo} • Rende ${payloadAsset.rendimento} • Meta: ${payloadAsset.meta_vinculada}`,
        }
      );

      setIsFormOpen(false);
      setEditingId(null);
      await onDataChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar o ativo."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAsset(asset: InvestmentAsset) {
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_ASSET",
          id: asset.id,
          mode: dataSourceMode,
        }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível remover o ativo.");
      }

      toast.success(`Ativo removido: ${asset.nome}`);
      await onDataChanged();
    } catch {
      toast.error("Erro ao remover o ativo.");
    }
  }

  const availableGoalNames = useMemo(() => {
    const fromGoals = goals.map((g) => String(g.nome));
    return Array.from(new Set([...GOAL_OPTIONS, ...fromGoals]));
  }, [goals]);

  return (
    <section
      aria-label="Nossos Ativos e Rendimentos"
      className="animate-enter delay-2 surface-card rounded-2xl overflow-hidden"
    >
      {/* Editorial Header */}
      <div className="flex flex-col gap-3 border-b border-hairline px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-editorial text-xl italic tracking-tight text-ink">
            Carteira de Ativos &amp; Rendimentos
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Aplicações vinculadas às nossas metas, indexadores de rentabilidade e liquidez
          </p>
        </div>

        <button
          type="button"
          onClick={openNewAssetForm}
          className="pressable inline-flex items-center justify-center gap-1.5 rounded-full bg-[#BE123C] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Novo Ativo</span>
        </button>
      </div>

      {/* Goal Filter Pills + Portfolio Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-[var(--bg-subtle)]/40 px-6 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedGoalFilter("ALL")}
            className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedGoalFilter === "ALL"
                ? "bg-[#BE123C] text-white font-semibold"
                : "surface-card text-ink-secondary hover:text-ink"
            }`}
          >
            Todos ({assets.length})
          </button>
          {availableGoalNames.map((goalName) => {
            const count = assets.filter(
              (a) => a.meta_vinculada === goalName
            ).length;
            return (
              <button
                key={goalName}
                type="button"
                onClick={() => setSelectedGoalFilter(goalName)}
                className={`pressable rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedGoalFilter === goalName
                    ? "bg-[#BE123C] text-white font-semibold"
                    : "surface-card text-ink-secondary hover:text-ink"
                }`}
              >
                {goalName} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
          <span className="text-ink-secondary">
            Aplicado:{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(totals.aportado)}
            </strong>
          </span>
          <span className="text-ink-secondary">
            Saldo Atual:{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(totals.saldo)}
            </strong>
          </span>
          <span className="font-semibold text-[#0F766E] dark:text-emerald-400">
            {formatBRL(totals.ganho, true)} ({formatPct(totals.ganhoPct)})
          </span>
        </div>
      </div>

      {/* Add / Edit Inline Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveAsset}
          className="border-b border-hairline bg-[var(--bg-subtle)]/60 p-6"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">
              {editingId
                ? "Editar Ativo de Investimento"
                : "Cadastrar Novo Ativo de Investimento"}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="pressable rounded-lg p-1 text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Nome da Aplicação / Ativo
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: CDB Itaú Casa Própria, Tesouro IPCA+ 2029..."
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Tipo de Ativo
              </label>
              <select
                value={form.tipo_ativo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_ativo: e.target.value as AssetType,
                  })
                }
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#BE123C] focus:outline-none"
              >
                {ASSET_TYPES.map((t) => (
                  <option
                    key={t}
                    value={t}
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Taxa de Rendimento
              </label>
              <input
                type="text"
                required
                value={form.rendimento}
                onChange={(e) =>
                  setForm({ ...form, rendimento: e.target.value })
                }
                placeholder="Ex: 112% do CDI ou IPCA + 6,45% a.a."
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Instituição
              </label>
              <input
                type="text"
                value={form.instituicao}
                onChange={(e) =>
                  setForm({ ...form, instituicao: e.target.value })
                }
                placeholder="Ex: Itaú, Nubank, XP..."
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Liquidez
              </label>
              <input
                type="text"
                value={form.liquidez}
                onChange={(e) => setForm({ ...form, liquidez: e.target.value })}
                placeholder="Ex: Diária, No vencimento..."
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Meta Vinculada
              </label>
              <select
                value={form.meta_vinculada}
                onChange={(e) =>
                  setForm({ ...form, meta_vinculada: e.target.value })
                }
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#BE123C] focus:outline-none"
              >
                {availableGoalNames.map((gName) => (
                  <option
                    key={gName}
                    value={gName}
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {gName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Titular
              </label>
              <select
                value={form.titular}
                onChange={(e) =>
                  setForm({
                    ...form,
                    titular: e.target.value as
                      | "Casal"
                      | "Giovanni"
                      | "Maria Luiza",
                  })
                }
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#BE123C] focus:outline-none"
              >
                <option value="Casal">Casal</option>
                <option value="Giovanni">Giovanni</option>
                <option value="Maria Luiza">Maria Luiza</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Valor Aplicado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.valor_aportado}
                onChange={(e) =>
                  setForm({ ...form, valor_aportado: e.target.value })
                }
                placeholder="Ex: 5000"
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                Saldo Atual Bruto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.saldo_atual}
                onChange={(e) =>
                  setForm({ ...form, saldo_atual: e.target.value })
                }
                placeholder="Ex: 5420"
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#BE123C] focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="pressable surface-card rounded-full px-4 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-[#BE123C] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {isSaving
                  ? "Salvando..."
                  : editingId
                    ? "Salvar Alterações"
                    : "Adicionar Ativo"}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Editorial Assets List (Divided Rows / Clean Table-like Layout) */}
      {filteredAssets.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-ink">
            Nenhum ativo cadastrado para esta meta ainda.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Clique em &ldquo;Novo Ativo&rdquo; para registrar um CDB, Tesouro Direto, LCI/LCA ou Caixinha.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {filteredAssets.map((asset) => {
            const ganho = roundCurrency(
              asset.saldo_atual - asset.valor_aportado
            );
            const ganhoPct =
              asset.valor_aportado > 0
                ? roundCurrency((ganho / asset.valor_aportado) * 100)
                : 0;

            return (
              <article
                key={asset.id}
                className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--bg-subtle)]/35 lg:flex-row lg:items-center"
              >
                {/* Left: Asset Name + Institution + Type Tag + Yield Rate */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      {asset.nome}
                    </h3>
                    <span className="text-xs text-ink-muted">·</span>
                    <span className="text-xs font-medium text-ink-secondary">
                      {asset.instituicao}
                    </span>
                    <span className="surface-subtle rounded-md px-2 py-0.5 text-[11px] font-medium text-ink">
                      {asset.tipo_ativo}
                    </span>
                    <span className="surface-rose-tint rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#BE123C] dark:text-[#FB7185]">
                      {asset.rendimento}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-ink-secondary">
                    Meta:{" "}
                    <strong className="font-medium text-ink">
                      {asset.meta_vinculada}
                    </strong>{" "}
                    · Liquidez: {asset.liquidez} · Titular: {asset.titular}
                  </p>
                </div>

                {/* Right: Applied -> Current Balance (+Gain) + Discreet Actions */}
                <div className="flex flex-wrap items-center justify-between gap-5 lg:justify-end shrink-0">
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                        Aplicado
                      </span>
                      <span className="font-medium text-ink-secondary">
                        {formatBRL(asset.valor_aportado)}
                      </span>
                    </div>

                    <span className="text-ink-muted">→</span>

                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                        Saldo Atual
                      </span>
                      <span className="text-sm font-semibold tracking-[-0.02em] text-ink">
                        {formatBRL(asset.saldo_atual)}
                      </span>
                    </div>

                    <div className="min-w-[96px] text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                        Rendimento
                      </span>
                      <span className="font-semibold text-[#0F766E] dark:text-emerald-400">
                        {formatBRL(ganho, true)} ({formatPct(ganhoPct)})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditAssetForm(asset)}
                      className="pressable inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-[var(--bg-subtle)] hover:text-ink"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                      className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-rose-500/10 hover:text-[#BE123C]"
                      title="Remover ativo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Remover</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
