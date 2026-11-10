import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { splitInstallmentsWithBillingCycle } from "@/lib/domain/financial-engine";
import {
  CategorySchema,
  FlowTypeSchema,
  InvestmentAssetSchema,
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

  // 2. Modo DEMO explícito ou fallback quando GAS_URL não está configurado
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
      const fallback = getOrInitDemoStore();
      return NextResponse.json(
        {
          ...fallback,
          timestamp: new Date().toISOString(),
          mode: "DEMO" as const,
          isConnectedToSheets: false,
          warning: "Falha ao consultar Google Apps Script; exibindo dataset Demo.",
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

    const demoFallback = getOrInitDemoStore();
    return NextResponse.json(
      {
        transacoes: Array.isArray(data.transacoes) ? data.transacoes : [],
        investimentos: Array.isArray(data.investimentos)
          ? data.investimentos
          : [],
        provisoes: Array.isArray(data.provisoes) ? data.provisoes : [],
        config: Array.isArray(data.config) ? data.config : [],
        ativos: Array.isArray(data.ativos)
          ? data.ativos
          : demoFallback.ativos ?? [],
        recebiveis: Array.isArray(data.recebiveis)
          ? data.recebiveis
          : demoFallback.recebiveis ?? [],
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
    const fallback = getOrInitDemoStore();
    return NextResponse.json(
      {
        ...fallback,
        timestamp: new Date().toISOString(),
        mode: "DEMO" as const,
        isConnectedToSheets: false,
        warning:
          "Não foi possível conectar ao Google Apps Script; operando em modo Demo local.",
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
