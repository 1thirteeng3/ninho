import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { splitInstallmentsWithBillingCycle } from "@/lib/domain/financial-engine";
import {
  AnnualProvisionSchema,
  AssetTypeSchema,
  CategorySchema,
  CoupleConfigSchema,
  FlowTypeSchema,
  InvestmentAssetSchema,
  InvestmentGoalSchema,
  MemberSchema,
  ReceivablePlanSchema,
  ScopeSchema,
} from "@/lib/domain/types";
import {
  deleteDemoAsset,
  deleteDemoReceivable,
  deleteDemoTransaction,
  getOrInitDemoStore,
  getWorstCaseDataset,
  getWorstCaseExtraTransactions,
  payNextPayableInstallment,
  prependWorstCaseExtraTransactions,
  receiveNextInstallment,
  resetDemoMemoryStore,
  upsertDemoAsset,
  upsertDemoReceivable,
} from "@/lib/mocks/demo-datasets";

const CreateTransactionRequestSchema = z.object({
  id_base: z.string().optional(),
  data_competencia: z.string().min(8),
  data_caixa: z.string().optional(),
  tipo_fluxo: FlowTypeSchema,
  categoria: CategorySchema,
  descricao: z.string().min(1).max(300),
  valor: z.number().refine((val) => !Number.isNaN(val) && val !== 0, {
    message: "O valor da transação deve ser diferente de zero.",
  }),
  conta: z.string().min(1).max(100).default("Nubank Conjunta"),
  pago_por: MemberSchema,
  escopo: ScopeSchema,
  total_parcelas: z.number().int().min(1).max(120).default(1),
  id_plano_parcelas: z.string().optional(),
  mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
});

const ActionRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SYNC_TASKS"),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("RESET_DEMO"),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("UPSERT_ASSET"),
    asset: InvestmentAssetSchema,
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("DELETE_ASSET"),
    id: z.string().min(1),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("DELETE_TRANSACTION"),
    id: z.string().min(1),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("UPSERT_RECEIVABLE"),
    receivable: ReceivablePlanSchema,
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("RECEIVE_INSTALLMENT"),
    id: z.string().min(1),
    yearMonth: z.string().optional(),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("DELETE_RECEIVABLE"),
    id: z.string().min(1),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("PAY_NEXT_INSTALLMENT"),
    planIdOrTxId: z.string().min(1),
    yearMonth: z.string().optional(),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("SAVE_COUPLE_CONFIG"),
    config: z.array(CoupleConfigSchema).min(1).max(2),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("UPSERT_GOAL"),
    goal: InvestmentGoalSchema,
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("DELETE_GOAL"),
    id: z.string().min(1),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("UPSERT_PROVISION"),
    provision: AnnualProvisionSchema,
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("DELETE_PROVISION"),
    item: z.string().min(1),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("CREATE_ONGOING_PLAN"),
    descricao: z.string().min(1).max(300),
    valor_total: z.number().positive(),
    total_parcelas: z.number().int().min(2).max(120),
    parcelas_pagas: z.number().int().min(0).max(120),
    proximo_vencimento: z.string().min(8),
    conta: z.string().min(1).max(100),
    categoria: CategorySchema,
    pago_por: MemberSchema,
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
  z.object({
    action: z.literal("CLEAR_ALL_DATA"),
    mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
  }),
]);

function buildSecurityHeaders(): HeadersInit {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store, max-age=0",
  };
}

function getConfiguredGasUrl(): string | null {
  const raw = process.env.GAS_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function forwardActionToGasIfLive(
  gasUrl: string | null,
  mode: "LIVE" | "DEMO" | "WORST_CASE" | undefined,
  payload: Record<string, unknown>
): Promise<void> {
  if (!gasUrl || mode !== "LIVE") return;
  try {
    const secretToken = process.env.GAS_SECRET_TOKEN?.trim() ?? "";
    await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        token: secretToken,
      }),
      cache: "no-store",
    });
  } catch {
    // Mantém resiliência caso o webhook demore ou oscile; o store local continua atualizado
  }
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isoDate(v: unknown): string {
  return str(v).slice(0, 10);
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function normalizeRows<T>(raw: unknown, fn: (r: Row) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const r = fn(item as Row);
      if (r) out.push(r);
    }
  }
  return out;
}

const MEMBERS = ["Giovanni", "Maria Luiza"] as const;
const SCOPES = ["CONJUNTO", "INDIVIDUAL_GIOVANNI", "INDIVIDUAL_MARIA_LUIZA"] as const;
const FLOWS = ["RENDA", "CUSTO", "PROVISAO_ANUAL", "INVESTIMENTO", "AJUSTE"] as const;
const OWNERS = ["Casal", "Giovanni", "Maria Luiza"] as const;

