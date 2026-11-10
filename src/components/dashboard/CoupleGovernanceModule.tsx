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
    ? "border-sky-500/25 bg-sky-500/[0.04]"
    : "border-pink-500/25 bg-pink-500/[0.04]";
  const accentBadge = isGiovanni
    ? "bg-sky-500/20 text-sky-200 border-sky-400/30"
    : "bg-pink-500/20 text-pink-200 border-pink-400/30";
  const barColor = isGiovanni ? "#38BDF8" : "#F472B6";

  const remainingRatioPct =
    detail.cotaMensal > 0
      ? Math.min(
          100,
          Math.max(0, roundCurrency((detail.saldoDisponivel / detail.cotaMensal) * 100))
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
                <span>Cota Disponível</span>
              </>
            ) : (
              <>
                <Info className="h-3 w-3" />
                <span>Restituir Caixa</span>
              </>
            )}
          </span>
        </div>

        {/* Live Equation Breakdown */}
        <div className="mt-3.5 space-y-2 text-xs tabular-nums">
          <div className="flex items-center justify-between text-slate-300">
            <span>Franquia Mensal Livre (Q_u):</span>
            <span className="font-semibold text-white">
              {formatBRL(detail.cotaMensal)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>(-) Gastos Individuais no Caixa Conjunto:</span>
            <span className="font-medium text-slate-200">
              - {formatBRL(detail.gastosIndividuaisEmConjunta)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>(+) Gastos Conjuntos Pagos na Conta Individual:</span>
            <span className="font-medium text-emerald-300">
              + {formatBRL(detail.gastosConjuntosEmIndividual)}
            </span>
          </div>

          <div className="border-t border-white/10 pt-2 flex items-center justify-between">
            <span className="font-semibold text-white">
              (=) Disponibilidade Líquida (L_u,m):
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

      {/* Progress Bar & Settlement Instruction */}
      <div className="mt-3.5 pt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${remainingRatioPct}%`,
              backgroundColor:
                detail.saldoDisponivel >= 0 ? barColor : "#F59E0B",
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-300">
          {detail.status === "DISPONIVEL" ? (
            <>
              Restam <strong>{formatBRL(detail.saldoDisponivel)}</strong> livres
              para gastos pessoais sem necessidade de repasse.
            </>
          ) : (
            <>
              Franquia superada em{" "}
              <strong className="text-amber-300">
                {formatBRL(detail.valorRestituir)}
              </strong>{" "}
              — recompor valor ao caixa conjunto.
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
  const cotaMensalConjuntaSinking = roundCurrency(totalAnualProvisoes / 12);

  return (
    <section
      aria-label="Módulo 4: Governança do Casal, Passivos Futuros e Sinking Funds"
      className="animate-enter delay-4 grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {/* CARD 1: Motor de Reconciliação Conjugal (L_{u,m}) */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-5 shadow-lg lg:col-span-6 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-400">
                  <HeartHandshake className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-white truncate">
                  Módulo 4A · Motor de Reconciliação Conjugal (L_u,m)
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Equação viva: L_u,m = Q_u − D_ind_em_conj + D_conj_em_ind
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MemberSettlementCard detail={settlement.giovanni} />
            <MemberSettlementCard detail={settlement.mariaLuiza} />
          </div>
        </div>

        {/* Consolidated Settlement Banner */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#090A0F]/80 px-3.5 py-2.5 text-xs">
          <span className="font-medium text-slate-300 truncate">
            Síntese do Encontro de Contas:
          </span>
          <span className="font-semibold text-emerald-300 tabular-nums text-right">
            {settlement.resumoTexto}
          </span>
        </div>
      </article>

      {/* CARD 2: Radar de Passivos Futuros (Faturas) & Sinking Funds */}
      <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#11131A] p-5 shadow-lg lg:col-span-6 min-w-0">
        <div className="space-y-5">
          {/* Sub-section A: Radar de Passivos Futuros (Faturas de Cartão) */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <CalendarClock className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-white truncate">
                  Módulo 4B · Radar de Passivos Futuros & Sinking Funds
                </h2>
              </div>
              <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 tabular-nums">
                {futureInvoices.length} meses projetados
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Faturas de cartão já comprometidas em meses subsequentes
              (data_caixa &gt; {settlement.yearMonth})
            </p>

            {futureInvoices.length === 0 ? (
              <div className="mt-3 rounded-xl border border-white/[0.05] bg-[#090A0F]/50 p-3.5 text-xs text-slate-400">
                Nenhuma parcela futura pendente após {settlement.yearMonth}.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 max-h-48 overflow-y-auto pr-1">
                {futureInvoices.slice(0, 6).map((proj) => (
                  <div
                    key={proj.yearMonth}
                    className="rounded-xl border border-white/[0.06] bg-[#090A0F]/70 p-3 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white truncate">
                        {formatYearMonthLabel(proj.yearMonth)}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400 tabular-nums">
                        {proj.installments.length} parc.
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-cyan-300 tabular-nums">
                      {formatBRL(proj.totalCommitted)}
                    </p>
                    <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-1.5 text-[11px] tabular-nums">
                      {Object.entries(proj.byAccount).map(([conta, val]) => (
                        <div
                          key={conta}
                          className="flex items-center justify-between gap-1 text-slate-400"
                        >
                          <span className="inline-flex items-center gap-1 truncate">
                            <CreditCard className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{conta}</span>
                          </span>
                          <span className="text-slate-200 shrink-0">
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

          {/* Sub-section B: Provisões Anuais (Sinking Funds 1/12 avos) */}
          <div className="border-t border-white/[0.07] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Provisões Anuais Obrigatórias (Sinking Funds 1/12)
                </h3>
              </div>
              <span className="text-[11px] text-slate-300 tabular-nums">
                Cota 1/12 Ideal:{" "}
                <strong className="text-amber-300">
                  {formatBRL(cotaMensalConjuntaSinking)}/mês
                </strong>
              </span>
            </div>

            <div className="mt-2.5 space-y-2">
              {provisions.map((prov) => {
                const cota12 = roundCurrency(prov.valor_anual_estimado / 12);
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
                    className="rounded-xl border border-white/[0.05] bg-[#090A0F]/60 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">
                          {prov.item}
                        </span>
                        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          Venc: {getMonthNameByNumber(prov.mes_vencimento)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-[11px] text-slate-400">
                          1/12: {formatBRL(cota12)}
                        </span>
                        <span className="font-semibold text-white">
                          {formatBRL(prov.saldo_acumulado)}
                        </span>
                        <span className="text-slate-400">
                          / {formatBRL(prov.valor_anual_estimado)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
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
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400 tabular-nums">
          <span>Fundo Anual Acumulado: {formatBRL(totalAcumuladoProvisoes)}</span>
          <span>Meta Anual Total: {formatBRL(totalAnualProvisoes)}</span>
        </div>
      </article>
    </section>
  );
}
