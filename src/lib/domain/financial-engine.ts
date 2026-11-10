import type {
  Category,
  CoupleConfig,
  FlowType,
  Member,
  Scope,
  Transaction,
  ViewMode,
} from "./types";

const COST_CATEGORIES: readonly Category[] = [
  "Habitação & Fixos",
  "Carro",
  "Saúde",
  "Estudos (Custeio)",
  "Lazer",
  "Cota Individual",
];

const INVESTMENT_CATEGORIES: readonly Category[] = [
  "Casa",
  "Estudos (Fundo Futuro)",
  "Viagem",
  "Reserva & Patrimônio",
];

const CREDIT_CARD_KEYWORDS = [
  "nubank",
  "itau",
  "itaú",
  "inter",
  "cartao",
  "cartão",
  "credito",
  "crédito",
  "xp",
  "c6",
  "bradesco",
  "santander",
  "btg",
];

export interface CategoryAllocationItem {
  categoria: Category;
  valor: number;
  percentualRenda: number;
}

export interface MacroAllocationSlice {
  id: string;
  label: string;
  valor: number;
  percentualRenda: number;
  tipo: FlowType | "SALDO_LIVRE";
}

export interface IncomeAllocationResult {
  yearMonth: string;
  viewMode: ViewMode;
  rendaTotal: number;
  custosTotal: number;
  investimentosTotal: number;
  provisoesTotal: number;
  saldoResidual: number;
  percentualCustos: number;
  percentualInvestimentos: number;
  percentualProvisoes: number;
  categoriasCusto: CategoryAllocationItem[];
  categoriasInvestimento: CategoryAllocationItem[];
  macroSlices: MacroAllocationSlice[];
}

export interface MemberSettlementDetail {
  usuario: Member;
  cotaMensal: number;
  gastosIndividuaisEmConjunta: number;
  gastosConjuntosEmIndividual: number;
  saldoDisponivel: number;
  status: "DISPONIVEL" | "RESTITUIR_CAIXA";
  valorRestituir: number;
}

export interface CoupleSettlementResult {
  yearMonth: string;
  viewMode: ViewMode;
  giovanni: MemberSettlementDetail;
  mariaLuiza: MemberSettlementDetail;
  resumoTexto: string;
}

export interface SplitInstallmentsInput {
  id_base?: string;
  data_competencia: string;
  data_caixa?: string;
  tipo_fluxo: FlowType;
  categoria: Category;
  descricao: string;
  valor: number;
  conta: string;
  pago_por: Member;
  escopo: Scope;
  total_parcelas: number;
  id_plano_parcelas?: string;
}

export interface FutureInvoiceMonthProjection {
  yearMonth: string;
  totalCommitted: number;
  byAccount: Record<string, number>;
  installments: Transaction[];
}

/**
 * Arredonda valores monetários para 2 casas decimais com precisão de centavos.
 */
export function roundCurrency(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const rounded = Math.round((abs + Number.EPSILON) * 100) / 100;
  const result = sign * rounded;
  return Object.is(result, -0) ? 0 : result;
}

function safePercentage(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return roundCurrency((Math.abs(part) / total) * 100);
}

/**
 * Filtra transações pelo mês de referência ("YYYY-MM") segundo o regime selecionado:
 * - "CAIXA": usa `data_caixa`
 * - "COMPETENCIA": usa `data_competencia`
 */
export function filterTransactionsByMonth(
  transactions: Transaction[],
  yearMonth: string,
  viewMode: ViewMode
): Transaction[] {
  const prefix = yearMonth.trim().slice(0, 7);
  return transactions.filter((tx) => {
    const targetDate =
      viewMode === "CAIXA" ? tx.data_caixa : tx.data_competencia;
    return targetDate.startsWith(prefix);
  });
}

/**
 * Equação de Alocação Descritiva da Renda (Post-Mortem — Seção 4.2.1 de arquitetura.txt).
 * Nunca emite bloqueios punitivos e nunca retorna NaN quando R_m = 0.
 */
