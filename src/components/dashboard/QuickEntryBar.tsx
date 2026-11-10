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
  Zap,
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
    label: "👗 Vestido Cota Malu",
    text: "250 vestido #individual por:malu",
  },
  {
    label: "🍕 Jantar #lazer",
    text: "160 jantar pizzaria #lazer @itau",
  },
  {
    label: "🏠 Aporte Casa",
    text: "800 aporte meta casa #casa @itau",
  },
  {
    label: "🛡️ Provisão IPVA",
    text: "240 ipva 1/12 #provisao @itau",
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

  // Global Cmd+K / Ctrl+K shortcut — instant focus without open animation (emil-design-eng)
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

  // Reference date aligned with selected month so demo entries appear in the active view
  const referenceDate = useMemo(() => {
    const cleanYm = yearMonth.trim().slice(0, 7);
    return `${cleanYm}-12`;
  }, [yearMonth]);

  // 0ms deterministic lexical parser
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
          description: 'Exemplo: "180 gasolina @nubank 2x"',
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
          errData.message ?? "Não foi possível gravar o lançamento."
        );
      }

      const parcelaInfo =
        parsed.total_parcelas > 1 ? ` (${parsed.total_parcelas}x)` : "";

      toast.success(
        `✅ Lançado: ${parsed.descricao} | ${formatBRL(parsed.valor)} em ${parsed.categoria} (${parsed.conta})${parcelaInfo}`,
        {
          description: `Titular: ${parsed.pago_por} • Escopo: ${parsed.escopo} • Competência: ${parsed.data_competencia}`,
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
      aria-label="Barra de Entrada Rápida Omnibox"
      className="animate-enter rounded-2xl border border-white/[0.08] bg-[#11131A]/95 p-4 shadow-xl"
    >
      <div className="flex flex-col gap-3">
        {/* Top Row: Title + Member Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Quick Entry Omnibox · Parser Léxico 0ms
            </h2>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>

          {/* Quick Member Default Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden sm:inline">
              Lançando como:
            </span>
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#090A0F] p-0.5">
              <button
                type="button"
                onClick={() => setDefaultMember("Giovanni")}
                className={`pressable rounded-md px-2.5 py-1 text-xs font-medium ${
                  defaultMember === "Giovanni"
                    ? "bg-sky-500/20 text-sky-200 border border-sky-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Giovanni
              </button>
              <button
                type="button"
                onClick={() => setDefaultMember("Maria Luiza")}
                className={`pressable rounded-md px-2.5 py-1 text-xs font-medium ${
                  defaultMember === "Maria Luiza"
                    ? "bg-pink-500/20 text-pink-200 border border-pink-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Maria Luiza
              </button>
            </div>
          </div>
        </div>

        {/* Input Form (text-base on mobile to prevent iOS Safari auto-zoom) */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='Digite ex: "180 gasolina @nubank 2x" ou "250 vestido #individual por:malu"...'
            aria-label="Entrada rápida de lançamento financeiro"
            className="w-full rounded-xl border border-white/10 bg-[#090A0F] py-3 pl-4 pr-28 text-base sm:text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={!parsed.isValid || isSubmitting}
            className="pressable absolute right-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:bg-white/10 disabled:text-slate-500"
          >
            <span>{isSubmitting ? "Salvando..." : "Lançar"}</span>
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Real-time 0ms Preview Chips (when user types) OR Quick Clickable Examples */}
        {rawText.trim().length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#090A0F]/70 px-3 py-2 text-xs">
            <span className="text-[11px] font-medium text-slate-400 mr-1">
              Preview 0ms:
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
                    ? "border-slate-500/30 bg-slate-500/15 text-slate-100"
                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-300"
              }`}
            >
              {parsed.isValid ? formatBRL(parsed.valor) : "Sem valor numérico"}
            </span>

            {/* Categoria */}
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-200">
              <Hash className="h-3 w-3 text-indigo-400" />
              {parsed.categoria}
            </span>

            {/* Conta */}
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-200">
              <CreditCard className="h-3 w-3 text-cyan-400" />
              {parsed.conta}
            </span>

            {/* Parcelas */}
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-slate-200 tabular-nums">
              <Layers className="h-3 w-3 text-amber-400" />
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
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mr-1">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              Testar em 1 clique:
            </span>
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex.text}
                type="button"
                onClick={() => {
                  setRawText(ex.text);
                  inputRef.current?.focus();
                }}
                className="pressable rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
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
