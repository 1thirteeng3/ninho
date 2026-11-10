import { roundCurrency } from "./financial-engine";
import type { Category, FlowType, Member, Scope } from "./types";

export interface QuickEntryParseResult {
  isValid: boolean;
  rawInput: string;
  data_competencia: string;
  tipo_fluxo: FlowType;
  categoria: Category;
  descricao: string;
  valor: number;
  valorAbsoluto: number;
  conta: string;
  pago_por: Member;
  escopo: Scope;
  total_parcelas: number;
}

const HASHTAG_MAP: Record<string, { categoria: Category; tipo_fluxo: FlowType }> =
  {
    lazer: { categoria: "Lazer", tipo_fluxo: "CUSTO" },
    carro: { categoria: "Carro", tipo_fluxo: "CUSTO" },
    saude: { categoria: "Saúde", tipo_fluxo: "CUSTO" },
    habitacao: { categoria: "Habitação & Fixos", tipo_fluxo: "CUSTO" },
    fixos: { categoria: "Habitação & Fixos", tipo_fluxo: "CUSTO" },
    custeio: { categoria: "Estudos (Custeio)", tipo_fluxo: "CUSTO" },
    estudos: { categoria: "Estudos (Custeio)", tipo_fluxo: "CUSTO" },
    individual: { categoria: "Cota Individual", tipo_fluxo: "CUSTO" },
    cota: { categoria: "Cota Individual", tipo_fluxo: "CUSTO" },
    provisao: {
      categoria: "Fundo Anual (Carro/Impostos)",
      tipo_fluxo: "PROVISAO_ANUAL",
    },
    ipva: {
      categoria: "Fundo Anual (Carro/Impostos)",
      tipo_fluxo: "PROVISAO_ANUAL",
    },
    casa: { categoria: "Casa", tipo_fluxo: "INVESTIMENTO" },
    futuro: {
      categoria: "Estudos (Fundo Futuro)",
      tipo_fluxo: "INVESTIMENTO",
    },
    mba: {
      categoria: "Estudos (Fundo Futuro)",
      tipo_fluxo: "INVESTIMENTO",
    },
    viagem: { categoria: "Viagem", tipo_fluxo: "INVESTIMENTO" },
    reserva: {
      categoria: "Reserva & Patrimônio",
      tipo_fluxo: "INVESTIMENTO",
    },
    patrimonio: {
      categoria: "Reserva & Patrimônio",
      tipo_fluxo: "INVESTIMENTO",
    },
    renda: { categoria: "Salário / Renda", tipo_fluxo: "RENDA" },
    salario: { categoria: "Salário / Renda", tipo_fluxo: "RENDA" },
    ajuste: { categoria: "Ajuste de Caixa", tipo_fluxo: "AJUSTE" },
  };