export function calculateIncomeAllocation(
  transactions: Transaction[],
  yearMonth: string,
  viewMode: ViewMode
): IncomeAllocationResult {
  const monthTxs = filterTransactionsByMonth(transactions, yearMonth, viewMode);

  let rendaTotal = 0;
  let provisoesTotal = 0;

  const costMap = new Map<Category, number>();
  for (const cat of COST_CATEGORIES) {
    costMap.set(cat, 0);
  }

  const investmentMap = new Map<Category, number>();
  for (const cat of INVESTMENT_CATEGORIES) {
    investmentMap.set(cat, 0);
  }

  for (const tx of monthTxs) {
    const absVal = Math.abs(tx.valor);
    if (tx.tipo_fluxo === "RENDA") {
      rendaTotal = roundCurrency(rendaTotal + absVal);
    } else if (tx.tipo_fluxo === "PROVISAO_ANUAL") {
      provisoesTotal = roundCurrency(provisoesTotal + absVal);
    } else if (tx.tipo_fluxo === "CUSTO") {
      const prev = costMap.get(tx.categoria) ?? 0;
      costMap.set(tx.categoria, roundCurrency(prev + absVal));
    } else if (tx.tipo_fluxo === "INVESTIMENTO") {
      const prev = investmentMap.get(tx.categoria) ?? 0;
      investmentMap.set(tx.categoria, roundCurrency(prev + absVal));
    }
  }

  const categoriasCusto: CategoryAllocationItem[] = Array.from(
    costMap.entries()
  ).map(([categoria, valor]) => ({
    categoria,
    valor: roundCurrency(valor),
    percentualRenda: safePercentage(valor, rendaTotal),
  }));

  const categoriasInvestimento: CategoryAllocationItem[] = Array.from(
    investmentMap.entries()
  ).map(([categoria, valor]) => ({
    categoria,
    valor: roundCurrency(valor),
    percentualRenda: safePercentage(valor, rendaTotal),
  }));

  const custosTotal = roundCurrency(
    categoriasCusto.reduce((acc, item) => acc + item.valor, 0)
  );
  const investimentosTotal = roundCurrency(
    categoriasInvestimento.reduce((acc, item) => acc + item.valor, 0)
  );

  const saldoResidual = roundCurrency(
    rendaTotal - (custosTotal + provisoesTotal + investimentosTotal)
  );

  const percentualCustos = safePercentage(custosTotal, rendaTotal);
  const percentualInvestimentos = safePercentage(investimentosTotal, rendaTotal);
  const percentualProvisoes = safePercentage(provisoesTotal, rendaTotal);

  const macroSlices: MacroAllocationSlice[] = [
    ...categoriasCusto
      .filter((c) => c.valor > 0)
      .map((c) => ({
        id: `custo_${c.categoria}`,
        label: c.categoria,
        valor: c.valor,
        percentualRenda: c.percentualRenda,
        tipo: "CUSTO" as const,
      })),
    ...(investimentosTotal > 0
      ? [
          {
            id: "macro_investimentos",
            label: "Investimentos",
            valor: investimentosTotal,
            percentualRenda: percentualInvestimentos,
            tipo: "INVESTIMENTO" as const,
          },
        ]
      : []),
    ...(provisoesTotal > 0
      ? [
          {
            id: "macro_provisoes",
            label: "Provisões Anuais (Sinking Funds)",
            valor: provisoesTotal,
            percentualRenda: percentualProvisoes,
            tipo: "PROVISAO_ANUAL" as const,
          },
        ]
      : []),
    ...(saldoResidual > 0
      ? [
          {
            id: "macro_saldo_livre",
            label: "Saldo Livre Não Alocado",
            valor: saldoResidual,
            percentualRenda: safePercentage(saldoResidual, rendaTotal),
            tipo: "SALDO_LIVRE" as const,
          },
        ]
      : []),
  ];

  return {
    yearMonth,
    viewMode,
    rendaTotal,
    custosTotal,
    investimentosTotal,
    provisoesTotal,
    saldoResidual,
    percentualCustos,
    percentualInvestimentos,
    percentualProvisoes,
    categoriasCusto,
    categoriasInvestimento,
    macroSlices,
  };
}

function isExplicitlyPersonalAccount(accountName: string): boolean {
  const lower = accountName.trim().toLowerCase();
  return (
    lower.includes("individual") ||
    lower.includes("pessoal") ||
    lower.includes("cota ja separada") ||
    lower.includes("cota já separada") ||
    lower.includes("externa")
  );
}

function isJointAccount(accountName: string): boolean {
  const lower = accountName.trim().toLowerCase();
  return lower.includes("conjunta") || lower.includes("conjunto");
}

