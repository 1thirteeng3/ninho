"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  roundCurrency,
  splitInstallmentsWithBillingCycle,
} from "@/lib/domain/financial-engine";
import { parseQuickEntry } from "@/lib/domain/quick-entry-parser";
import type {
  Category,
  CoupleConfig,
  FlowType,
  Member,
  Scope,
} from "@/lib/domain/types";
import {
  formatBRL,
  formatShortDate,
  formatYearMonthLabel,
  getFlowBadgeStyle,
  getScopeBadgeLabel,
} from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

const QUICK_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: "180 gasolina @nubank 2x",
    text: "180 gasolina @nubank 2x",
  },
  {
    label: "250 vestido #individual por:malu",
    text: "250 vestido #individual por:malu",
  },
  {
    label: "800 aporte meta casa #casa @itau",
    text: "800 aporte meta casa #casa @itau",
  },
];

const COST_CATEGORIES: readonly Category[] = [
  "Habitação & Fixos",
  "Carro",
  "Saúde",
  "Estudos (Custeio)",
  "Lazer",
  "Cota Individual",
];

const ACCOUNT_PRESETS = ["Nubank", "Itaú", "Pix", "Dinheiro"] as const;

interface QuickEntryBarProps {
  yearMonth: string;
  config?: CoupleConfig[];
  dataSourceMode: DataSourceMode;
  onTransactionCreated: () => Promise<void> | void;
}