function normalizeTransaction(r: Row) {
  if (!str(r.id)) return null;
  return {
    id: str(r.id),
    data_competencia: isoDate(r.data_competencia),
    data_caixa: isoDate(r.data_caixa) || isoDate(r.data_competencia),
    tipo_fluxo: pick(r.tipo_fluxo, FLOWS, "CUSTO"),
    categoria: str(r.categoria) as z.infer<typeof CategorySchema>,
    descricao: str(r.descricao),
    valor: num(r.valor),
    conta: str(r.conta),
    pago_por: pick(r.pago_por, MEMBERS, "Giovanni"),
    escopo: pick(r.escopo, SCOPES, "CONJUNTO"),
    parcela_atual: num(r.parcela_atual) || 1,
    total_parcelas: num(r.total_parcelas) || 1,
    id_plano_parcelas: str(r.id_plano_parcelas),
  };
}

function normalizeGoal(r: Row) {
  if (!str(r.id_meta) && !str(r.nome)) return null;
  return {
    id_meta: str(r.id_meta) || str(r.nome),
    nome: str(r.nome),
    tipo: pick(r.tipo, ["PATRIMONIO", "OBJETIVO_CONSUMO"] as const, "PATRIMONIO"),
    valor_alvo: num(r.valor_alvo),
    total_aportado: num(r.total_aportado),
    saldo_bruto_atual: num(r.saldo_bruto_atual),
  };
}

function normalizeProvision(r: Row) {
  if (!str(r.item)) return null;
  return {
    item: str(r.item),
    categoria_pai: str(r.categoria_pai),
    valor_anual_estimado: num(r.valor_anual_estimado),
    mes_vencimento: str(r.mes_vencimento).padStart(2, "0"),
    saldo_acumulado: num(r.saldo_acumulado),
  };
}

function normalizeConfig(r: Row) {
  const usuario = str(r.usuario);
  if (usuario !== "Giovanni" && usuario !== "Maria Luiza") return null;
  return {
    usuario,
    cota_mensal_livre: num(r.cota_mensal_livre),
    dia_fechamento_cartao: num(r.dia_fechamento_cartao) || 1,
    dia_vencimento_cartao: num(r.dia_vencimento_cartao) || 10,
  };
}

function normalizeAsset(r: Row) {
  if (!str(r.id)) return null;
  return {
    id: str(r.id),
    nome: str(r.nome),
    tipo_ativo: pick(
      r.tipo_ativo,
      AssetTypeSchema.options,
      "Poupança / Outros"
    ),
    rendimento: str(r.rendimento),
    liquidez: str(r.liquidez),
    instituicao: str(r.instituicao),
    meta_vinculada: str(r.meta_vinculada),
    titular: pick(
      str(r.titular) === "Casal" || str(r.titular) === "Conjunto"
        ? "Casal"
        : r.titular,
      OWNERS,
      "Casal"
    ),
    valor_aportado: num(r.valor_aportado),
    saldo_atual: num(r.saldo_atual),
  };
}

function normalizeReceivable(r: Row) {
  if (!str(r.id)) return null;
  const total = Math.max(1, Math.floor(num(r.total_parcelas)) || 1);
  const received = Math.max(0, Math.floor(num(r.parcelas_recebidas)));
  const recebedorRaw = str(r.recebedor) === "Conjunto" ? "Casal" : r.recebedor;
  return {
    id: str(r.id),
    descricao: str(r.descricao),
    pagador_origem: str(r.pagador_origem),
    recebedor: pick(recebedorRaw, OWNERS, "Casal"),
    valor_total: num(r.valor_total),
    total_parcelas: total,
    parcelas_recebidas: received,
    proximo_vencimento: isoDate(r.proximo_vencimento),
    conta_destino: str(r.conta_destino),
    status: received >= total ? ("CONCLUIDO" as const) : ("EM_ANDAMENTO" as const),
  };
}

