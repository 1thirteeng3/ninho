"use client";

import React, { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type {
  AssetType,
  Category,
  CoupleConfig,
  DashboardPayload,
  Member,
} from "@/lib/domain/types";
import { AssetTypeSchema } from "@/lib/domain/types";
import { formatBRL } from "@/lib/formatters";

interface OnboardingSetupModalProps {
  open: boolean;
  payload: DashboardPayload;
  yearMonth: string;
  isFirstAccess: boolean;
  onClose: () => void;
  onDataChanged: () => Promise<void> | void;
}

type StepId = "CASAL" | "LANCAMENTOS" | "PARCELAS" | "METAS" | "ANUAIS";

const STEPS: readonly { id: StepId; label: string }[] = [
  { id: "CASAL", label: "1. Casal & Cartões" },
  { id: "LANCAMENTOS", label: "2. Renda & Já Pago" },
  { id: "PARCELAS", label: "3. Parcelas" },
  { id: "METAS", label: "4. Metas & Ativos" },
  { id: "ANUAIS", label: "5. Despesas Anuais" },
];

const EXPENSE_CATEGORIES: readonly Category[] = [
  "Habitação & Fixos",
  "Carro",
  "Saúde",
  "Estudos (Custeio)",
  "Lazer",
  "Cota Individual",
];

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const INPUT =
  "surface-card w-full rounded-xl px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-[#EC4899] focus:outline-none";
const LABEL = "block text-[11px] font-semibold text-ink-secondary mb-1";
const BTN =
  "pressable inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-[#1F0D18] bg-[#FF3B9A] px-4 py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#1F0D18] disabled:opacity-50";

function toNumber(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function postAction(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "LIVE", ...body }),
  });
  if (!res.ok) {
    throw new Error("Não foi possível salvar. Tente novamente.");
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

export function OnboardingSetupModal({
  open,
  payload,
  yearMonth,
  isFirstAccess,
  onClose,
  onDataChanged,
}: OnboardingSetupModalProps) {
  const [step, setStep] = useState<StepId>("CASAL");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Passo 1
  const findCfg = (m: Member): CoupleConfig | undefined =>
    payload.config.find((c) => c.usuario === m);
  const [cfg, setCfg] = useState<Record<Member, [string, string, string]>>(
    () => ({
      Giovanni: [
        String(findCfg("Giovanni")?.cota_mensal_livre ?? 0),
        String(findCfg("Giovanni")?.dia_fechamento_cartao ?? 1),
        String(findCfg("Giovanni")?.dia_vencimento_cartao ?? 10),
      ],
      "Maria Luiza": [
        String(findCfg("Maria Luiza")?.cota_mensal_livre ?? 0),
        String(findCfg("Maria Luiza")?.dia_fechamento_cartao ?? 1),
        String(findCfg("Maria Luiza")?.dia_vencimento_cartao ?? 10),
      ],
    })
  );

  // Passo 2
  const [txKind, setTxKind] = useState<"ENTRADA" | "DESPESA">("ENTRADA");
  const [txDesc, setTxDesc] = useState("");
  const [txValue, setTxValue] = useState("");
  const [txDate, setTxDate] = useState(today);
  const [txAccount, setTxAccount] = useState("Conta Conjunta");
  const [txMember, setTxMember] = useState<Member>("Giovanni");
  const [txCategory, setTxCategory] = useState<Category>("Habitação & Fixos");

  // Passo 3
  const [pDesc, setPDesc] = useState("");
  const [pValue, setPValue] = useState("");
  const [pValueIsTotal, setPValueIsTotal] = useState(false);
  const [pCount, setPCount] = useState("10");
  const [pPaid, setPPaid] = useState("0");
  const [pNext, setPNext] = useState(today);
  const [pAccount, setPAccount] = useState("Cartão");
  const [pCategory, setPCategory] = useState<Category>("Habitação & Fixos");
  const [pMember, setPMember] = useState<Member>("Giovanni");

  const [rDesc, setRDesc] = useState("");
  const [rPayer, setRPayer] = useState("");
  const [rTotal, setRTotal] = useState("");
  const [rCount, setRCount] = useState("2");
  const [rReceived, setRReceived] = useState("0");
  const [rNext, setRNext] = useState(today);
  const [rAccount, setRAccount] = useState("Conta Conjunta");
  const [rReceiver, setRReceiver] = useState<"Casal" | Member>("Casal");

  // Passo 4
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gType, setGType] = useState<"PATRIMONIO" | "OBJETIVO_CONSUMO">(
    "PATRIMONIO"
  );
  const [aName, setAName] = useState("");
  const [aType, setAType] = useState<AssetType>("CDB");
  const [aYield, setAYield] = useState("");
  const [aLiquidity, setALiquidity] = useState("Diária");
  const [aBank, setABank] = useState("");
  const [aGoal, setAGoal] = useState("");
  const [aOwner, setAOwner] = useState<"Casal" | Member>("Casal");
  const [aApplied, setAApplied] = useState("");
  const [aBalance, setABalance] = useState("");

  // Passo 5
  const [vItem, setVItem] = useState("");
  const [vYear, setVYear] = useState("");
  const [vMonth, setVMonth] = useState("1");
  const [vSaved, setVSaved] = useState("0");

  if (!open) return null;

  async function run(
    task: () => Promise<void>,
    successMsg: string,
    after?: () => void
  ) {
    setBusy(true);
    try {
      await task();
      toast.success(successMsg);
      after?.();
      await onDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function saveCouple(e: React.FormEvent) {
    e.preventDefault();
    const members: Member[] = ["Giovanni", "Maria Luiza"];
    const config = members.map((m) => ({
      usuario: m,
      cota_mensal_livre: Math.max(0, toNumber(cfg[m][0]) || 0),
      dia_fechamento_cartao: Math.min(31, Math.max(1, parseInt(cfg[m][1], 10) || 1)),
      dia_vencimento_cartao: Math.min(31, Math.max(1, parseInt(cfg[m][2], 10) || 10)),
    }));
    void run(
      () => postAction({ action: "SAVE_COUPLE_CONFIG", config }),
      "Configurações do casal salvas!"
    );
  }

  function saveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const value = toNumber(txValue);
    if (!txDesc.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Informe descrição e valor válidos.");
      return;
    }
    const isIncome = txKind === "ENTRADA";
    void run(
      () =>
        postAction({
          data_competencia: txDate,
          data_caixa: txDate,
          tipo_fluxo: isIncome ? "RENDA" : "CUSTO",
          categoria: isIncome ? "Salário / Renda" : txCategory,
          descricao: txDesc.trim(),
          valor: isIncome ? value : -value,
          conta: txAccount.trim() || "Conta Conjunta",
          pago_por: txMember,
          escopo: "CONJUNTO",
          total_parcelas: 1,
        }),
      isIncome ? "Entrada registrada!" : "Despesa registrada!",
      () => {
        setTxDesc("");
        setTxValue("");
      }
    );
  }

  function savePayablePlan(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(pCount, 10);
    const paid = parseInt(pPaid, 10) || 0;
    const raw = toNumber(pValue);
    if (!pDesc.trim() || !Number.isFinite(raw) || raw <= 0 || !(count >= 2)) {
      toast.error("Informe descrição, valor e ao menos 2 parcelas.");
      return;
    }
    if (paid > count) {
      toast.error("Parcelas já pagas não pode ser maior que o total.");
      return;
    }
    const total = pValueIsTotal ? raw : raw * count;
    void run(
      () =>
        postAction({
          action: "CREATE_ONGOING_PLAN",
          descricao: pDesc.trim(),
          valor_total: Math.round(total * 100) / 100,
          total_parcelas: count,
          parcelas_pagas: paid,
          proximo_vencimento: pNext,
          conta: pAccount.trim() || "Cartão",
          categoria: pCategory,
          pago_por: pMember,
        }),
      "Parcelamento cadastrado!",
      () => {
        setPDesc("");
        setPValue("");
        setPPaid("0");
      }
    );
  }

  function saveReceivable(e: React.FormEvent) {
    e.preventDefault();
    const total = toNumber(rTotal);
    const count = parseInt(rCount, 10) || 1;
    const received = Math.min(count, parseInt(rReceived, 10) || 0);
    if (!rDesc.trim() || !Number.isFinite(total) || total <= 0) {
      toast.error("Informe descrição e valor total válidos.");
      return;
    }
    void run(
      () =>
        postAction({
          action: "UPSERT_RECEIVABLE",
          receivable: {
            id: `rec_${Date.now()}`,
            descricao: rDesc.trim(),
            pagador_origem: rPayer.trim() || "Terceiro",
            recebedor: rReceiver,
            valor_total: Math.round(total * 100) / 100,
            total_parcelas: count,
            parcelas_recebidas: received,
            proximo_vencimento: rNext,
            conta_destino: rAccount.trim() || "Conta Conjunta",
            status: received >= count ? "CONCLUIDO" : "EM_ANDAMENTO",
          },
        }),
      "Valor a receber cadastrado!",
      () => {
        setRDesc("");
        setRPayer("");
        setRTotal("");
        setRReceived("0");
      }
    );
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    const target = toNumber(gTarget);
    if (!gName.trim() || !Number.isFinite(target) || target <= 0) {
      toast.error("Informe nome e valor alvo da meta.");
      return;
    }
    void run(
      () =>
        postAction({
          action: "UPSERT_GOAL",
          goal: {
            id_meta: `meta_${Date.now()}`,
            nome: gName.trim(),
            tipo: gType,
            valor_alvo: Math.round(target * 100) / 100,
            total_aportado: 0,
            saldo_bruto_atual: 0,
          },
        }),
      "Meta criada!",
      () => {
        setGName("");
        setGTarget("");
      }
    );
  }

  function saveAsset(e: React.FormEvent) {
    e.preventDefault();
    const applied = toNumber(aApplied);
    const balance = toNumber(aBalance || aApplied);
    if (!aName.trim() || !Number.isFinite(applied) || applied < 0) {
      toast.error("Informe nome e valor aplicado do ativo.");
      return;
    }
    void run(
      () =>
        postAction({
          action: "UPSERT_ASSET",
          asset: {
            id: `asset_${Date.now()}`,
            nome: aName.trim(),
            tipo_ativo: aType,
            rendimento: aYield.trim() || "100% do CDI",
            liquidez: aLiquidity.trim() || "Diária",
            instituicao: aBank.trim() || "Banco",
            meta_vinculada: aGoal || (payload.investimentos[0]?.nome ?? ""),
            titular: aOwner,
            valor_aportado: Math.round(applied * 100) / 100,
            saldo_atual: Math.round((Number.isFinite(balance) ? balance : applied) * 100) / 100,
          },
        }),
      "Ativo cadastrado!",
      () => {
        setAName("");
        setAApplied("");
        setABalance("");
      }
    );
  }

  function saveProvision(e: React.FormEvent) {
    e.preventDefault();
    const yearly = toNumber(vYear);
    if (!vItem.trim() || !Number.isFinite(yearly) || yearly <= 0) {
      toast.error("Informe o nome e o valor anual da despesa.");
      return;
    }
    void run(
      () =>
        postAction({
          action: "UPSERT_PROVISION",
          provision: {
            item: vItem.trim(),
            categoria_pai: "Fundo Anual (Carro/Impostos)",
            valor_anual_estimado: Math.round(yearly * 100) / 100,
            mes_vencimento: vMonth,
            saldo_acumulado: Math.max(0, toNumber(vSaved) || 0),
          },
        }),
      "Despesa anual salva!",
      () => {
        setVItem("");
        setVYear("");
        setVSaved("0");
      }
    );
  }

  function removeItem(body: Record<string, unknown>, msg: string) {
    void run(() => postAction(body), msg);
  }

  function clearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    void run(
      () => postAction({ action: "CLEAR_ALL_DATA" }),
      "Todos os dados foram zerados."
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1F0D18]/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Configuração inicial do Ninho"
    >
      <div className="surface-card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[var(--border-strong)] px-6 py-4">
          <div>
            <h2 className="font-editorial text-2xl italic text-ink">
              {isFirstAccess ? "Bem-vindos ao Ninho" : "Configurações do Ninho"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Preencha o que quiser, na ordem que preferir — dá para voltar aqui
              a qualquer momento pelo botão &quot;Configurar&quot;.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-lg p-1 text-ink-muted hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-hairline px-6 py-3">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`pressable shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                step === s.id
                  ? "border-2 border-[#1F0D18] bg-[#FF3B9A] text-white shadow-[2px_2px_0px_#1F0D18]"
                  : "surface-card text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {step === "CASAL" && (
            <form onSubmit={saveCouple} className="space-y-5">
              <p className="text-xs text-ink-secondary">
                A <strong>mesada</strong> é quanto cada um pode gastar livremente por mês.
                Os dias do cartão servem para saber em qual fatura cada compra cai.
              </p>
              {(["Giovanni", "Maria Luiza"] as Member[]).map((m) => (
                <div key={m} className="rounded-xl border border-hairline p-4">
                  <h3 className="mb-3 text-sm font-bold text-ink">{m}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Mesada mensal (R$)">
                      <input
                        className={INPUT}
                        inputMode="decimal"
                        value={cfg[m][0]}
                        onChange={(e) =>
                          setCfg({ ...cfg, [m]: [e.target.value, cfg[m][1], cfg[m][2]] })
                        }
                      />
                    </Field>
                    <Field label="Dia que o cartão fecha">
                      <input
                        className={INPUT}
                        inputMode="numeric"
                        value={cfg[m][1]}
                        onChange={(e) =>
                          setCfg({ ...cfg, [m]: [cfg[m][0], e.target.value, cfg[m][2]] })
                        }
                      />
                    </Field>
                    <Field label="Dia que a fatura vence">
                      <input
                        className={INPUT}
                        inputMode="numeric"
                        value={cfg[m][2]}
                        onChange={(e) =>
                          setCfg({ ...cfg, [m]: [cfg[m][0], cfg[m][1], e.target.value] })
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button type="submit" className={BTN} disabled={busy}>
                <Check className="h-3.5 w-3.5" /> Salvar casal e cartões
              </button>
            </form>
          )}

          {step === "LANCAMENTOS" && (
            <form onSubmit={saveTransaction} className="space-y-4">
              <p className="text-xs text-ink-secondary">
                Registre salários e contas que <strong>já foram pagas</strong> (este mês ou
                meses anteriores). Você tem {payload.transacoes.length} lançamento(s) até agora.
              </p>
              <div className="flex gap-2">
                {(["ENTRADA", "DESPESA"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTxKind(k)}
                    className={`pressable rounded-full px-4 py-1.5 text-xs font-semibold ${
                      txKind === k
                        ? "border-2 border-[#1F0D18] bg-[#FF3B9A] text-white"
                        : "surface-card text-ink"
                    }`}
                  >
                    {k === "ENTRADA" ? "↑ Entrada / Salário" : "↓ Despesa já paga"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Descrição">
                  <input className={INPUT} value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="Ex: Salário, Aluguel, Mercado" />
                </Field>
                <Field label="Valor (R$)">
                  <input className={INPUT} inputMode="decimal" value={txValue} onChange={(e) => setTxValue(e.target.value)} />
                </Field>
                <Field label="Data">
                  <input type="date" className={INPUT} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                </Field>
                <Field label="Conta / cartão">
                  <input className={INPUT} value={txAccount} onChange={(e) => setTxAccount(e.target.value)} />
                </Field>
                <Field label={txKind === "ENTRADA" ? "Quem recebeu" : "Quem pagou"}>
                  <select className={INPUT} value={txMember} onChange={(e) => setTxMember(e.target.value as Member)}>
                    <option>Giovanni</option>
                    <option>Maria Luiza</option>
                  </select>
                </Field>
                {txKind === "DESPESA" && (
                  <Field label="Categoria">
                    <select className={INPUT} value={txCategory} onChange={(e) => setTxCategory(e.target.value as Category)}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <button type="submit" className={BTN} disabled={busy}>
                <Check className="h-3.5 w-3.5" /> Adicionar lançamento
              </button>
            </form>
          )}

          {step === "PARCELAS" && (
            <div className="space-y-8">
              <form onSubmit={savePayablePlan} className="space-y-4">
                <h3 className="text-sm font-bold text-ink">Compras parceladas a pagar (em andamento)</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="O que foi comprado">
                    <input className={INPUT} value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
                  </Field>
                  <Field label={pValueIsTotal ? "Valor total (R$)" : "Valor de cada parcela (R$)"}>
                    <input className={INPUT} inputMode="decimal" value={pValue} onChange={(e) => setPValue(e.target.value)} />
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-ink-secondary sm:col-span-2">
                    <input type="checkbox" checked={pValueIsTotal} onChange={(e) => setPValueIsTotal(e.target.checked)} />
                    O valor informado é o total da compra (e não o da parcela)
                  </label>
                  <Field label="Total de parcelas">
                    <input className={INPUT} inputMode="numeric" value={pCount} onChange={(e) => setPCount(e.target.value)} />
                  </Field>
                  <Field label="Quantas já foram pagas">
                    <input className={INPUT} inputMode="numeric" value={pPaid} onChange={(e) => setPPaid(e.target.value)} />
                  </Field>
                  <Field label="Vencimento da próxima parcela">
                    <input type="date" className={INPUT} value={pNext} onChange={(e) => setPNext(e.target.value)} />
                  </Field>
                  <Field label="Cartão / conta">
                    <input className={INPUT} value={pAccount} onChange={(e) => setPAccount(e.target.value)} />
                  </Field>
                  <Field label="Categoria">
                    <select className={INPUT} value={pCategory} onChange={(e) => setPCategory(e.target.value as Category)}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quem paga">
                    <select className={INPUT} value={pMember} onChange={(e) => setPMember(e.target.value as Member)}>
                      <option>Giovanni</option>
                      <option>Maria Luiza</option>
                    </select>
                  </Field>
                </div>
                <button type="submit" className={BTN} disabled={busy}>
                  <Check className="h-3.5 w-3.5" /> Cadastrar parcelamento
                </button>
              </form>

              <form onSubmit={saveReceivable} className="space-y-4 border-t border-hairline pt-6">
                <h3 className="text-sm font-bold text-ink">
                  Valores a receber ({(payload.recebiveis ?? []).length} cadastrado(s))
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="O que vai receber">
                    <input className={INPUT} value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
                  </Field>
                  <Field label="Quem vai pagar">
                    <input className={INPUT} value={rPayer} onChange={(e) => setRPayer(e.target.value)} />
                  </Field>
                  <Field label="Valor total (R$)">
                    <input className={INPUT} inputMode="decimal" value={rTotal} onChange={(e) => setRTotal(e.target.value)} />
                  </Field>
                  <Field label="Total de parcelas">
                    <input className={INPUT} inputMode="numeric" value={rCount} onChange={(e) => setRCount(e.target.value)} />
                  </Field>
                  <Field label="Quantas já recebeu">
                    <input className={INPUT} inputMode="numeric" value={rReceived} onChange={(e) => setRReceived(e.target.value)} />
                  </Field>
                  <Field label="Próximo vencimento">
                    <input type="date" className={INPUT} value={rNext} onChange={(e) => setRNext(e.target.value)} />
                  </Field>
                  <Field label="Conta de destino">
                    <input className={INPUT} value={rAccount} onChange={(e) => setRAccount(e.target.value)} />
                  </Field>
                  <Field label="Quem recebe">
                    <select className={INPUT} value={rReceiver} onChange={(e) => setRReceiver(e.target.value as "Casal" | Member)}>
                      <option>Casal</option>
                      <option>Giovanni</option>
                      <option>Maria Luiza</option>
                    </select>
                  </Field>
                </div>
                <button type="submit" className={BTN} disabled={busy}>
                  <Check className="h-3.5 w-3.5" /> Cadastrar valor a receber
                </button>
              </form>
            </div>
          )}

          {step === "METAS" && (
            <div className="space-y-8">
              <form onSubmit={saveGoal} className="space-y-4">
                <h3 className="text-sm font-bold text-ink">Metas do casal</h3>
                <div className="space-y-1.5">
                  {payload.investimentos.map((g) => (
                    <div key={g.id_meta} className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2 text-xs">
                      <span className="font-semibold text-ink">
                        {g.nome} · alvo {formatBRL(g.valor_alvo)}
                      </span>
                      <button type="button" onClick={() => removeItem({ action: "DELETE_GOAL", id: g.id_meta }, "Meta removida.")} className="text-ink-muted hover:text-ink" aria-label="Remover meta">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Nome da meta">
                    <input className={INPUT} value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Ex: Casa, Viagem" />
                  </Field>
                  <Field label="Valor alvo (R$)">
                    <input className={INPUT} inputMode="decimal" value={gTarget} onChange={(e) => setGTarget(e.target.value)} />
                  </Field>
                  <Field label="Tipo">
                    <select className={INPUT} value={gType} onChange={(e) => setGType(e.target.value as "PATRIMONIO" | "OBJETIVO_CONSUMO")}>
                      <option value="PATRIMONIO">Patrimônio (guardar)</option>
                      <option value="OBJETIVO_CONSUMO">Objetivo (gastar depois)</option>
                    </select>
                  </Field>
                </div>
                <button type="submit" className={BTN} disabled={busy}>
                  <Check className="h-3.5 w-3.5" /> Criar meta
                </button>
              </form>

              <form onSubmit={saveAsset} className="space-y-4 border-t border-hairline pt-6">
                <h3 className="text-sm font-bold text-ink">
                  Ativos de investimento ({(payload.ativos ?? []).length} cadastrado(s))
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nome do ativo">
                    <input className={INPUT} value={aName} onChange={(e) => setAName(e.target.value)} />
                  </Field>
                  <Field label="Tipo">
                    <select className={INPUT} value={aType} onChange={(e) => setAType(e.target.value as AssetType)}>
                      {AssetTypeSchema.options.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quanto rende">
                    <input className={INPUT} value={aYield} onChange={(e) => setAYield(e.target.value)} placeholder="Ex: 110% do CDI" />
                  </Field>
                  <Field label="Liquidez">
                    <input className={INPUT} value={aLiquidity} onChange={(e) => setALiquidity(e.target.value)} />
                  </Field>
                  <Field label="Instituição">
                    <input className={INPUT} value={aBank} onChange={(e) => setABank(e.target.value)} />
                  </Field>
                  <Field label="Meta vinculada">
                    <select className={INPUT} value={aGoal} onChange={(e) => setAGoal(e.target.value)}>
                      <option value="">(primeira meta)</option>
                      {payload.investimentos.map((g) => (
                        <option key={g.id_meta} value={String(g.nome)}>
                          {String(g.nome)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="De quem é">
                    <select className={INPUT} value={aOwner} onChange={(e) => setAOwner(e.target.value as "Casal" | Member)}>
                      <option>Casal</option>
                      <option>Giovanni</option>
                      <option>Maria Luiza</option>
                    </select>
                  </Field>
                  <Field label="Valor aplicado (R$)">
                    <input className={INPUT} inputMode="decimal" value={aApplied} onChange={(e) => setAApplied(e.target.value)} />
                  </Field>
                  <Field label="Saldo atual (R$)">
                    <input className={INPUT} inputMode="decimal" value={aBalance} onChange={(e) => setABalance(e.target.value)} placeholder="Igual ao aplicado se vazio" />
                  </Field>
                </div>
                <button type="submit" className={BTN} disabled={busy}>
                  <Check className="h-3.5 w-3.5" /> Cadastrar ativo
                </button>
              </form>
            </div>
          )}

          {step === "ANUAIS" && (
            <div className="space-y-6">
              <form onSubmit={saveProvision} className="space-y-4">
                <p className="text-xs text-ink-secondary">
                  Gastos que vêm uma vez por ano (IPVA, seguro, IPTU...). O Ninho divide por 12 para vocês
                  separarem um pouco todo mês.
                </p>
                <div className="space-y-1.5">
                  {payload.provisoes.map((p) => (
                    <div key={p.item} className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2 text-xs">
                      <span className="font-semibold text-ink">
                        {p.item} · {formatBRL(p.valor_anual_estimado)}/ano
                      </span>
                      <button type="button" onClick={() => removeItem({ action: "DELETE_PROVISION", item: p.item }, "Despesa anual removida.")} className="text-ink-muted hover:text-ink" aria-label="Remover despesa anual">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nome">
                    <input className={INPUT} value={vItem} onChange={(e) => setVItem(e.target.value)} placeholder="Ex: IPVA" />
                  </Field>
                  <Field label="Valor anual (R$)">
                    <input className={INPUT} inputMode="decimal" value={vYear} onChange={(e) => setVYear(e.target.value)} />
                  </Field>
                  <Field label="Mês de vencimento">
                    <select className={INPUT} value={vMonth} onChange={(e) => setVMonth(e.target.value)}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Já separado até agora (R$)">
                    <input className={INPUT} inputMode="decimal" value={vSaved} onChange={(e) => setVSaved(e.target.value)} />
                  </Field>
                </div>
                <button type="submit" className={BTN} disabled={busy}>
                  <Check className="h-3.5 w-3.5" /> Salvar despesa anual
                </button>
              </form>

              <div className="rounded-xl border-2 border-dashed border-[#1F0D18]/40 p-4">
                <h3 className="text-sm font-bold text-ink">Começar do zero</h3>
                <p className="mt-1 text-xs text-ink-secondary">
                  Apaga todos os lançamentos, metas, ativos, parcelas e despesas anuais da planilha. Não dá para desfazer.
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={busy}
                  className="pressable mt-3 rounded-full border-2 border-[#1F0D18] bg-white px-4 py-2 text-xs font-bold text-[#831843] disabled:opacity-50"
                >
                  {confirmClear ? "Clique de novo para confirmar" : "Zerar todos os dados"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t-2 border-[var(--border-strong)] px-6 py-3">
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)]!.id)}
            className="pressable text-xs font-semibold text-ink-secondary disabled:opacity-40"
          >
            ← Anterior
          </button>
          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1]!.id)}
              className={BTN}
            >
              Próximo →
            </button>
          ) : (
            <button type="button" onClick={onClose} className={BTN}>
              Concluir e ver o painel ({yearMonth})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