export function QuickEntryBar({
  yearMonth,
  config = [],
  dataSourceMode,
  onTransactionCreated,
}: QuickEntryBarProps) {
  const [rawText, setRawText] = useState("");
  const [defaultMember, setDefaultMember] = useState<Member>("Giovanni");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTactileOpen, setIsTactileOpen] = useState(false);
  const [tValue, setTValue] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tFlow, setTFlow] = useState<FlowType>("CUSTO");
  const [tCat, setTCat] = useState<Category>("Habitação & Fixos");
  const [tConta, setTConta] = useState("Nubank");
  const [tParcelas, setTParcelas] = useState(1);
  const [tScope, setTScope] = useState<Scope>("CONJUNTO");
  const [tDate, setTDate] = useState(() => new Date().toISOString().slice(0, 10));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const referenceDate = useMemo(() => {
    const cleanYm = yearMonth.trim().slice(0, 7);
    const now = new Date();
    const todayYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (cleanYm === todayYm) {
      return `${todayYm}-${String(now.getDate()).padStart(2, "0")}`;
    }
    const [y, m] = cleanYm.split("-").map(Number);
    const lastDay = new Date(y || now.getFullYear(), m || now.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(now.getDate(), lastDay);
    return `${cleanYm}-${String(clampedDay).padStart(2, "0")}`;
  }, [yearMonth]);

  const parsed = useMemo(
    () => parseQuickEntry(rawText, defaultMember, referenceDate),
    [rawText, defaultMember, referenceDate]
  );

  const installmentUnitValue = useMemo(() => {
    if (parsed.total_parcelas <= 1 || parsed.valorAbsoluto <= 0) {
      return parsed.valorAbsoluto;
    }
    return roundCurrency(parsed.valorAbsoluto / parsed.total_parcelas);
  }, [parsed.total_parcelas, parsed.valorAbsoluto]);

  function getProjectedCashHint(
    txInput: {
      data_competencia: string;
      tipo_fluxo: FlowType;
      categoria: Category;
      descricao: string;
      valor: number;
      conta: string;
      pago_por: Member;
      escopo: Scope;
      total_parcelas: number;
    }
  ): string {
    const memberCfg = config.find((c) => c.usuario === txInput.pago_por);
    const projected = splitInstallmentsWithBillingCycle(txInput, memberCfg);
    const firstCash = projected[0]?.data_caixa || txInput.data_competencia;
    const cashYm = firstCash.slice(0, 7);
    const labelYm = formatYearMonthLabel(cashYm);
    return `Fatura/Caixa: ${labelYm} (${formatShortDate(firstCash)})`;
  }

  const parsedCashHint = useMemo(() => {
    if (!parsed.isValid) return "";
    return getProjectedCashHint(parsed);
  }, [parsed, config]);

  async function submitTransaction(txPayload: {
    data_competencia: string;
    tipo_fluxo: FlowType;
    categoria: Category;
    descricao: string;
    valor: number;
    conta: string;
    pago_por: Member;
    escopo: Scope;
    total_parcelas: number;
  }) {
    const response = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...txPayload,
        mode: dataSourceMode,
      }),
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errData.message ?? "Não foi possível salvar o lançamento."
      );
    }

    const parcelaInfo =
      txPayload.total_parcelas > 1 ? ` (${txPayload.total_parcelas}x)` : "";
    const cashHint = getProjectedCashHint(txPayload);

    toast.success(
      `Registrado: ${txPayload.descricao} · ${formatBRL(txPayload.valor)} em ${txPayload.categoria} (${txPayload.conta})${parcelaInfo}`,
      {
        description: `${cashHint} • Pago por: ${txPayload.pago_por}`,
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.isValid || isSubmitting) {
      if (!parsed.isValid) {
        toast.error("Informe um valor numérico para registrar o lançamento.", {
          description: 'Exemplo: "150 mercado @itau 2x"',
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await submitTransaction({
        data_competencia: parsed.data_competencia,
        tipo_fluxo: parsed.tipo_fluxo,
        categoria: parsed.categoria,
        descricao: parsed.descricao,
        valor: parsed.valor,
        conta: parsed.conta,
        pago_por: parsed.pago_por,
        escopo: parsed.escopo,
        total_parcelas: parsed.total_parcelas,
      });
      setRawText("");
      await onTransactionCreated();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao registrar lançamento."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTactileSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numVal = Number(tValue.replace(",", "."));
    if (!Number.isFinite(numVal) || numVal <= 0 || isSubmitting) {
      toast.error("Informe um valor válido maior que zero.");
      return;
    }
    const signedVal =
      tFlow === "CUSTO" || tFlow === "PROVISAO_ANUAL"
        ? -Math.abs(roundCurrency(numVal))
        : Math.abs(roundCurrency(numVal));
    const resolvedScope: Scope =
      tScope === "CONJUNTO"
        ? "CONJUNTO"
        : defaultMember === "Giovanni"
          ? "INDIVIDUAL_GIOVANNI"
          : "INDIVIDUAL_MARIA_LUIZA";

    setIsSubmitting(true);
    try {
      await submitTransaction({
        data_competencia: tDate || referenceDate,
        tipo_fluxo: tFlow,
        categoria: tCat,
        descricao: tDesc.trim() || tCat,
        valor: signedVal,
        conta: tConta,
        pago_por: defaultMember,
        escopo: resolvedScope,
        total_parcelas: tFlow === "CUSTO" ? tParcelas : 1,
      });
      setTValue("");
      setTDesc("");
      setTParcelas(1);
      setIsTactileOpen(false);
      await onTransactionCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar lançamento."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const flowBadge = getFlowBadgeStyle(parsed.tipo_fluxo);
  const scopeBadge = getScopeBadgeLabel(parsed.escopo);

  return (
    <section aria-label="Lançamento Rápido" className="animate-enter">
      {/* Single Clean Omnibox Bar */}
      <form
        onSubmit={handleSubmit}
        className="surface-card flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors focus-within:border-[#EC4899]"
      >
        {/* Left Avatar Pill Switcher inside the bar */}
        <div
          role="group"
          aria-label="Quem está lançando"
          className="surface-subtle inline-flex shrink-0 items-center rounded-xl p-0.5"
        >
          <button
            type="button"
            onClick={() => setDefaultMember("Giovanni")}
            className={`pressable flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
              defaultMember === "Giovanni"
                ? "bg-[#EC4899] text-white shadow-2xs"
                : "text-ink-secondary hover:text-ink"
            }`}
            title="Lançar como Giovanni"
          >
            <span>G</span>
            <span className="hidden sm:inline font-medium">Giovanni</span>
          </button>
          <button
            type="button"
            onClick={() => setDefaultMember("Maria Luiza")}
            className={`pressable flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
              defaultMember === "Maria Luiza"
                ? "bg-[#EC4899] text-white shadow-2xs"
                : "text-ink-secondary hover:text-ink"
            }`}
            title="Lançar como Maria Luiza"
          >
            <span>ML</span>
            <span className="hidden sm:inline font-medium">Maria Luiza</span>
          </button>
        </div>

        {/* Clean Omnibox Input */}
        <input
          ref={inputRef}
          type="text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder='Lançamento rápido: "180 gasolina @nubank 2x" ou "250 vestido #individual por:malu"...'
          aria-label="Lançamento rápido financeiro"
          className="min-w-0 flex-1 bg-transparent py-1.5 px-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />

        {/* Right Shortcut or Instant Submit Button + Tactile Mobile Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          {rawText.trim().length > 0 ? (
            <button
              type="submit"
              disabled={!parsed.isValid || isSubmitting}
              className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#EC4899] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-40"
            >
              <span>{isSubmitting ? "Salvando..." : "Salvar"}</span>
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="surface-subtle hidden sm:inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-mono text-ink-muted">
              ⌘K
            </kbd>
          )}
          <button
            type="button"
            onClick={() => {
              setTDate(referenceDate);
              setIsTactileOpen((prev) => !prev);
            }}
            className="pressable inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-[#FFC9E3]"
            title="Abrir formulário tátil (ideal para celular)"
          >
            {isTactileOpen ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Lançar</span>
          </button>
        </div>
      </form>

      {isTactileOpen && (
        <form
          onSubmit={handleTactileSubmit}
          className="surface-card mt-3 rounded-2xl p-4 sm:p-5 text-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "CUSTO", label: "Gasto", cat: "Habitação & Fixos" },
                  { id: "RENDA", label: "Renda", cat: "Salário / Renda" },
                  { id: "INVESTIMENTO", label: "Investimento", cat: "Casa" },
                  {
                    id: "PROVISAO_ANUAL",
                    label: "Reserva Anual",
                    cat: "Fundo Anual (Carro/Impostos)",
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setTFlow(f.id);
                    setTCat(f.cat);
                  }}
                  className={`pressable rounded-full px-3 py-1 font-semibold ${
                    tFlow === f.id
                      ? "bg-[#EC4899] text-white"
                      : "surface-subtle text-ink-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTScope("CONJUNTO")}
                className={`pressable rounded-full px-3 py-1 font-semibold ${
                  tScope === "CONJUNTO"
                    ? "bg-[#1F0D18] text-white"
                    : "surface-subtle text-ink-secondary"
                }`}
              >
                Casal
              </button>
              <button
                type="button"
                onClick={() => setTScope("INDIVIDUAL_GIOVANNI")}
                className={`pressable rounded-full px-3 py-1 font-semibold ${
                  tScope !== "CONJUNTO"
                    ? "bg-[#1F0D18] text-white"
                    : "surface-subtle text-ink-secondary"
                }`}
              >
                Individual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={tValue}
                onChange={(e) => setTValue(e.target.value)}
                placeholder="0,00"
                className="surface-card w-full rounded-xl px-3 py-2 text-base font-bold text-ink tabular-nums focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={tDesc}
                onChange={(e) => setTDesc(e.target.value)}
                placeholder="Ex: Mercado, Gasolina..."
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink focus:border-[#EC4899] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-secondary mb-1">
                Data da compra
              </label>
              <input
                type="date"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
                className="surface-card w-full rounded-xl px-3 py-2 text-xs text-ink tabular-nums focus:border-[#EC4899] focus:outline-none"
              />
            </div>
          </div>

          {tFlow === "CUSTO" && (
            <div>
              <span className="block text-[11px] font-semibold text-ink-secondary mb-1.5">
                Categoria
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COST_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTCat(cat)}
                    className={`pressable rounded-full px-3 py-1 text-xs font-medium ${
                      tCat === cat
                        ? "bg-[#EC4899] text-white font-semibold"
                        : "surface-subtle text-ink-secondary"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tFlow === "INVESTIMENTO" && (
            <div>
              <span className="block text-[11px] font-semibold text-ink-secondary mb-1.5">
                Meta
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    "Casa",
                    "Estudos (Fundo Futuro)",
                    "Viagem",
                    "Reserva & Patrimônio",
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTCat(cat)}
                    className={`pressable rounded-full px-3 py-1 text-xs font-medium ${
                      tCat === cat
                        ? "bg-[#C084FC] text-white font-semibold"
                        : "surface-subtle text-ink-secondary"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-ink-secondary mr-1">
                Conta:
              </span>
              {ACCOUNT_PRESETS.map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setTConta(acc)}
                  className={`pressable rounded-full px-2.5 py-1 text-xs font-medium ${
                    tConta === acc
                      ? "bg-[#1F0D18] text-white"
                      : "surface-subtle text-ink-secondary"
                  }`}
                >
                  {acc}
                </button>
              ))}
              {tFlow === "CUSTO" && (
                <>
                  <span className="text-[11px] font-semibold text-ink-secondary ml-2 mr-1">
                    Parcelas:
                  </span>
                  {[1, 2, 3, 6, 10, 12].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTParcelas(p)}
                      className={`pressable rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
                        tParcelas === p
                          ? "bg-[#EC4899] text-white font-semibold"
                          : "surface-subtle text-ink-secondary"
                      }`}
                    >
                      {p}x
                    </button>
                  ))}
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="pressable rounded-full border-2 border-[#1F0D18] bg-[#FF3B9A] px-5 py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#1F0D18] disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : `Salvar como ${defaultMember}`}
            </button>
          </div>
        </form>
      )}

      {/* Instant Confirmation Line (Zero-latency when typing) OR 3 Subtle Text Suggestions */}
      {rawText.trim().length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-ink-secondary tabular-nums">
            <span className="text-ink-muted">Como será salvo:</span>
            <span className="font-semibold text-ink">{flowBadge.label}</span>
            <span className="text-ink-muted">·</span>
            <span
              className={`font-semibold ${
                parsed.isValid
                  ? parsed.valor < 0
                    ? "text-[#EC4899]"
                    : "text-[#0F766E]"
                  : "text-amber-600"
              }`}
            >
              {parsed.isValid ? formatBRL(Math.abs(parsed.valor)) : "Informe o valor"}
            </span>
            <span className="text-ink-muted">·</span>
            <span className="font-medium text-ink">{parsed.descricao}</span>
            <span className="text-ink-muted">·</span>
            <span>{parsed.categoria}</span>
            <span className="text-ink-muted">·</span>
            <span>{parsed.conta}</span>
            <span className="text-ink-muted">·</span>
            <span>
              {parsed.total_parcelas > 1
                ? `${parsed.total_parcelas}x de ${formatBRL(installmentUnitValue)}`
                : "1x à vista"}
            </span>
            <span className="text-ink-muted">·</span>
            <span>
              {parsed.pago_por} ({scopeBadge.label})
            </span>
            {parsedCashHint && (
              <>
                <span className="text-ink-muted">·</span>
                <span className="font-semibold text-[#EC4899]">
                  {parsedCashHint}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-ink-muted">
          <span>Sugestões:</span>
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex.text}
              type="button"
              onClick={() => {
                setRawText(ex.text);
                inputRef.current?.focus();
              }}
              className="pressable text-ink-secondary underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
