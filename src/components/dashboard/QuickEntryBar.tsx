"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { roundCurrency } from "@/lib/domain/financial-engine";
import { parseQuickEntry } from "@/lib/domain/quick-entry-parser";
import type { Member } from "@/lib/domain/types";
import {
  formatBRL,
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
        `Registrado: ${parsed.descricao} · ${formatBRL(parsed.valor)} em ${parsed.categoria} (${parsed.conta})${parcelaInfo}`,
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

        {/* Right Shortcut or Instant Submit Button */}
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
      </form>

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
