"use client";

import React from "react";
import {
  roundCurrency,
  type CoupleSettlementResult,
  type FutureInvoiceMonthProjection,
  type MemberSettlementDetail,
} from "@/lib/domain/financial-engine";
import type { AnnualProvision } from "@/lib/domain/types";
import {
  formatBRL,
  formatPct,
  formatYearMonthLabel,
  getMonthNameByNumber,
} from "@/lib/formatters";

interface CoupleGovernanceModuleProps {
  settlement: CoupleSettlementResult;
  futureInvoices: FutureInvoiceMonthProjection[];
  provisions: AnnualProvision[];
}

function MemberSettlementCard({ detail }: { detail: MemberSettlementDetail }) {
  const isGiovanni = detail.usuario === "Giovanni";
  const initials = isGiovanni ? "G" : "ML";
  const barColor = isGiovanni ? "#BE123C" : "#9F1239";

  const remainingRatioPct =
    detail.cotaMensal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            roundCurrency((detail.saldoDisponivel / detail.cotaMensal) * 100)
          )
        )
      : 0;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-[var(--bg-subtle)]/25 p-5 min-w-0">
      <div>
        {/* Personal Editorial Card Header with Typographic Avatar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: barColor }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink truncate">
                {detail.usuario}
              </h3>
              <p className="text-[11px] text-ink-muted">Cota Pessoal Mensal</p>
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              detail.status === "DISPONIVEL"
                ? "bg-teal-500/10 text-[#0F766E] dark:text-emerald-300"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {detail.status === "DISPONIVEL" ? "Em dia" : "Acima da cota"}
          </span>
        </div>

        {/* Direct 3-Line Breakdown + Available Balance */}
        <div className="mt-4 divide-y divide-hairline text-xs tabular-nums">
          <div className="flex items-center justify-between py-2 text-ink-secondary">
            <span>Franquia do mês</span>
            <span className="font-semibold text-ink">
              {formatBRL(detail.cotaMensal)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 text-ink-secondary">
            <span>Usado na conta do casal</span>
            <span className="font-medium text-[#BE123C] dark:text-rose-400">
              -{formatBRL(detail.gastosIndividuaisEmConjunta)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 text-ink-secondary">
            <span>Pago do próprio bolso</span>
            <span className="font-medium text-[#0F766E] dark:text-emerald-400">
              +{formatBRL(detail.gastosConjuntosEmIndividual)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="font-semibold text-ink">Disponível livre</span>
            <span
              className={`text-base font-semibold tracking-[-0.02em] ${
                detail.saldoDisponivel >= 0
                  ? "text-[#0F766E] dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatBRL(detail.saldoDisponivel)}
            </span>
          </div>
        </div>
      </div>

      {/* Thin Usage Bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${remainingRatioPct}%`,
              backgroundColor:
                detail.saldoDisponivel >= 0 ? barColor : "#D97706",
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-secondary">
          {detail.status === "DISPONIVEL" ? (
            <>
              Restam{" "}
              <strong className="font-semibold text-ink">
                {formatBRL(detail.saldoDisponivel)}
              </strong>{" "}
              livres neste mês.
            </>
          ) : (
            <>
              Reembolsar{" "}
              <strong className="font-semibold text-amber-700 dark:text-amber-300">
                {formatBRL(detail.valorRestituir)}
              </strong>{" "}
              à conta conjunta.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function CoupleGovernanceModule({
  settlement,
  futureInvoices,
  provisions,
}: CoupleGovernanceModuleProps) {
  const totalAnualProvisoes = roundCurrency(
    provisions.reduce((acc, p) => acc + p.valor_anual_estimado, 0)
  );
  const totalAcumuladoProvisoes = roundCurrency(
    provisions.reduce((acc, p) => acc + p.saldo_acumulado, 0)
  );
  const valorMensalReserva = roundCurrency(totalAnualProvisoes / 12);

  return (
    <section
      aria-label="Mesada Individual e Reserva Anual do Casal"
      className="animate-enter delay-3 grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {/* CARD 1: Mesada Livre de Giovanni e Maria Luiza */}
      <article className="surface-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-7 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-editorial text-xl italic tracking-tight text-ink truncate">
                Mesada Livre Individual &amp; Acerto
              </h2>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Equilíbrio automático entre gastos individuais e despesas conjuntas
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MemberSettlementCard detail={settlement.giovanni} />
            <MemberSettlementCard detail={settlement.mariaLuiza} />
          </div>
        </div>

        {/* Consolidated Settlement Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5 text-xs">
          <span className="text-ink-secondary">Status do acerto mensal</span>
          <span className="font-semibold text-[#0F766E] dark:text-emerald-400 tabular-nums">
            {settlement.resumoTexto}
          </span>
        </div>
      </article>

      {/* CARD 2: Reserva Anual (IPVA / Seguro) & Faturas Futuras */}
      <article className="surface-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-5 min-w-0">
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-editorial text-xl italic tracking-tight text-ink">
                Reserva de Despesas Anuais
              </h2>
              <span className="text-xs font-medium text-ink-secondary tabular-nums">
                Provisão:{" "}
                <strong className="font-semibold text-[#D97706]">
                  {formatBRL(valorMensalReserva)}/mês
                </strong>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Fundo anual para IPVA, seguro automotivo e revisões programadas
            </p>

            <div className="mt-4 divide-y divide-hairline">
              {provisions.map((prov) => {
                const mensal = roundCurrency(prov.valor_anual_estimado / 12);
                const pct =
                  prov.valor_anual_estimado > 0
                    ? roundCurrency(
                        (prov.saldo_acumulado / prov.valor_anual_estimado) * 100
                      )
                    : 0;
                const clampedPct = Math.min(100, Math.max(0, pct));

                return (
                  <div
                    key={prov.item}
                    className="py-3 first:pt-0 last:pb-0 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-ink truncate">
                          {prov.item}
                        </span>
                        <span className="surface-subtle rounded px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
                          {getMonthNameByNumber(prov.mes_vencimento)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-[11px] text-ink-muted">
                          ({formatBRL(mensal)}/mês)
                        </span>
                        <span className="font-semibold text-ink">
                          {formatBRL(prov.saldo_acumulado)}
                        </span>
                        <span className="text-ink-muted">
                          / {formatBRL(prov.valor_anual_estimado)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                        <div
                          className="h-full rounded-full bg-[#D97706] transition-all duration-300"
                          style={{ width: `${clampedPct}%` }}
                        />
                      </div>
                      <span className="w-11 text-right text-[11px] font-medium text-ink-secondary tabular-nums">
                        {formatPct(pct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximas Faturas Compact Summary */}
          {futureInvoices.length > 0 && (
            <div className="border-t border-hairline pt-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
                  Comprometimento nas Próximas Faturas
                </h3>
                <span className="text-[11px] text-ink-muted tabular-nums">
                  {futureInvoices.length} meses
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {futureInvoices.slice(0, 3).map((proj) => (
                  <div
                    key={proj.yearMonth}
                    className="rounded-xl border border-hairline bg-[var(--bg-subtle)]/25 p-2.5 text-xs tabular-nums"
                  >
                    <p className="truncate text-[11px] font-medium text-ink-secondary">
                      {formatYearMonthLabel(proj.yearMonth)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-ink">
                      {formatBRL(proj.totalCommitted)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-hairline pt-3.5 text-xs text-ink-secondary tabular-nums">
          <span>
            Acumulado:{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(totalAcumuladoProvisoes)}
            </strong>
          </span>
          <span>
            Meta anual:{" "}
            <strong className="font-semibold text-ink">
              {formatBRL(totalAnualProvisoes)}
            </strong>
          </span>
        </div>
      </article>
    </section>
  );
}