const ACCOUNT_TAG_MAP: Record<string, string> = {
  nubank: "Nubank",
  nu: "Nubank",
  itau: "Itaú",
  inter: "Inter",
  dinheiro: "Dinheiro",
  pix: "Pix",
  conjunta: "Nubank Conjunta",
  pessoal: "Conta Pessoal",
};

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capitalizeFirst(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return "Lançamento rápido";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getTodayISO(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear()).padStart(4, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function inferCategoryAndFlowFromHeuristics(
  normalizedText: string,
  escopo: Scope
): { categoria: Category; tipo_fluxo: FlowType } {
  if (
    escopo === "INDIVIDUAL_GIOVANNI" ||
    escopo === "INDIVIDUAL_MARIA_LUIZA"
  ) {
    return { categoria: "Cota Individual", tipo_fluxo: "CUSTO" };
  }

  const lower = stripAccents(normalizedText.toLowerCase());

  if (
    /\b(salario|pro-labore|prolabore|rendimento|restituicao|freela)\b/.test(
      lower
    )
  ) {
    return { categoria: "Salário / Renda", tipo_fluxo: "RENDA" };
  }

  if (
    /\b(aporte casa|entrada apartamento|amortizacao|meta casa)\b/.test(lower)
  ) {
    return { categoria: "Casa", tipo_fluxo: "INVESTIMENTO" };
  }

  if (/\b(pos-graduacao|mba|intercambio|fundo estudos)\b/.test(lower)) {
    return { categoria: "Estudos (Fundo Futuro)", tipo_fluxo: "INVESTIMENTO" };
  }

  if (
    /\b(viagem|passagem|hotel|hospedagem|ferias)\b/.test(lower) &&
    /\b(aporte|meta|fundo)\b/.test(lower)
  ) {
    return { categoria: "Viagem", tipo_fluxo: "INVESTIMENTO" };
  }

  if (
    /\b(reserva|tesouro selic|cdb|emergencia|patrimonio)\b/.test(lower)
  ) {
    return { categoria: "Reserva & Patrimônio", tipo_fluxo: "INVESTIMENTO" };
  }

  if (/\b(ipva|seguro auto|licenciamento|anuidade)\b/.test(lower)) {
    return {
      categoria: "Fundo Anual (Carro/Impostos)",
      tipo_fluxo: "PROVISAO_ANUAL",
    };
  }

  if (
    /\b(gasolina|posto|etanol|estacionamento|pedagio|uber|99|pneu|oficina|lavagem)\b/.test(
      lower
    )
  ) {
    return { categoria: "Carro", tipo_fluxo: "CUSTO" };
  }

  if (
    /\b(farmacia|drogasil|droga raia|medico|consulta|exame|dentista|psicologa|terapia|academia|plano de saude)\b/.test(
      lower
    )
  ) {
    return { categoria: "Saúde", tipo_fluxo: "CUSTO" };
  }

  if (
    /\b(mercado|supermercado|aluguel|condominio|luz|energia|agua|internet|gas|feira|acougue|padaria)\b/.test(
      lower
    )
  ) {
    return { categoria: "Habitação & Fixos", tipo_fluxo: "CUSTO" };
  }

  if (
    /\b(livro|curso|mensalidade|udemy|alura|ingles|papelaria)\b/.test(lower)
  ) {
    return { categoria: "Estudos (Custeio)", tipo_fluxo: "CUSTO" };
  }

  return { categoria: "Lazer", tipo_fluxo: "CUSTO" };
}

/**
 * Parser Léxico Determinístico de 0ms (Seção 4.4.1 de arquitetura.txt).
 * Converte strings telegráficas (ex: "150 jantar pizzaria #lazer @nubank 2x !ind")
 * em um payload estruturado de transação sem uso de APIs externas.
 */
export function parseQuickEntry(
  input: string,
  defaultMember: Member = "Giovanni",
  referenceDate?: string
): QuickEntryParseResult {
  let working = input.trim();
  const data_competencia = referenceDate ?? getTodayISO();

  // 1. Extrair parcelas (ex: 2x, 10x, 4X)
  let total_parcelas = 1;
  const installmentRegex = /\b(\d{1,2})x\b/i;
  const installmentMatch = working.match(installmentRegex);
  if (installmentMatch && installmentMatch[1]) {
    total_parcelas = Math.max(1, parseInt(installmentMatch[1], 10));
    working = working.replace(installmentMatch[0], " ");
  }

  // 2. Extrair valor monetário (ex: R$ 1.245,80 | 245,80 | 150)
  let valorAbsoluto = 0;
  let hasFoundValue = false;
  const amountRegex =
    /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
  const amountMatch = working.match(amountRegex);
  if (amountMatch && amountMatch[1]) {
    const rawNum = amountMatch[1];
    const normalizedNum =
      rawNum.includes(",") && rawNum.includes(".")
        ? rawNum.replace(/\./g, "").replace(",", ".")
        : rawNum.includes(",")
          ? rawNum.replace(",", ".")
          : rawNum;
    const parsedNum = Number.parseFloat(normalizedNum);
    if (!Number.isNaN(parsedNum) && parsedNum > 0) {
      valorAbsoluto = roundCurrency(parsedNum);
      hasFoundValue = true;
      working = working.replace(amountMatch[0], " ");
    }
  }

  // 3. Extrair indicador de pagador (por:malu, por:giovanni, @malu, @maria, @giovanni)
  let pago_por: Member = defaultMember;
  const explicitByMatch = working.match(
    /\bpor:(malu|maria(?:\s+luiza)?|giovanni)\b/i
  );
  if (explicitByMatch && explicitByMatch[1]) {
    const token = explicitByMatch[1].toLowerCase();
    pago_por = token.startsWith("g") ? "Giovanni" : "Maria Luiza";
    working = working.replace(explicitByMatch[0], " ");
  }

  // 4. Extrair arrobas (@conta ou @membro)
  let conta = "Nubank";
  const atMatches = Array.from(working.matchAll(/@([a-zA-ZÀ-ÿ0-9_-]+)/g));
  for (const match of atMatches) {
    const rawTag = stripAccents((match[1] ?? "").toLowerCase());
    if (rawTag === "malu" || rawTag === "maria") {
      pago_por = "Maria Luiza";
    } else if (rawTag === "giovanni") {
      pago_por = "Giovanni";
    } else if (ACCOUNT_TAG_MAP[rawTag]) {
      conta = ACCOUNT_TAG_MAP[rawTag];
    }
    working = working.replace(match[0], " ");
  }

  // Também detecta menção explícita a "malu" ou "maria luiza" se estiver isolada como pagador
  if (/\b(maria luiza|malu)\b/i.test(working)) {
    pago_por = "Maria Luiza";
    working = working.replace(/\b(maria luiza|malu)\b/gi, " ");
  }

  // 5. Extrair indicadores de escopo (!ind, !individual, !pessoal, !giovanni, !malu)
  let escopo: Scope = "CONJUNTO";
  const bangMatches = Array.from(working.matchAll(/!([a-zA-ZÀ-ÿ0-9_-]+)/g));
  for (const match of bangMatches) {
    const rawBang = stripAccents((match[1] ?? "").toLowerCase());
    if (rawBang === "giovanni") {
      pago_por = "Giovanni";
      escopo = "INDIVIDUAL_GIOVANNI";
    } else if (rawBang === "malu" || rawBang === "maria") {
      pago_por = "Maria Luiza";
      escopo = "INDIVIDUAL_MARIA_LUIZA";
    } else if (
      rawBang === "ind" ||
      rawBang === "individual" ||
      rawBang === "pessoal"
    ) {
      escopo =
        pago_por === "Maria Luiza"
          ? "INDIVIDUAL_MARIA_LUIZA"
          : "INDIVIDUAL_GIOVANNI";
    }
    working = working.replace(match[0], " ");
  }

  // 6. Extrair hashtag de categoria (#lazer, #carro, etc.)
  let explicitCatAndFlow: { categoria: Category; tipo_fluxo: FlowType } | null =
    null;
  const hashMatches = Array.from(working.matchAll(/#([a-zA-ZÀ-ÿ0-9_-]+)/g));
  for (const match of hashMatches) {
    const rawHash = stripAccents((match[1] ?? "").toLowerCase());
    if (HASHTAG_MAP[rawHash]) {
      explicitCatAndFlow = HASHTAG_MAP[rawHash];
      if (explicitCatAndFlow.categoria === "Cota Individual" && escopo === "CONJUNTO") {
        escopo =
          pago_por === "Maria Luiza"
            ? "INDIVIDUAL_MARIA_LUIZA"
            : "INDIVIDUAL_GIOVANNI";
      }
    }
    working = working.replace(match[0], " ");
  }

  // 7. Limpar descrição restante
  const cleanedDescription = working.replace(/\s+/g, " ").trim();
  const descricao = capitalizeFirst(cleanedDescription);

  // 8. Resolver categoria e tipo de fluxo (hashtag explícita ou fallback heurístico)
  const resolved =
    explicitCatAndFlow ??
    inferCategoryAndFlowFromHeuristics(cleanedDescription, escopo);

  const sign =
    resolved.tipo_fluxo === "CUSTO" || resolved.tipo_fluxo === "PROVISAO_ANUAL"
      ? -1
      : 1;

  const valor = hasFoundValue ? roundCurrency(sign * valorAbsoluto) : 0;

  return {
    isValid: hasFoundValue && valorAbsoluto > 0,
    rawInput: input,
    data_competencia,
    tipo_fluxo: resolved.tipo_fluxo,
    categoria: resolved.categoria,
    descricao,
    valor,
    valorAbsoluto,
    conta,
    pago_por,
    escopo,
    total_parcelas,
  };
}