function computeMemberSettlement(
  member: Member,
  quota: number,
  monthTxs: Transaction[]
): MemberSettlementDetail {
  const targetScope: Scope =
    member === "Giovanni" ? "INDIVIDUAL_GIOVANNI" : "INDIVIDUAL_MARIA_LUIZA";

  let indEmConj = 0;
  let conjEmInd = 0;

  for (const tx of monthTxs) {
    if (tx.tipo_fluxo !== "CUSTO") {
      continue;
    }

    const absVal = Math.abs(tx.valor);
    const isPersonalTxForMember =
      tx.escopo === targetScope ||
      (tx.categoria === "Cota Individual" &&
        tx.escopo === "CONJUNTO" &&
        tx.pago_por === member);

    if (isPersonalTxForMember) {
      // No regime de Caixa Único com Cota Individual, gastos individuais do membro
      // pagos em conta conjunta, pagos pelo outro cônjuge ou lançados no caixa único
      // consomem a franquia mensal Q_u (exceto se pagos com conta externa já descontada).
      const paidWithAlreadySeparatedExternalMoney =
        tx.pago_por === member &&
        !isJointAccount(tx.conta) &&
        (tx.conta.toLowerCase().includes("externa") ||
          tx.conta.toLowerCase().includes("cota separada"));

      if (!paidWithAlreadySeparatedExternalMoney) {
        indEmConj = roundCurrency(indEmConj + absVal);
      }
    } else if (
      tx.escopo === "CONJUNTO" &&
      tx.pago_por === member &&
      isExplicitlyPersonalAccount(tx.conta)
    ) {
      // Gasto de escopo CONJUNTO pago com recursos já separados da conta/cota estritamente INDIVIDUAL do membro
      conjEmInd = roundCurrency(conjEmInd + absVal);
    }
  }

  const saldoDisponivel = roundCurrency(quota - indEmConj + conjEmInd);
  const status = saldoDisponivel >= 0 ? "DISPONIVEL" : "RESTITUIR_CAIXA";
  const valorRestituir =
    saldoDisponivel < 0 ? roundCurrency(Math.abs(saldoDisponivel)) : 0;

  return {
    usuario: member,
    cotaMensal: roundCurrency(quota),
    gastosIndividuaisEmConjunta: indEmConj,
    gastosConjuntosEmIndividual: conjEmInd,
    saldoDisponivel,
    status,
    valorRestituir,
  };
}

/**
 * Algoritmo de Reconciliação do Casal — Caixa Único + Cota Individual (Seção 4.2.2 de arquitetura.txt).
 * Calcula L_{u,m} = Q_u - D_{u,m}^{ind_em_conj} + D_{u,m}^{conj_em_ind} para Giovanni e Maria Luiza.
 */
export function calculateCoupleSettlement(
  transactions: Transaction[],
  configs: CoupleConfig[],
  yearMonth: string,
  viewMode: ViewMode
): CoupleSettlementResult {
  const monthTxs = filterTransactionsByMonth(transactions, yearMonth, viewMode);

  const giovanniQuota =
    configs.find((c) => c.usuario === "Giovanni")?.cota_mensal_livre ?? 400;
  const mariaLuizaQuota =
    configs.find((c) => c.usuario === "Maria Luiza")?.cota_mensal_livre ?? 400;

  const giovanni = computeMemberSettlement("Giovanni", giovanniQuota, monthTxs);
  const mariaLuiza = computeMemberSettlement(
    "Maria Luiza",
    mariaLuizaQuota,
    monthTxs
  );

  const pendencias: string[] = [];
  if (giovanni.status === "RESTITUIR_CAIXA") {
    pendencias.push(
      `Giovanni deve restituir R$ ${giovanni.valorRestituir.toFixed(2)} ao caixa conjunto`
    );
  }
  if (mariaLuiza.status === "RESTITUIR_CAIXA") {
    pendencias.push(
      `Maria Luiza deve restituir R$ ${mariaLuiza.valorRestituir.toFixed(2)} ao caixa conjunto`
    );
  }

  const resumoTexto =
    pendencias.length > 0
      ? pendencias.join(" • ")
      : "Nenhum repasse pendente ao caixa conjunto";

  return {
    yearMonth,
    viewMode,
    giovanni,
    mariaLuiza,
    resumoTexto,
  };
}

function parseISODateParts(isoDate: string): {
  year: number;
  monthIndex: number;
  day: number;
} {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && match[1] && match[2] && match[3]) {
    return {
      year: parseInt(match[1], 10),
      monthIndex: parseInt(match[2], 10) - 1,
      day: parseInt(match[3], 10),
    };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    day: now.getDate(),
  };
}

