"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CornerDownLeft,
  CreditCard,
  Hash,
  Layers,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { roundCurrency } from "@/lib/domain/financial-engine";
import { parseQuickEntry } from "@/lib/domain/quick-entry-parser";
import type { Member } from "@/lib/domain/types";
import {
  formatBRL,
  getFlowBadgeStyle,
  getMemberBadgeStyle,
  getScopeBadgeLabel,
} from "@/lib/formatters";
import type { DataSourceMode } from "./HeaderControls";

const QUICK_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: "⛽ Gasolina 2x",
    text: "180 gasolina @nubank 2x",
  },
  {
    label: "👗 Vestido (Pessoal Malu)",
    text: "250 vestido #individual por:malu",
  },
  {
    label: "🍕 Jantar #lazer",
    text: "160 jantar pizzaria #lazer @itau",
  },
  {
    label: "🏠 Guardar p/ Casa",
    text: "800 aporte meta casa #casa @itau",
  },
  {
    label: "🛡️ Reserva IPVA",
    text: "240 ipva mensal #provisao @itau",
  },
];

interface QuickEntryBarProps {
  yearMonth: string;
  dataSourceMode: DataSourceMode;
  onTransactionCreated: () => Promise<void> | void;
}

export function QuickEntryBar({
  yearMonth,
  dataSourceMode,
  onTransactionCreated,
}: QuickEntryBarProps) {
  const [rawText, setRawText] = useState("");
  const [defaultMember, setDefaultMember] = useState<Member>("Giovanni");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    return `${cleanYm}-12`;
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
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_competencia: parsed.data_competencia,
          tipo_fluxo: parsed.tipo_fluxo,
          categoria: parsed.categoria,
          descricao: parsed.descricao,
          valor: parsed.valor,
          conta: parsed.conta,
          pago_por: parsed.pago_por,
          escopo: parsed.escopo,
          total_parcelas: parsed.total_parcelas,
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
        parsed.total_parcelas > 1 ? ` (${parsed.total_parcelas}x)` : "";

      toast.success(
        `✅ Registrado: ${parsed.descricao} | ${formatBRL(parsed.valor)} em ${parsed.categoria} (${parsed.conta})${parcelaInfo}`,
        {
          description: `Pago por: ${parsed.pago_por} • Data: ${parsed.data_competencia}`,
        }
      );

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

  const flowBadge = getFlowBadgeStyle(parsed.tipo_fluxo);
  const scopeBadge = getScopeBadgeLabel(parsed.escopo);

  return (
    <section
      aria-label="Lançamento Rápido"
      className="animate-enter rounded-2xl border border-rose-400/30 bg-gradient-to-br from-[#1B0E18] via-[#21111E] to-[#1B0E18] p-4 shadow-xl shadow-rose-950/30"
    >
      <div className="flex flex-col gap-3">
        {/* Top Row: Title + Member Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <span className="text-xs font-semibold text-rose-100">
                Lançamento Rápido
              </span>
              <span className="hidden md:inline text-xs text-rose-200/70 ml-2">
                — Digite como você fala (ex: 150 mercado @itau 2x) ou pressione
                Ctrl+K
              </span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono text-rose-200">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>

          {/* Quick Member Default Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-rose-200/70 hidden sm:inline">
              Quem está lançando:
            </span>
            <div className="inline-flex rounded-xl border border-rose-500/25 bg-[#120910] p-0.5">
              <button
                type="button"
                onClick={() => setDefaultMember("Giovanni")}
                className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
                  defaultMember === "Giovanni"
                    ? "bg-rose-500/25 text-rose-100 border border-rose-400/40"
                    : "text-rose-200/60 hover:text-white"
                }`}
              >
                Giovanni
              </button>
              <button
                type="button"
                onClick={() => setDefaultMember("Maria Luiza")}
                className={`pressable rounded-lg px-2.5 py-1 text-xs font-medium ${
                  defaultMember === "Maria Luiza"
                    ? "bg-pink-500/25 text-pink-100 border border-pink-400/40"
                    : "text-rose-200/60 hover:text-white"
                }`}
              >
                Maria Luiza
              </button>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='Digite como você fala (ex: "150 mercado @itau 2x" ou "250 vestido #individual por:malu")...'
            aria-label="Lançamento rápido financeiro"
            className="w-full rounded-xl border border-rose-400/25 bg-[#120910] py-3 pl-4 pr-32 text-base sm:text-sm text-white placeholder:text-rose-200/40 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
          />
          <button
            type="submit"
            disabled={!parsed.isValid || isSubmitting}
            className="pressable absolute right-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-500/20 hover:from-rose-400 hover:to-pink-400 disabled:from-white/10 disabled:to-white/10 disabled:text-rose-200/40 disabled:shadow-none"
          >
            <span>{isSubmitting ? "Salvando..." : "Adicionar"}</span>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Friendly Preview Chips OR Quick Clickable Examples */}
        {rawText.trim().length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-rose-400/20 bg-[#120910]/80 px-3 py-2 text-xs">
            <span className="text-[11px] font-medium text-rose-200/75 mr-1">
              Como será salvo:
            </span>

            {/* Fluxo */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${flowBadge.className}`}
            >
              {flowBadge.label}
            </span>

            {/* Valor BRL */}
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                parsed.isValid
                  ? parsed.valor < 0
                    ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-300"
              }`}
            >
              {parsed.isValid ? formatBRL(parsed.valor) : "Digite um valor"}
            </span>

            {/* Categoria */}
            <span className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/15 px-2 py-0.5 text-[11px] font-medium text-pink-100">
              <Hash className="h-3 w-3 text-pink-300" />
              {parsed.categoria}
            </span>

            {/* Conta */}
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-100">
              <CreditCard className="h-3 w-3 text-rose-300" />
              {parsed.conta}
            </span>

            {/* Parcelas */}
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-100 tabular-nums">
              <Layers className="h-3 w-3 text-amber-300" />
              {parsed.total_parcelas > 1
                ? `${parsed.total_parcelas}x de ${formatBRL(installmentUnitValue)}`
                : "À vista (1x)"}
            </span>

            {/* Pagador */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${getMemberBadgeStyle(
                parsed.pago_por
              )}`}
            >
              <User className="h-3 w-3" />
              {parsed.pago_por}
            </span>

            {/* Escopo */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${scopeBadge.className}`}
            >
              {scopeBadge.label}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-200/70 mr-1">
              <Sparkles className="h-3 w-3 text-rose-400" />
              Exemplos rápidos:
            </span>
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex.text}
                type="button"
                onClick={() => {
                  setRawText(ex.text);
                  inputRef.current?.focus();
                }}
                className="pressable rounded-lg border border-rose-400/15 bg-rose-500/[0.06] px-2.5 py-1 text-[11px] text-rose-100/90 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