function emptyPayload() {
  return {
    transacoes: [],
    investimentos: [],
    provisoes: [],
    config: [
      { usuario: "Giovanni", cota_mensal_livre: 0, dia_fechamento_cartao: 1, dia_vencimento_cartao: 10 },
      { usuario: "Maria Luiza", cota_mensal_livre: 0, dia_fechamento_cartao: 1, dia_vencimento_cartao: 10 },
    ],
    ativos: [],
    recebiveis: [],
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const headers = buildSecurityHeaders();
  const { searchParams } = new URL(request.url);
  const requestedMode = searchParams.get("mode")?.toUpperCase();
  const action = searchParams.get("action");
  const gasUrl = getConfiguredGasUrl();
  const isConnectedToSheets = Boolean(gasUrl);

  // 1. Modo Stress-Test (Worst Case — break-ui)
  if (requestedMode === "WORST_CASE") {
    const baseWorst = getWorstCaseDataset();
    const demoStore = getOrInitDemoStore();
    return NextResponse.json(
      {
        ...baseWorst,
        ativos: demoStore.ativos ?? baseWorst.ativos ?? [],
        recebiveis: demoStore.recebiveis ?? baseWorst.recebiveis ?? [],
        transacoes: [
          ...getWorstCaseExtraTransactions(),
          ...baseWorst.transacoes,
        ],
        timestamp: new Date().toISOString(),
        mode: "WORST_CASE" as const,
        isConnectedToSheets,
      },
      { status: 200, headers }
    );
  }

  // 2a. Produção sem planilha configurada: painel vazio (sem dados fictícios)
  if (requestedMode === "LIVE" && !gasUrl) {
    return NextResponse.json(
      {
        ...emptyPayload(),
        mode: "LIVE" as const,
        isConnectedToSheets: false,
        warning: "Planilha não configurada (GAS_URL ausente).",
      },
      { status: 200, headers }
    );
  }

  // 2b. Modo DEMO explícito ou fallback quando GAS_URL não está configurado
  if (requestedMode === "DEMO" || !gasUrl) {
    const store = getOrInitDemoStore();
    return NextResponse.json(
      {
        ...store,
        timestamp: new Date().toISOString(),
        mode: "DEMO" as const,
        isConnectedToSheets,
      },
      { status: 200, headers }
    );
  }

  // 3. Modo LIVE conectado ao Google Apps Script (Server-only secret token)
  try {
    const targetUrl = new URL(gasUrl);
    const secretToken = process.env.GAS_SECRET_TOKEN?.trim();
    if (secretToken) {
      targetUrl.searchParams.set("token", secretToken);
    }
    if (action === "sync") {
      targetUrl.searchParams.set("action", "sync");
    }

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ...emptyPayload(),
          mode: "LIVE" as const,
          isConnectedToSheets: false,
          warning: "Falha ao consultar a planilha. Tente atualizar novamente.",
        },
        { status: 200, headers }
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.status === "ERROR") {
      return NextResponse.json(
        {
          status: "ERROR",
          message: "Erro retornado pela planilha Google Sheets.",
        },
        { status: 502, headers }
      );
    }

    return NextResponse.json(
      {
        transacoes: normalizeRows(data.transacoes, normalizeTransaction),
        investimentos: normalizeRows(data.investimentos, normalizeGoal),
        provisoes: normalizeRows(data.provisoes, normalizeProvision),
        config: normalizeRows(data.config, normalizeConfig),
        ativos: normalizeRows(data.ativos, normalizeAsset),
        recebiveis: normalizeRows(data.recebiveis, normalizeReceivable),
        syncedTasks:
          typeof data.syncedTasks === "number" ? data.syncedTasks : 0,
        timestamp:
          typeof data.timestamp === "string"
            ? data.timestamp
            : new Date().toISOString(),
        mode: "LIVE" as const,
        isConnectedToSheets: true,
      },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      {
        ...emptyPayload(),
        mode: "LIVE" as const,
        isConnectedToSheets: false,
        warning: "Não foi possível conectar à planilha no momento.",
      },
      { status: 200, headers }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = buildSecurityHeaders();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Payload JSON inválido.",
      },
      { status: 400, headers }
    );
  }

  const gasUrl = getConfiguredGasUrl();

  // 1. Verificar se é uma ação de controle / mutação de ativos, logs ou recebíveis
  const actionParse = ActionRequestSchema.safeParse(rawBody);
  if (actionParse.success) {
    const parsedAction = actionParse.data;

    if (parsedAction.action === "RESET_DEMO") {
      const freshStore = resetDemoMemoryStore();
      return NextResponse.json(
        {
          status: "SUCCESS",
          message: "Dados restaurados para o estado original.",
          transacoesCount: freshStore.transacoes.length,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "UPSERT_ASSET") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "UPSERT_ASSET",
        asset: parsedAction.asset,
      });
      const updated = upsertDemoAsset(parsedAction.asset);
      return NextResponse.json(
        {
          status: "SUCCESS",
          ativos: updated.ativos,
          investimentos: updated.investimentos,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "DELETE_ASSET") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "DELETE_ASSET",
        assetId: parsedAction.id,
      });
      const updated = deleteDemoAsset(parsedAction.id);
      return NextResponse.json(
        {
          status: "SUCCESS",
          ativos: updated.ativos,
          investimentos: updated.investimentos,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "DELETE_TRANSACTION") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "DELETE_TRANSACTION",
        transactionId: parsedAction.id,
      });
      const updated = deleteDemoTransaction(parsedAction.id);
      return NextResponse.json(
        {
          status: "SUCCESS",
          transacoesCount: updated.transacoes.length,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "UPSERT_RECEIVABLE") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "UPSERT_RECEIVABLE",
        receivable: parsedAction.receivable,
      });
      const updated = upsertDemoReceivable(parsedAction.receivable);
      return NextResponse.json(
        {
          status: "SUCCESS",
          recebiveis: updated.recebiveis,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "RECEIVE_INSTALLMENT") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "RECEIVE_INSTALLMENT",
        receivableId: parsedAction.id,
      });
      const result = receiveNextInstallment(
        parsedAction.id,
        parsedAction.yearMonth ?? "2026-11"
      );
      return NextResponse.json(
        {
          status: "SUCCESS",
          updatedReceivable: result.updatedReceivable,
          createdTransaction: result.createdTransaction,
          recebiveis: result.store.recebiveis,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "DELETE_RECEIVABLE") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "DELETE_RECEIVABLE",
        receivableId: parsedAction.id,
      });
      const updated = deleteDemoReceivable(parsedAction.id);
      return NextResponse.json(
        {
          status: "SUCCESS",
          recebiveis: updated.recebiveis,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "PAY_NEXT_INSTALLMENT") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "PAY_NEXT_INSTALLMENT",
        planId: parsedAction.planIdOrTxId,
        referenceMonth: parsedAction.yearMonth ?? "2026-11",
      });
      const result = payNextPayableInstallment(
        parsedAction.planIdOrTxId,
        parsedAction.yearMonth ?? "2026-11"
      );
      return NextResponse.json(
        {
          status: "SUCCESS",
          paidTransaction: result.paidTransaction,
        },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "SAVE_COUPLE_CONFIG") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "SAVE_COUPLE_CONFIG",
        config: parsedAction.config,
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "UPSERT_GOAL") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "UPSERT_GOAL",
        goal: parsedAction.goal,
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "DELETE_GOAL") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "DELETE_GOAL",
        goalId: parsedAction.id,
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "UPSERT_PROVISION") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "UPSERT_PROVISION",
        provision: parsedAction.provision,
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "DELETE_PROVISION") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "DELETE_PROVISION",
        item: parsedAction.item,
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "CLEAR_ALL_DATA") {
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "CLEAR_ALL_DATA",
      });
      return NextResponse.json({ status: "SUCCESS" }, { status: 200, headers });
    }

    if (parsedAction.action === "CREATE_ONGOING_PLAN") {
      const [yy, mm, dd] = parsedAction.proximo_vencimento
        .slice(0, 10)
        .split("-")
        .map((p) => parseInt(p, 10));
      if (!yy || !mm || !dd) {
        return NextResponse.json(
          { status: "ERROR", message: "Data da próxima parcela inválida." },
          { status: 422, headers }
        );
      }
      const firstMonthIndex = mm - 1 - parsedAction.parcelas_pagas;
      const firstDate = new Date(yy, firstMonthIndex, 1, 12, 0, 0);
      const firstIso = `${String(firstDate.getFullYear()).padStart(4, "0")}-${String(
        firstDate.getMonth() + 1
      ).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const baseId = `tx_${Date.now()}`;
      const rows = splitInstallmentsWithBillingCycle({
        id_base: baseId,
        data_competencia: firstIso,
        data_caixa: firstIso,
        tipo_fluxo: "CUSTO",
        categoria: parsedAction.categoria,
        descricao: parsedAction.descricao,
        valor: -Math.abs(parsedAction.valor_total),
        conta: parsedAction.conta,
        pago_por: parsedAction.pago_por,
        escopo: "CONJUNTO",
        total_parcelas: parsedAction.total_parcelas,
        id_plano_parcelas: `plan_${baseId}`,
      });
      await forwardActionToGasIfLive(gasUrl, parsedAction.mode, {
        action: "APPEND_TRANSACTIONS",
        rows,
      });
      return NextResponse.json(
        { status: "SUCCESS", count: rows.length },
        { status: 200, headers }
      );
    }

    if (parsedAction.action === "SYNC_TASKS") {
      const { mode } = parsedAction;
      if (gasUrl && mode !== "DEMO" && mode !== "WORST_CASE") {
        try {
          const secretToken = process.env.GAS_SECRET_TOKEN?.trim() ?? "";
          const gasRes = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "SYNC_TASKS",
              token: secretToken,
            }),
            cache: "no-store",
          });
          const gasJson = (await gasRes.json()) as Record<string, unknown>;
          return NextResponse.json(
            {
              status: "SUCCESS",
              syncedTasks:
                typeof gasJson.syncedTasks === "number"
                  ? gasJson.syncedTasks
                  : 0,
              mode: "LIVE",
            },
            { status: 200, headers }
          );
        } catch {
          return NextResponse.json(
            {
              status: "ERROR",
              message: "Falha ao sincronizar Google Tasks no Apps Script.",
            },
            { status: 502, headers }
          );
        }
      }

      return NextResponse.json(
        {
          status: "SUCCESS",
          syncedTasks: 0,
          mode: mode ?? "DEMO",
          message:
            "Sincronização concluída em modo de demonstração.",
        },
        { status: 200, headers }
      );
    }
  }

  // 2. Validação do payload de criação de transação na fronteira (Zod)
  const txParse = CreateTransactionRequestSchema.safeParse(rawBody);
  if (!txParse.success) {
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Dados de transação inválidos.",
        issues: txParse.error.flatten(),
      },
      { status: 422, headers }
    );
  }

  const txInput = txParse.data;
  const effectiveMode = txInput.mode ?? (gasUrl ? "LIVE" : "DEMO");

  // 3. Se estiver em modo LIVE com GAS_URL configurado, encaminha de forma segura ao Apps Script
  if (effectiveMode === "LIVE" && gasUrl) {
    try {
      const secretToken = process.env.GAS_SECRET_TOKEN?.trim() ?? "";
      const gasResponse = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...txInput,
          token: secretToken,
        }),
        cache: "no-store",
      });

      if (!gasResponse.ok) {
        return NextResponse.json(
          {
            status: "ERROR",
            message: "Erro de comunicação com o Google Apps Script.",
          },
          { status: 502, headers }
        );
      }

      const result = (await gasResponse.json()) as Record<string, unknown>;
      if (result.status === "ERROR") {
        return NextResponse.json(
          {
            status: "ERROR",
            message:
              typeof result.message === "string"
                ? result.message
                : "Erro ao gravar na planilha.",
          },
          { status: 502, headers }
        );
      }

      return NextResponse.json(
        {
          status: "SUCCESS",
          count: typeof result.count === "number" ? result.count : 1,
          ids: Array.isArray(result.ids) ? result.ids : [],
          id_plano_parcelas:
            typeof result.id_plano_parcelas === "string"
              ? result.id_plano_parcelas
              : "",
          mode: "LIVE",
        },
        { status: 201, headers }
      );
    } catch {
      return NextResponse.json(
        {
          status: "ERROR",
          message: "Falha ao enviar transação para o Google Apps Script.",
        },
        { status: 502, headers }
      );
    }
  }

  // 4. Modo interativo em memória (DEMO ou WORST_CASE): desdobra parcelas 1..N via motor financeiro
  const store = getOrInitDemoStore();
  const memberConfig = store.config.find(
    (c) => c.usuario === txInput.pago_por
  );
  const baseId = txInput.id_base ?? `tx_mem_${Date.now()}`;

  const parcelas = splitInstallmentsWithBillingCycle(
    {
      id_base: baseId,
      data_competencia: txInput.data_competencia,
      data_caixa: txInput.data_caixa,
      tipo_fluxo: txInput.tipo_fluxo,
      categoria: txInput.categoria,
      descricao: txInput.descricao,
      valor: txInput.valor,
      conta: txInput.conta,
      pago_por: txInput.pago_por,
      escopo: txInput.escopo,
      total_parcelas: txInput.total_parcelas,
      id_plano_parcelas: txInput.id_plano_parcelas,
    },
    memberConfig
  );

  if (effectiveMode === "WORST_CASE") {
    prependWorstCaseExtraTransactions(parcelas);
  } else {
    store.transacoes = [...parcelas, ...store.transacoes];
    store.timestamp = new Date().toISOString();
  }

  return NextResponse.json(
    {
      status: "SUCCESS",
      count: parcelas.length,
      createdTransactions: parcelas,
      ids: parcelas.map((p) => p.id),
      id_plano_parcelas: parcelas[0]?.id_plano_parcelas ?? "",
      mode: effectiveMode,
    },
    { status: 201, headers }
  );
}
