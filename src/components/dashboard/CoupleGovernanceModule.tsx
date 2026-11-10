"use client";

import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  HeartHandshake,
  Info,
  ShieldCheck,
} from "lucide-react";
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
  const accentBorder = isGiovanni
    ? "border-rose-400/25 bg-rose-500/[0.06]"
    : "border-pink-400/25 bg-pink-500/[0.06]";
  const accentBadge = isGiovanni
    ? "bg-rose-500/20 text-rose-100 border-rose-400/35"
    : "bg-pink-500/20 text-pink-100 border-pink-400/35";
  const barColor = isGiovanni ? "#FB7185" : "#F472B6";

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
    <div
      className={`flex flex-col justify-between rounded-xl border p-4 min-w-0 ${accentBorder}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${accentBadge}`}
          >
            {detail.usuario}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              detail.status === "DISPONIVEL"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/15 text-amber-200"
            }`}
          >
            {detail.status === "DISPONIVEL" ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>Mesada em Dia</span>
              </>
            ) : (
              <>
                <Info className="h-3 w-3" />
                <span>Devolver à Conta do Casal</span>
              </>
            )}
          </span>
        </div>

        {/* Simple Breakdown */}
        <div className="mt-3.5 space-y-2 text-xs tabular-nums">
          <div className="flex items-center justify-between text-rose-100/80">
            <span>Mesada livre combinada no mês:</span>
            <span className="font-semibold text-white">
              {formatBRL(detail.cotaMensal)}
            </span>
          </div>

          <div className="flex items-center justify-between text-rose-100/80">
            <span>(-) Gastos pessoais pagos na conta do casal:</span>
            <span className="font-medium text-rose-200">
              - {formatBRL(detail.gastosIndividuaisEmConjunta)}
            </span>
          </div>

          <div className="flex items-center justify-between text-rose-100/80">
            <span>(+) Contas do casal pagas do próprio bolso:</span>
            <span className="font-medium text-emerald-300">
              + {formatBRL(detail.gastosConjuntosEmIndividual)}
            </span>
          </div>

          <div className="border-t border-rose-500/20 pt-2 flex items-center justify-between">
            <span className="font-semibold text-white">
              (=) Disponível para gastar livremente:
            </span>
            <span
              className={`text-base font-bold ${
                detail.saldoDisponivel >= 0
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {formatBRL(detail.saldoDisponivel)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar & Friendly Message */}
      <div className="mt-3.5 pt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-rose-500/15">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${remainingRatioPct}%`,
              backgroundColor:
                detail.saldoDisponivel >= 0 ? barColor : "#F59E0B",
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-rose-100/85">
          {detail.status === "DISPONIVEL" ? (
            <>
              Ainda tem <strong>{formatBRL(detail.saldoDisponivel)}</strong>{" "}
              livres para usar como quiser neste mês.
            </>
          ) : (
            <>
              Passou{" "}
              <strong className="text-amber-300">
                {formatBRL(detail.valorRestituir)}
              </strong>{" "}
              da mesada — basta transferir esse valor de volta para a conta do
              casal.
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
      className="animate-enter delay-4 grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {/* CARD 1: Mesada Livre Individual & Acerto do Casal */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20 lg:col-span-6 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300">
                  <HeartHandshake className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-white truncate">
                  Mesada Livre Individual & Acerto do Casal
                </h2>
              </div>
              <p className="mt-1 text-xs text-rose-200/75">
                Acompanhamento simples do valor mensal livre de cada um sem
                precisar fazer contas de cabeça
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MemberSettlementCard detail={settlement.giovanni} />
            <MemberSettlementCard detail={settlement.mariaLuiza} />
          </div>
        </div>

        {/* Consolidated Settlement Banner */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-rose-500/15 bg-[#120910]/80 px-3.5 py-2.5 text-xs">
          <span className="font-medium text-rose-200/80 truncate">
            Resumo do mês:
          </span>
          <span className="font-semibold text-emerald-300 tabular-nums text-right">
            {settlement.resumoTexto}
          </span>
        </div>
      </article>

      {/* CARD 2: Reserva Anual (IPVA / Seguro) & Próximas Faturas */}
      <article className="flex flex-col justify-between rounded-2xl border border-rose-500/20 bg-[#1B0E18] p-5 shadow-lg shadow-rose-950/20 lg:col-span-6 min-w-0">
        <div className="space-y-5">
          {/* Sub-section A: Reserva Anual Programada */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-white">
                  Caixinha p/ Despesas Anuais (IPVA, Seguro e Revisão)
                </h2>
              </div>
              <span className="text-[11px] text-rose-100 tabular-nums">
                Guardar por mês:{" "}
                <strong className="text-amber-300">
                  {formatBRL(valorMensalReserva)}/mês
                </strong>
              </span>
            </div>
            <p className="mt-1 text-xs text-rose-200/75">
              Guardando um pouquinho todo mês para pagar à vista e sem sustos
            </p>

            <div className="mt-3 space-y-2">
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
                    className="rounded-xl border border-rose-500/15 bg-[#120910]/70 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">
                          {prov.item}
                        </span>
                        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          Vence em {getMonthNameByNumber(prov.mes_vencimento)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-[11px] text-rose-200/70">
                          {formatBRL(mensal)}/mês
                        </span>
                        <span className="font-semibold text-white">
                          {formatBRL(prov.saldo_acumulado)}
                        </span>
                        <span className="text-rose-200/60">
                          de {formatBRL(prov.valor_anual_estimado)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rose-500/15">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${clampedPct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-[11px] font-medium text-amber-300 tabular-nums">
                        {formatPct(pct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-section B: Próximas Faturas do Cartão */}
          <div className="border-t border-rose-500/15 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-200 truncate">
                  Resumo das Próximas Faturas por Cartão
                </h3>
              </div>
              <span className="shrink-0 rounded-full border border-rose-400/25 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-200 tabular-nums">
                {futureInvoices.length} meses seguintes
              </span>
            </div>

            {futureInvoices.length === 0 ? (
              <div className="mt-2.5 rounded-xl border border-rose-500/15 bg-[#120910]/50 p-3 text-xs text-rose-200/70">
                Nenhuma fatura futura pendente após {settlement.yearMonth}.
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 max-h-44 overflow-y-auto pr-1">
                {futureInvoices.slice(0, 6).map((proj) => (
                  <div
                    key={proj.yearMonth}
                    className="rounded-xl border border-rose-500/15 bg-[#120910]/70 p-3 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white truncate">
                        {formatYearMonthLabel(proj.yearMonth)}
                      </span>
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-200 tabular-nums">
                        {proj.installments.length} parc.
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-rose-300 tabular-nums">
                      {formatBRL(proj.totalCommitted)}
                    </p>
                    <div className="mt-2 space-y-1 border-t border-rose-500/15 pt-1.5 text-[11px] tabular-nums">
                      {Object.entries(proj.byAccount).map(([conta, val]) => (
                        <div
                          key={conta}
                          className="flex items-center justify-between gap-1 text-rose-200/75"
                        >
                          <span className="inline-flex items-center gap-1 truncate">
                            <CreditCard className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                            <span className="truncate">{conta}</span>
                          </span>
                          <span className="text-white shrink-0">
                            {formatBRL(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-rose-500/15 pt-3 text-[11px] text-rose-200/75 tabular-nums">
          <span>Já guardado p/ despesas anuais: {formatBRL(totalAcumuladoProvisoes)}</span>
          <span>Meta anual: {formatBRL(totalAnualProvisoes)}</span>
        </div>
      </article>
    </section>
  );
}