function formatClampedISODate(
  year: number,
  monthIndex: number,
  day: number
): string {
  const targetMonthDate = new Date(year, monthIndex, 1, 12, 0, 0);
  const resolvedYear = targetMonthDate.getFullYear();
  const resolvedMonthIndex = targetMonthDate.getMonth();
  const lastDayOfMonth = new Date(
    resolvedYear,
    resolvedMonthIndex + 1,
    0
  ).getDate();
  const clampedDay = Math.min(Math.max(1, day), lastDayOfMonth);

  const yyyy = String(resolvedYear).padStart(4, "0");
  const mm = String(resolvedMonthIndex + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isCreditCardAccount(accountName: string): boolean {
  const lower = accountName.trim().toLowerCase();
  if (!lower) return false;
  if (
    lower.includes("pix") ||
    lower.includes("dinheiro") ||
    lower.includes("debito") ||
    lower.includes("débito") ||
    lower.includes("corrente")
  ) {
    return false;
  }
  return CREDIT_CARD_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Motor de Desdobramento Temporal de Cartão de Crédito (Competência vs. Caixa — Seção 4.2.3).
 * Divide uma transação em N parcelas exatas (ajustando residual de centavos na parcela 1)
 * e projeta `data_caixa` considerando o dia de fechamento e vencimento do cartão.
 */
export function splitInstallmentsWithBillingCycle(
  input: SplitInstallmentsInput,
  cardConfig?: CoupleConfig
): Transaction[] {
  const totalParcelas = Math.max(1, Math.floor(input.total_parcelas || 1));
  const absTotal = roundCurrency(Math.abs(input.valor));

  const sign =
    input.tipo_fluxo === "CUSTO" || input.tipo_fluxo === "PROVISAO_ANUAL"
      ? -1
      : input.tipo_fluxo === "RENDA" || input.tipo_fluxo === "INVESTIMENTO"
        ? 1
        : input.valor < 0
          ? -1
          : 1;

  const baseInstallment = roundCurrency(absTotal / totalParcelas);
  const residual = roundCurrency(absTotal - baseInstallment * totalParcelas);

  const compParts = parseISODateParts(input.data_competencia);
  const dataCompetenciaISO = formatClampedISODate(
    compParts.year,
    compParts.monthIndex,
    compParts.day
  );

  const useCardCycle =
    Boolean(cardConfig) &&
    (totalParcelas > 1 || isCreditCardAccount(input.conta));

  const delta0 =
    useCardCycle &&
    cardConfig &&
    compParts.day >= cardConfig.dia_fechamento_cartao
      ? 1
      : 0;

  const baseId = input.id_base ?? "tx_plan";
  const planId =
    totalParcelas > 1 ? (input.id_plano_parcelas ?? `plan_${baseId}`) : "";

  const results: Transaction[] = [];

  for (let i = 1; i <= totalParcelas; i++) {
    const unitAmount =
      i === 1 ? roundCurrency(baseInstallment + residual) : baseInstallment;
    const signedAmount = roundCurrency(sign * unitAmount);

    let dataCaixaISO: string;
    if (useCardCycle && cardConfig) {
      const monthOffset = delta0 + (i - 1);
      dataCaixaISO = formatClampedISODate(
        compParts.year,
        compParts.monthIndex + monthOffset,
        cardConfig.dia_vencimento_cartao
      );
    } else {
      const baseCashParts = input.data_caixa
        ? parseISODateParts(input.data_caixa)
        : compParts;
      dataCaixaISO = formatClampedISODate(
        baseCashParts.year,
        baseCashParts.monthIndex + (i - 1),
        baseCashParts.day
      );
    }

    const descricao =
      totalParcelas > 1
        ? `${input.descricao.trim()} (${i}/${totalParcelas})`
        : input.descricao.trim();

    results.push({
      id: `${baseId}_${i}`,
      data_competencia: dataCompetenciaISO,
      data_caixa: dataCaixaISO,
      tipo_fluxo: input.tipo_fluxo,
      categoria: input.categoria,
      descricao,
      valor: signedAmount,
      conta: input.conta,
      pago_por: input.pago_por,
      escopo: input.escopo,
      parcela_atual: i,
      total_parcelas: totalParcelas,
      id_plano_parcelas: planId,
    });
  }

  return results;
}

/**
 * Radar de Passivos Futuros: agrupa transações de CUSTO com `data_caixa` posterior
 * ao mês corrente (`currentYearMonth`) por mês (`YYYY-MM`) e por conta/cartão.
 */
export function projectFutureInvoices(
  transactions: Transaction[],
  currentYearMonth: string
): FutureInvoiceMonthProjection[] {
  const cutoff = currentYearMonth.trim().slice(0, 7);
  const grouped = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.tipo_fluxo !== "CUSTO") {
      continue;
    }
    const txYearMonth = tx.data_caixa.trim().slice(0, 7);
    if (txYearMonth > cutoff) {
      const list = grouped.get(txYearMonth) ?? [];
      list.push(tx);
      grouped.set(txYearMonth, list);
    }
  }

  const sortedMonths = Array.from(grouped.keys()).sort();

  return sortedMonths.map((yearMonth) => {
    const installments = grouped.get(yearMonth) ?? [];
    const byAccount: Record<string, number> = {};
    let totalCommitted = 0;

    for (const tx of installments) {
      const absVal = roundCurrency(Math.abs(tx.valor));
      totalCommitted = roundCurrency(totalCommitted + absVal);
      const accCurrent = byAccount[tx.conta] ?? 0;
      byAccount[tx.conta] = roundCurrency(accCurrent + absVal);
    }

    return {
      yearMonth,
      totalCommitted,
      byAccount,
      installments,
    };
  });
}
