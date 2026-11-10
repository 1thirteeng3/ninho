"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Clock,
  Landmark,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
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
          ? `✨ Ativo atualizado: ${payloadAsset.nome}`
          : `✨ Novo ativo adicionado: ${payloadAsset.nome}`,
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
      className="animate-enter delay-2 rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-500/25 text-rose-300 border border-rose-400/30">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-white">
              Nossos Ativos de Investimento & Quanto Rendem
            </h2>
          </div>
          <p className="mt-1 text-xs text-rose-200/75">
            Adicione ou edite cada aplicação (CDB, Tesouro, LCI/LCA, Caixinha,
            FII, Ações), acompanhe a taxa de rendimento e o saldo atualizado das
            metas
          </p>
        </div>

        <button
          type="button"
          onClick={openNewAssetForm}
          className="pressable inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/20 hover:from-rose-400 hover:to-pink-400"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Ativo de Investimento</span>
        </button>
      </div>

      {/* Goal Filter Tabs + Summary Pill */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/15 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedGoalFilter("ALL")}
            className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
              selectedGoalFilter === "ALL"
                ? "bg-rose-500/25 text-rose-100 border border-rose-400/40"
                : "text-rose-200/70 hover:text-white bg-[#120910]/60 border border-rose-500/10"
            }`}
          >
            Todos os Ativos ({assets.length})
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
                className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
                  selectedGoalFilter === goalName
                    ? "bg-pink-500/25 text-pink-100 border border-pink-400/40"
                    : "text-rose-200/70 hover:text-white bg-[#120910]/60 border border-rose-500/10"
                }`}
              >
                {goalName} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          <span className="text-rose-200/75">
            Aplicado:{" "}
            <strong className="text-white">{formatBRL(totals.aportado)}</strong>
          </span>
          <span className="text-rose-200/75">
            Saldo Atual:{" "}
            <strong className="text-pink-200">{formatBRL(totals.saldo)}</strong>
          </span>
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
            Rendeu {formatBRL(totals.ganho, true)} ({formatPct(totals.ganhoPct)}
            )
          </span>
        </div>
      </div>

      {/* Add / Edit Inline Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveAsset}
          className="mt-4 rounded-2xl border border-rose-400/35 bg-[#120910]/95 p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              {editingId
                ? "Editar Ativo de Investimento"
                : "Cadastrar Novo Ativo de Investimento"}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="pressable rounded-lg p-1 text-rose-200/60 hover:bg-rose-500/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Nome */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Nome da Aplicação / Ativo
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: CDB Itaú Casa Própria, Tesouro IPCA+ 2029..."
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Tipo de Ativo */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
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
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#1B0E18] text-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Quanto Rende */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Quanto Rende (Taxa)
              </label>
              <input
                type="text"
                required
                value={form.rendimento}
                onChange={(e) =>
                  setForm({ ...form, rendimento: e.target.value })
                }
                placeholder="Ex: 112% do CDI ou IPCA + 6,5%"
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Instituição */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Banco / Corretora
              </label>
              <input
                type="text"
                value={form.instituicao}
                onChange={(e) =>
                  setForm({ ...form, instituicao: e.target.value })
                }
                placeholder="Ex: Nubank, Itaú, XP, Inter..."
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Liquidez */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Quando pode resgatar (Liquidez)
              </label>
              <input
                type="text"
                value={form.liquidez}
                onChange={(e) => setForm({ ...form, liquidez: e.target.value })}
                placeholder="Ex: Diária imediata, No vencimento..."
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Meta Vinculada */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Meta Vinculada
              </label>
              <select
                value={form.meta_vinculada}
                onChange={(e) =>
                  setForm({ ...form, meta_vinculada: e.target.value })
                }
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
              >
                {availableGoalNames.map((gName) => (
                  <option
                    key={gName}
                    value={gName}
                    className="bg-[#1B0E18] text-white"
                  >
                    {gName}
                  </option>
                ))}
              </select>
            </div>

            {/* Titular */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Titular da Conta
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
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
              >
                <option value="Casal" className="bg-[#1B0E18] text-white">
                  Casal (Conjunto)
                </option>
                <option value="Giovanni" className="bg-[#1B0E18] text-white">
                  Giovanni
                </option>
                <option value="Maria Luiza" className="bg-[#1B0E18] text-white">
                  Maria Luiza
                </option>
              </select>
            </div>

            {/* Valor Aplicado */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Valor Aplicado do Bolso (R$)
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
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none tabular-nums"
              />
            </div>

            {/* Saldo Atual com Rendimento */}
            <div>
              <label className="block text-[11px] font-medium text-rose-200/80 mb-1">
                Saldo Atual com Rendimentos (R$)
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
                className="w-full rounded-xl border border-rose-400/25 bg-[#1B0E18] px-3 py-2 text-xs text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="pressable rounded-xl border border-rose-400/20 bg-transparent px-3.5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="pressable inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-500/20 hover:from-rose-400 hover:to-pink-400 disabled:opacity-50"
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

      {/* Assets Cards Grid */}
      {filteredAssets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-rose-500/15 bg-[#120910]/60 p-8 text-center">
          <p className="text-sm font-medium text-rose-100">
            Nenhum ativo cadastrado para esta meta ainda.
          </p>
          <p className="mt-1 text-xs text-rose-200/60">
            Clique em &ldquo;Novo Ativo de Investimento&rdquo; para cadastrar um
            CDB, Tesouro Direto, LCI/LCA ou Caixinha.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-[#120910]/80 p-4 transition-colors hover:border-rose-400/40"
              >
                <div>
                  {/* Top Badges: Asset Type + Yield Rate */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-200">
                      <Landmark className="h-2.5 w-2.5" />
                      {asset.tipo_ativo}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-gradient-to-r from-rose-500/20 to-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                      📈 Rende {asset.rendimento}
                    </span>
                  </div>

                  {/* Asset Title */}
                  <h3 className="mt-2.5 text-sm font-semibold text-white leading-snug">
                    {asset.nome}
                  </h3>

                  {/* Institution, Liquidity & Goal */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-rose-200/75">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-rose-400" />
                      {asset.instituicao}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-pink-400" />
                      Liquidez: {asset.liquidez}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="rounded border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 font-medium text-rose-200">
                      Meta: {asset.meta_vinculada}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-rose-100/80">
                      Titular: {asset.titular}
                    </span>
                  </div>
                </div>

                {/* Financial Figures + Actions */}
                <div className="mt-3.5 border-t border-rose-500/15 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                    <div>
                      <span className="block text-[10px] text-rose-200/60">
                        Aplicado
                      </span>
                      <span className="font-medium text-rose-100">
                        {formatBRL(asset.valor_aportado)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-rose-200/60">
                        Saldo Atual
                      </span>
                      <span className="font-bold text-white">
                        {formatBRL(asset.saldo_atual)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-rose-200/60">
                        Ganho
                      </span>
                      <span className="font-semibold text-emerald-300">
                        {formatBRL(ganho, true)} ({formatPct(ganhoPct)})
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditAssetForm(asset)}
                      className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/20"
                    >
                      <Pencil className="h-3 w-3 text-rose-300" />
                      <span>Modificar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                      className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-[#1B0E18] px-2 py-1 text-[11px] font-medium text-rose-300/80 hover:border-rose-400 hover:bg-rose-500/20 hover:text-white"
                      title="Remover ativo"
                    >
                      <Trash2 className="h-3 w-3" />
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
