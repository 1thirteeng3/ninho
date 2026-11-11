/**
 * Ninho (Finanças Casal) — Camada 2: Motor Transacional & API Serverless (Google Apps Script)
 *
 * Interface pública (Deep Module):
 * - setupDatabaseSheets(): Bootstrap idempotente das 4 abas e dados iniciais do casal (Giovanni & Maria Luiza).
 * - doGet(e): Endpoint de leitura unificada (e sincronização sob demanda quando action=sync).
 * - doPost(e): Endpoint transacional de escrita com LockService, sanitização contra Formula Injection,
 *              desdobramento de parcelas (1..N) com ajuste exato de centavos na parcela 1,
 *              projeção de vencimento de fatura (deslocamento delta_0) e ingestão de notificações mobile.
 * - syncTasksToSheets(): Consumidor da fila assíncrona no Google Tasks (lista "Finanças").
 */

const TIMEZONE = "GMT-3";
// Quando false, setupDatabaseSheets() cria apenas cabeçalhos (sem dados fictícios).
const SEED_DEMO_DATA = false;

const ALLOWED_FLOW_TYPES = [
  "RENDA",
  "CUSTO",
  "PROVISAO_ANUAL",
  "INVESTIMENTO",
  "AJUSTE"
];

const ALLOWED_SCOPES = [
  "CONJUNTO",
  "INDIVIDUAL_GIOVANNI",
  "INDIVIDUAL_MARIA_LUIZA"
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
  "btg"
];

/**
 * Emite log estruturado JSON no Cloud Logging / Execution Log do Apps Script.
 * Nunca registra segredos ou tokens.
 */
function logEvent(level, event, entryPoint, correlationId, details) {
  const payload = Object.assign(
    {
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      entryPoint: entryPoint,
      correlationId: correlationId
    },
    details || {}
  );
  console.log(JSON.stringify(payload));
}

/**
 * Valida o token secreto compartilhado nas Script Properties (API_SECRET_TOKEN).
 * Se API_SECRET_TOKEN estiver configurado, exige correspondência em e.parameter.token ou bodyData.token.
 */
function isAuthorized(e, bodyData) {
  const API_SECRET_TOKEN =
    PropertiesService.getScriptProperties().getProperty("API_SECRET_TOKEN") || "";
  if (!API_SECRET_TOKEN) {
    return true;
  }
  const queryToken = e && e.parameter && e.parameter.token ? String(e.parameter.token) : "";
  const bodyToken = bodyData && bodyData.token ? String(bodyData.token) : "";
  return queryToken === API_SECRET_TOKEN || bodyToken === API_SECRET_TOKEN;
}

/**
 * Proteção contra Formula Injection (CSV/Sheet Injection).
 * Qualquer string que comece com =, +, - ou @ (e não seja número real) recebe prefixo "'".
 */
function sanitizeCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  const str = String(value).trim();
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * Normaliza o nome do membro do casal ("Giovanni" ou "Maria Luiza").
 * Nunca permite o termo genérico "Esposa".
 */
function normalizeMember(rawMember) {
  const str = String(rawMember || "").trim().toLowerCase();
  if (
    str === "maria luiza" ||
    str === "malu" ||
    str === "maria" ||
    str === "esposa" ||
    str === "ela"
  ) {
    return "Maria Luiza";
  }
  return "Giovanni";
}

/**
 * Normaliza o escopo da transação garantindo os 3 valores canônicos:
 * CONJUNTO, INDIVIDUAL_GIOVANNI, INDIVIDUAL_MARIA_LUIZA.
 */
function normalizeScope(rawScope, paidBy) {
  const str = String(rawScope || "").trim().toUpperCase();
  if (str === "INDIVIDUAL_GIOVANNI") {
    return "INDIVIDUAL_GIOVANNI";
  }
  if (
    str === "INDIVIDUAL_MARIA_LUIZA" ||
    str === "INDIVIDUAL_ESPOSA" ||
    str === "INDIVIDUAL_MALU"
  ) {
    return "INDIVIDUAL_MARIA_LUIZA";
  }
  if (str === "INDIVIDUAL" || str === "PESSOAL" || str === "IND") {
    return paidBy === "Maria Luiza" ? "INDIVIDUAL_MARIA_LUIZA" : "INDIVIDUAL_GIOVANNI";
  }
  return "CONJUNTO";
}

/**
 * Normaliza o tipo de fluxo financeiro.
 */
function normalizeFlowType(rawFlowType, category) {
  const str = String(rawFlowType || "").trim().toUpperCase();
  if (ALLOWED_FLOW_TYPES.indexOf(str) !== -1) {
    return str;
  }
  const catLower = String(category || "").toLowerCase();
  if (
    catLower === "casa" ||
    catLower === "estudos (fundo futuro)" ||
    catLower === "viagem" ||
    catLower === "reserva & patrimônio"
  ) {
    return "INVESTIMENTO";
  }
  if (catLower.indexOf("fundo anual") !== -1) {
    return "PROVISAO_ANUAL";
  }
  if (catLower.indexOf("salário") !== -1 || catLower.indexOf("renda") !== -1) {
    return "RENDA";
  }
  return "CUSTO";
}

/**
 * Normaliza ou infere a categoria oficial a partir do texto/categoria informada.
 */
function resolveCategory(rawCategory, description, flowType, scope) {
  const cat = String(rawCategory || "").trim();
  const officialCategories = [
    "Habitação & Fixos",
    "Carro",
    "Saúde",
    "Estudos (Custeio)",
    "Lazer",
    "Cota Individual",
    "Fundo Anual (Carro/Impostos)",
    "Casa",
    "Estudos (Fundo Futuro)",
    "Viagem",
    "Reserva & Patrimônio",
    "Salário / Renda",
    "Ajuste de Caixa"
  ];
  for (let i = 0; i < officialCategories.length; i++) {
    if ( officialCategories[i].toLowerCase() === cat.toLowerCase() ) {
      return officialCategories[i];
    }
  }

  const combined = (cat + " " + String(description || "")).toLowerCase();

  if (flowType === "RENDA") return "Salário / Renda";
  if (flowType === "AJUSTE") return "Ajuste de Caixa";
  if (flowType === "PROVISAO_ANUAL") return "Fundo Anual (Carro/Impostos)";

  if (flowType === "INVESTIMENTO") {
    if (combined.indexOf("casa") !== -1 || combined.indexOf("imovel") !== -1 || combined.indexOf("imóvel") !== -1) {
      return "Casa";
    }
    if (combined.indexOf("estudo") !== -1 || combined.indexOf("mba") !== -1 || combined.indexOf("pos") !== -1 || combined.indexOf("pós") !== -1 || combined.indexOf("intercambio") !== -1) {
      return "Estudos (Fundo Futuro)";
    }
    if (combined.indexOf("viagem") !== -1 || combined.indexOf("ferias") !== -1 || combined.indexOf("férias") !== -1) {
      return "Viagem";
    }
    return "Reserva & Patrimônio";
  }

  if (scope === "INDIVIDUAL_GIOVANNI" || scope === "INDIVIDUAL_MARIA_LUIZA") {
    if (!cat || cat.toLowerCase() === "cota individual" || cat.toLowerCase() === "individual") {
      return "Cota Individual";
    }
  }

  if (
    /gasolina|posto|shell|ipiranga|br mania|etanol|combustivel|combustível|uber|99pop|pedagio|pedágio|estacionamento|sem parar|veloe|oficina|pneu|oleo|óleo|lavagem|carro/.test(
      combined
    )
  ) {
    return "Carro";
  }
  if (
    /ipva|licenciamento|seguro auto|seguro carro|revisao anual|revisão anual/.test(
      combined
    )
  ) {
    return "Fundo Anual (Carro/Impostos)";
  }
  if (
    /drogasil|droga raia|pague menos|panvel|farmacia|farmácia|medico|médico|consulta|exame|laboratorio|laboratório|dentista|odonto|psicologa|psicóloga|terapia|academia|smartfit|plano de saude|saude|saúde/.test(
      combined
    )
  ) {
    return "Saúde";
  }
  if (
    /supermercado|mercado|extra|carrefour|pao de acucar|pão de açúcar|assai|assaí|atacadao|atacadão|hortifruti|padaria|aluguel|condominio|condomínio|energia|luz|enel|sabesp|agua|água|gas|gás|internet|vivo|claro|tim|habitacao|habitação|limpeza/.test(
      combined
    )
  ) {
    return "Habitação & Fixos";
  }
  if (
    /curso|mensalidade|livro|amazon livros|udemy|alura|coursera|papelaria|estudo|faculdade/.test(
      combined
    )
  ) {
    return "Estudos (Custeio)";
  }

  return "Lazer";
}

/**
 * Bootstrap Automático: Cria e popula (se não existirem) as 4 abas oficiais da planilha.
 */
function setupDatabaseSheets() {
  const correlationId = "setup_" + new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Aba Transacoes
  let txSheet = ss.getSheetByName("Transacoes");
  if (!txSheet) {
    txSheet = ss.insertSheet("Transacoes");
  }
  if (txSheet.getLastRow() === 0) {
    txSheet.appendRow([
      "id",
      "data_competencia",
      "data_caixa",
      "tipo_fluxo",
      "categoria",
      "descricao",
      "valor",
      "conta",
      "pago_por",
      "escopo",
      "parcela_atual",
      "total_parcelas",
      "id_plano_parcelas"
    ]);
  }

  // 2. Aba Investimentos_Metas
  let invSheet = ss.getSheetByName("Investimentos_Metas");
  if (!invSheet) {
    invSheet = ss.insertSheet("Investimentos_Metas");
  }
  if (invSheet.getLastRow() === 0) {
    invSheet.appendRow([
      "id_meta",
      "nome",
      "tipo",
      "valor_alvo",
      "total_aportado",
      "saldo_bruto_atual"
    ]);
    const initialGoals = [
      ["meta_casa", "Casa", "PATRIMONIO", 80000.0, 42000.0, 44150.0],
      [
        "meta_estudos",
        "Estudos (Fundo Futuro)",
        "OBJETIVO_CONSUMO",
        15000.0,
        4200.0,
        4380.0
      ],
      ["meta_viagem", "Viagem", "OBJETIVO_CONSUMO", 10000.0, 6500.0, 6790.0],
      [
        "meta_reserva",
        "Reserva & Patrimônio",
        "PATRIMONIO",
        30000.0,
        18000.0,
        18500.0
      ]
    ];
    (SEED_DEMO_DATA ? initialGoals : []).forEach(function (row) {
      invSheet.appendRow(row);
    });
  }

  // 3. Aba Provisoes_Anuais
  let provSheet = ss.getSheetByName("Provisoes_Anuais");
  if (!provSheet) {
    provSheet = ss.insertSheet("Provisoes_Anuais");
  }
  if (provSheet.getLastRow() === 0) {
    provSheet.appendRow([
      "item",
      "categoria_pai",
      "valor_anual_estimado",
      "mes_vencimento",
      "saldo_acumulado"
    ]);
    const initialProvisions = [
      ["IPVA e Licenciamento", "Fundo Anual (Carro/Impostos)", 2400.0, 1, 2000.0],
      ["Seguro Automotivo", "Fundo Anual (Carro/Impostos)", 1800.0, 5, 1050.0],
      ["Revisão Preventiva Anual", "Fundo Anual (Carro/Impostos)", 600.0, 9, 550.0]
    ];
    (SEED_DEMO_DATA ? initialProvisions : []).forEach(function (row) {
      provSheet.appendRow(row);
    });
  }

  // 4. Aba Config_Casal
  let cfgSheet = ss.getSheetByName("Config_Casal");
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet("Config_Casal");
  }
  if (cfgSheet.getLastRow() === 0) {
    cfgSheet.appendRow([
      "usuario",
      "cota_mensal_livre",
      "dia_fechamento_cartao",
      "dia_vencimento_cartao"
    ]);
    cfgSheet.appendRow(["Giovanni", 0, 1, 10]);
    cfgSheet.appendRow(["Maria Luiza", 0, 1, 10]);
  }

  // 5. Aba Ativos_Investimento
  let astSheet = ss.getSheetByName("Ativos_Investimento");
  if (!astSheet) {
    astSheet = ss.insertSheet("Ativos_Investimento");
  }
  if (astSheet.getLastRow() === 0) {
    astSheet.appendRow([
      "id",
      "nome",
      "tipo_ativo",
      "rendimento",
      "liquidez",
      "instituicao",
      "meta_vinculada",
      "titular",
      "valor_aportado",
      "saldo_atual"
    ]);
    const initialAssets = [
      [
        "AST-001",
        "Tesouro IPCA+ 2029 (Entrada Apto)",
        "Tesouro Direto",
        "IPCA + 6.45% a.a.",
        "Vencimento",
        "XP Investimentos",
        "Casa",
        "Conjunto",
        39100.0,
        42000.0
      ],
      [
        "AST-002",
        "CDB Liquidez Diária 102% CDI",
        "CDB",
        "102% do CDI",
        "Diária",
        "Nubank",
        "Reserva de Emergência",
        "Conjunto",
        18500.0,
        19620.0
      ],
      [
        "AST-003",
        "LCI Isenta 94% CDI (Férias)",
        "LCI / LCA",
        "94% do CDI (Isento IR)",
        "90 dias",
        "Banco Inter",
        "Viagem",
        "Conjunto",
        6180.0,
        6500.0
      ],
      [
        "AST-004",
        "Caixinha Turbo 110% CDI",
        "Caixinha / Conta Remunerada",
        "110% do CDI",
        "Diária",
        "Nubank",
        "Estudos (Curso)",
        "Maria Luiza",
        3800.0,
        4200.0
      ],
      [
        "AST-005",
        "FII HGLG11 + KNRI11 (Renda)",
        "Fundo Imobiliário (FII)",
        "DY ~9.8% a.a. + IPCA",
        "D+2 Bolsa",
        "BTG Pactual",
        "Liberdade Financeira",
        "Giovanni",
        7500.0,
        8140.0
      ],
      [
        "AST-006",
        "ETF IVV / WRLD11 (Global)",
        "Ações / ETF",
        "S&P 500 + Câmbio (~12% a.a.)",
        "D+2 Bolsa",
        "XP Investimentos",
        "Liberdade Financeira",
        "Conjunto",
        4500.0,
        5180.0
      ]
    ];
    (SEED_DEMO_DATA ? initialAssets : []).forEach(function (row) {
      astSheet.appendRow(row);
    });
  }

  // 6. Aba Valores_Receber
  let recSheet = ss.getSheetByName("Valores_Receber");
  if (!recSheet) {
    recSheet = ss.insertSheet("Valores_Receber");
  }
  if (recSheet.getLastRow() === 0) {
    recSheet.appendRow([
      "id",
      "descricao",
      "pagador_origem",
      "recebedor",
      "valor_total",
      "total_parcelas",
      "parcelas_recebidas",
      "proximo_vencimento",
      "conta_destino",
      "status"
    ]);
    const initialReceivables = [
      [
        "REC-001",
        "Projeto Arquitetura & Interiores (Consultoria)",
        "Cliente Studio A",
        "Maria Luiza",
        4500.0,
        3,
        1,
        "2026-11-18",
        "Nubank",
        "ATIVO"
      ],
      [
        "REC-002",
        "Venda MacBook Air M1 Usado",
        "Pedro Henrique (Amigo)",
        "Giovanni",
        3600.0,
        4,
        2,
        "2026-11-15",
        "Itaú",
        "ATIVO"
      ],
      [
        "REC-003",
        "Reembolso Passagens Aéreas Família",
        "Cunhado / Família",
        "Conjunto",
        1200.0,
        2,
        1,
        "2026-11-25",
        "Nubank",
        "ATIVO"
      ]
    ];
    (SEED_DEMO_DATA ? initialReceivables : []).forEach(function (row) {
      recSheet.appendRow(row);
    });
  }

  logEvent("info", "database_sheets_bootstrapped", "setupDatabaseSheets", correlationId, {
    sheets: [
      "Transacoes",
      "Investimentos_Metas",
      "Provisoes_Anuais",
      "Config_Casal",
      "Ativos_Investimento",
      "Valores_Receber"
    ]
  });
}

/**
 * Converte string YYYY-MM-DD (ou Date) em objeto Date local às 12:00 para evitar problemas de fuso horário.
 */
function parseDateSafe(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }
  if (Object.prototype.toString.call(dateInput) === "[object Date]") {
    return new Date(
      dateInput.getFullYear(),
      dateInput.getMonth(),
      dateInput.getDate(),
      12,
      0,
      0
    );
  }
  const str = String(dateInput).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      12,
      0,
      0
    );
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      12,
      0,
      0
    );
  }
  const fallback = new Date();
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
    12,
    0,
    0
  );
}

/**
 * Formata Date em YYYY-MM-DD.
 */
function formatDateISO(dateObj) {
  return Utilities.formatDate(dateObj, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Cria uma data no ano/mês alvo ajustando para o último dia do mês caso o dia exceda (ex: 31 em fevereiro).
 */
function createClampedDate(year, monthIndex, day) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), lastDayOfMonth);
  return new Date(year, monthIndex, clampedDay, 12, 0, 0);
}

/**
 * Verifica se a conta informada é um cartão de crédito.
 */
function isCreditCardAccount(accountName) {
  const lower = String(accountName || "").trim().toLowerCase();
  if (!lower) return false;
  if (
    lower.indexOf("pix") !== -1 ||
    lower.indexOf("dinheiro") !== -1 ||
    lower.indexOf("débito") !== -1 ||
    lower.indexOf("debito") !== -1 ||
    lower.indexOf("corrente") !== -1
  ) {
    return false;
  }
  for (let i = 0; i < CREDIT_CARD_KEYWORDS.length; i++) {
    if (lower.indexOf(CREDIT_CARD_KEYWORDS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * Obtém os dias de fechamento e vencimento do cartão do membro na aba Config_Casal.
 */
function getMemberCardConfig(ss, memberName) {
  const cfgSheet = ss.getSheetByName("Config_Casal");
  const defaultCfg =
    memberName === "Maria Luiza"
      ? { closingDay: 20, dueDay: 27 }
      : { closingDay: 15, dueDay: 22 };

  if (!cfgSheet) return defaultCfg;

  const rows = getSheetData(cfgSheet);
  for (let i = 0; i < rows.length; i++) {
    if (normalizeMember(rows[i].usuario) === memberName) {
      return {
        closingDay: parseInt(rows[i].dia_fechamento_cartao, 10) || defaultCfg.closingDay,
        dueDay: parseInt(rows[i].dia_vencimento_cartao, 10) || defaultCfg.dueDay
      };
    }
  }
  return defaultCfg;
}

/**
 * Faz o parse de uma notificação bancária bruta (Android MacroDroid / Tasker ou iOS Shortcuts).
 * Exemplo: "Compra aprovada no seu cartao final 1234 em SUPERMERCADO EXTRA valor R$ 245,80 em 10/11"
 */
function parseMobileNotificationPayload(bodyData) {
  const rawText = String(bodyData.raw_notification || "").trim();
  const paidBy = normalizeMember(bodyData.paid_by || bodyData.pago_por || "Giovanni");

  // Extrai valor após R$
  const valueMatch = rawText.match(/R\$\s*([\d.]+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  let numericValue = 0;
  if (valueMatch && valueMatch[1]) {
    const rawNumber = valueMatch[1];
    if (rawNumber.indexOf(",") !== -1) {
      numericValue = parseFloat(rawNumber.replace(/\./g, "").replace(",", "."));
    } else {
      numericValue = parseFloat(rawNumber);
    }
  }

  // Extrai estabelecimento após "em " e antes de "valor", "R$" ou "em DD/MM"
  let merchant = "Compra Mobile";
  const merchantMatch = rawText.match(
    /\bem\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9\s.*\-_&]+?)(?:\s+valor\b|\s+R\$|\s+em\s+\d{1,2}\/\d{1,2}|$)/i
  );
  if (merchantMatch && merchantMatch[1]) {
    merchant = merchantMatch[1].trim();
  }

  // Extrai parcelas se houver menção a "em Nx"
  const installmentMatch = rawText.match(/\b(\d{1,2})x\b/i);
  const parcelas = installmentMatch ? Math.max(1, parseInt(installmentMatch[1], 10)) : 1;

  // Detecta conta pela notificação ou usa Nubank como padrão
  let conta = bodyData.conta || "Nubank";
  if (/itau|itaú/i.test(rawText)) conta = "Itaú";
  else if (/inter\b/i.test(rawText)) conta = "Inter";
  else if (/nubank|\bnu\b/i.test(rawText)) conta = "Nubank";

  const scope = normalizeScope(bodyData.escopo || "CONJUNTO", paidBy);
  const flowType = "CUSTO";
  const category = resolveCategory(bodyData.categoria || "", merchant, flowType, scope);

  return {
    data_competencia: bodyData.data_competencia || formatDateISO(new Date()),
    tipo_fluxo: flowType,
    categoria: category,
    descricao: merchant,
    valor: -Math.abs(numericValue),
    conta: conta,
    pago_por: paidBy,
    escopo: scope,
    total_parcelas: parcelas
  };
}

/**
 * Motor central de persistência e desdobramento de parcelas (Seção 4.2.3 da Arquitetura).
 * Deve ser invocado dentro de um bloco protegido por LockService.
 */
function recordTransactionRows(ss, rawPayload) {
  let sheet = ss.getSheetByName("Transacoes");
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName("Transacoes");
  }

  const paidBy = normalizeMember(rawPayload.pago_por || rawPayload.paid_by);
  const scope = normalizeScope(rawPayload.escopo, paidBy);
  const flowType = normalizeFlowType(rawPayload.tipo_fluxo, rawPayload.categoria);
  const category = resolveCategory(
    rawPayload.categoria,
    rawPayload.descricao,
    flowType,
    scope
  );

  const parcelas = Math.max(1, parseInt(rawPayload.total_parcelas, 10) || 1);
  const rawValor = parseFloat(rawPayload.valor);
  if (isNaN(rawValor)) {
    throw new Error("Valor monetário inválido no payload de transação.");
  }

  // Define sinal correto conforme tipo de fluxo: CUSTO e PROVISAO_ANUAL são negativos; RENDA e INVESTIMENTO positivos
  let signedTotal = rawValor;
  if (flowType === "CUSTO" || flowType === "PROVISAO_ANUAL") {
    signedTotal = -Math.abs(rawValor);
  } else if (flowType === "RENDA" || flowType === "INVESTIMENTO") {
    signedTotal = Math.abs(rawValor);
  }

  const sign = signedTotal < 0 ? -1 : 1;
  const absTotal = Math.round(Math.abs(signedTotal) * 100) / 100;
  const baseUnit = Math.round((absTotal / parcelas) * 100) / 100;
  const residual = Math.round((absTotal - baseUnit * parcelas) * 100) / 100;

  const dataCompObj = parseDateSafe(rawPayload.data_competencia);
  const dataCompStr = formatDateISO(dataCompObj);
  const hasExplicitDifferentCashDate =
    Boolean(rawPayload.data_caixa) &&
    String(rawPayload.data_caixa).trim() !== String(rawPayload.data_competencia || "").trim();

  const conta = String(rawPayload.conta || "Nubank").trim();
  const isCard = isCreditCardAccount(conta);
  const cardCfg = isCard ? getMemberCardConfig(ss, paidBy) : null;

  // Deslocamento de fatura base (delta_0): 0 se dia(t_compra) < d_fech, senão 1
  const purchaseDay = dataCompObj.getDate();
  const delta0 =
    cardCfg && purchaseDay >= cardCfg.closingDay ? 1 : 0;

  const timestampMs = new Date().getTime();
  const planoId =
    parcelas > 1
      ? String(rawPayload.id_plano_parcelas || "plan_" + timestampMs)
      : "";
  const baseDesc = String(rawPayload.descricao || "Lançamento").trim();

  const insertedIds = [];

  for (let i = 1; i <= parcelas; i++) {
    const unitAmount =
      i === 1
        ? Math.round((baseUnit + residual) * 100) / 100
        : baseUnit;
    const parcelaValor = sign * unitAmount;

    let dataCaixaObj;
    if (isCard && !hasExplicitDifferentCashDate && cardCfg) {
      const targetMonthOffset = delta0 + (i - 1);
      dataCaixaObj = createClampedDate(
        dataCompObj.getFullYear(),
        dataCompObj.getMonth() + targetMonthOffset,
        cardCfg.dueDay
      );
    } else {
      const baseCaixaObj = rawPayload.data_caixa
        ? parseDateSafe(rawPayload.data_caixa)
        : dataCompObj;
      dataCaixaObj = createClampedDate(
        baseCaixaObj.getFullYear(),
        baseCaixaObj.getMonth() + (i - 1),
        baseCaixaObj.getDate()
      );
    }

    const txId = "tx_" + timestampMs + "_" + i;
    const descParcela =
      parcelas > 1 ? baseDesc + " (" + i + "/" + parcelas + ")" : baseDesc;

    const row = [
      sanitizeCell(txId),
      sanitizeCell(dataCompStr),
      sanitizeCell(formatDateISO(dataCaixaObj)),
      sanitizeCell(flowType),
      sanitizeCell(category),
      sanitizeCell(descParcela),
      parcelaValor,
      sanitizeCell(conta),
      sanitizeCell(paidBy),
      sanitizeCell(scope),
      i,
      parcelas,
      sanitizeCell(planoId)
    ];

    sheet.appendRow(row);
    insertedIds.push(txId);
  }

  return {
    count: parcelas,
    ids: insertedIds,
    id_plano_parcelas: planoId
  };
}

/**
 * Recalcula total_aportado e saldo_bruto_atual na aba Investimentos_Metas a partir dos ativos da aba Ativos_Investimento.
 */
function syncGoalsFromAssetsSheet(ss) {
  const astSheet = ss.getSheetByName("Ativos_Investimento");
  const invSheet = ss.getSheetByName("Investimentos_Metas");
  if (!astSheet || !invSheet) return;

  const assets = getSheetData(astSheet);
  const goalValues = invSheet.getDataRange().getValues();
  if (!goalValues || goalValues.length <= 1) return;

  const headers = goalValues[0];
  const idxNome = headers.indexOf("nome");
  const idxAportado = headers.indexOf("total_aportado");
  const idxSaldo = headers.indexOf("saldo_bruto_atual");
  if (idxNome === -1 || idxAportado === -1 || idxSaldo === -1) return;

  for (let r = 1; r < goalValues.length; r++) {
    const goalName = String(goalValues[r][idxNome] || "").trim().toLowerCase();
    const matchedAssets = assets.filter(function (a) {
      const linked = String(a.meta_vinculada || "").trim().toLowerCase();
      return (
        linked === goalName ||
        (goalName.indexOf("estudos") !== -1 && linked.indexOf("estudos") !== -1) ||
        (goalName.indexOf("reserva") !== -1 && linked.indexOf("reserva") !== -1)
      );
    });
    if (matchedAssets.length > 0) {
      let sumAportado = 0;
      let sumSaldo = 0;
      matchedAssets.forEach(function (a) {
        sumAportado += parseFloat(a.valor_aportado) || 0;
        sumSaldo += parseFloat(a.saldo_atual) || 0;
      });
      invSheet.getRange(r + 1, idxAportado + 1).setValue(Math.round(sumAportado * 100) / 100);
      invSheet.getRange(r + 1, idxSaldo + 1).setValue(Math.round(sumSaldo * 100) / 100);
    }
  }
}

/**
 * Cria ou atualiza um ativo na aba Ativos_Investimento e sincroniza Investimentos_Metas.
 */
function upsertAssetRow(ss, assetPayload) {
  let astSheet = ss.getSheetByName("Ativos_Investimento");
  if (!astSheet) {
    setupDatabaseSheets();
    astSheet = ss.getSheetByName("Ativos_Investimento");
  }
  const assetId = String(assetPayload.id || "AST-" + new Date().getTime()).trim();
  const rowData = [
    sanitizeCell(assetId),
    sanitizeCell(assetPayload.nome || "Ativo"),
    sanitizeCell(assetPayload.tipo_ativo || "CDB"),
    sanitizeCell(assetPayload.rendimento || "100% do CDI"),
    sanitizeCell(assetPayload.liquidez || "Diária"),
    sanitizeCell(assetPayload.instituicao || "Nubank"),
    sanitizeCell(assetPayload.meta_vinculada || "Reserva de Emergência"),
    sanitizeCell(assetPayload.titular || "Conjunto"),
    Math.round((parseFloat(assetPayload.valor_aportado) || 0) * 100) / 100,
    Math.round((parseFloat(assetPayload.saldo_atual) || 0) * 100) / 100
  ];

  const values = astSheet.getDataRange().getValues();
  let updated = false;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === assetId) {
      astSheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
      updated = true;
      break;
    }
  }
  if (!updated) {
    astSheet.appendRow(rowData);
  }
  syncGoalsFromAssetsSheet(ss);
  return { id: assetId, updated: updated };
}

/**
 * Remove um ativo da aba Ativos_Investimento pelo id e sincroniza Investimentos_Metas.
 */
function deleteRowById(sheet, targetId) {
  if (!sheet || !targetId) return false;
  const values = sheet.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][0]).trim() === String(targetId).trim()) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/**
 * Cria ou atualiza um acordo a receber na aba Valores_Receber.
 */
function upsertReceivableRow(ss, recPayload) {
  let recSheet = ss.getSheetByName("Valores_Receber");
  if (!recSheet) {
    setupDatabaseSheets();
    recSheet = ss.getSheetByName("Valores_Receber");
  }
  const recId = String(recPayload.id || "REC-" + new Date().getTime()).trim();
  const totalParcelas = Math.max(1, parseInt(recPayload.total_parcelas, 10) || 1);
  const parcelasRecebidas = Math.max(0, parseInt(recPayload.parcelas_recebidas, 10) || 0);
  const status = parcelasRecebidas >= totalParcelas ? "CONCLUIDO" : (recPayload.status || "ATIVO");

  const rowData = [
    sanitizeCell(recId),
    sanitizeCell(recPayload.descricao || "Valor a Receber"),
    sanitizeCell(recPayload.pagador_origem || "Origem"),
    sanitizeCell(recPayload.recebedor || "Conjunto"),
    Math.round((parseFloat(recPayload.valor_total) || 0) * 100) / 100,
    totalParcelas,
    parcelasRecebidas,
    sanitizeCell(recPayload.proximo_vencimento || formatDateISO(new Date())),
    sanitizeCell(recPayload.conta_destino || "Nubank"),
    sanitizeCell(status)
  ];

  const values = recSheet.getDataRange().getValues();
  let updated = false;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === recId) {
      recSheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
      updated = true;
      break;
    }
  }
  if (!updated) {
    recSheet.appendRow(rowData);
  }
  return { id: recId, updated: updated };
}

/**
 * Dá baixa na próxima parcela de um acordo em Valores_Receber e lança a entrada correspondente em Transacoes.
 */
function receiveInstallmentAction(ss, receivableId) {
  const recSheet = ss.getSheetByName("Valores_Receber");
  if (!recSheet) return { updated: false };

  const values = recSheet.getDataRange().getValues();
  if (values.length <= 1) return { updated: false };
  const headers = values[0];
  const idxId = headers.indexOf("id");
  const idxDesc = headers.indexOf("descricao");
  const idxPagador = headers.indexOf("pagador_origem");
  const idxRecebedor = headers.indexOf("recebedor");
  const idxValorTotal = headers.indexOf("valor_total");
  const idxTotalParc = headers.indexOf("total_parcelas");
  const idxParcRec = headers.indexOf("parcelas_recebidas");
  const idxVenc = headers.indexOf("proximo_vencimento");
  const idxConta = headers.indexOf("conta_destino");
  const idxStatus = headers.indexOf("status");

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idxId]).trim() === String(receivableId).trim()) {
      const totalParcelas = Math.max(1, parseInt(values[r][idxTotalParc], 10) || 1);
      const currentReceived = Math.max(0, parseInt(values[r][idxParcRec], 10) || 0);
      if (currentReceived >= totalParcelas) {
        return { updated: false, alreadyCompleted: true };
      }
      const nextParcela = currentReceived + 1;
      const valorTotal = parseFloat(values[r][idxValorTotal]) || 0;
      const valorParcela = Math.round((valorTotal / totalParcelas) * 100) / 100;
      const newStatus = nextParcela >= totalParcelas ? "CONCLUIDO" : "ATIVO";

      recSheet.getRange(r + 1, idxParcRec + 1).setValue(nextParcela);
      recSheet.getRange(r + 1, idxStatus + 1).setValue(newStatus);

      const vencStr = formatDateISO(parseDateSafe(values[r][idxVenc]));
      const recebedorRaw = String(values[r][idxRecebedor] || "Conjunto");
      const paidBy = recebedorRaw === "Maria Luiza" ? "Maria Luiza" : "Giovanni";

      recordTransactionRows(ss, {
        data_competencia: vencStr,
        data_caixa: vencStr,
        tipo_fluxo: "RENDA",
        categoria: "Salário / Renda",
        descricao:
          "Recebimento: " +
          String(values[r][idxDesc]) +
          " (" +
          nextParcela +
          "/" +
          totalParcelas +
          ") — " +
          String(values[r][idxPagador]),
        valor: valorParcela,
        conta: String(values[r][idxConta] || "Nubank"),
        pago_por: paidBy,
        escopo: "CONJUNTO",
        total_parcelas: 1
      });

      return { updated: true, nextParcela: nextParcela, status: newStatus };
    }
  }
  return { updated: false };
}

/**
 * Antecipa/quita a próxima parcela futura de um plano em Transacoes trazendo data_caixa para o mês de referência.
 */
function payNextInstallmentAction(ss, planId, referenceMonth) {
  const txSheet = ss.getSheetByName("Transacoes");
  if (!txSheet || !planId || !referenceMonth) return { updated: false };

  const values = txSheet.getDataRange().getValues();
  if (values.length <= 1) return { updated: false };
  const headers = values[0];
  const idxDataCaixa = headers.indexOf("data_caixa");
  const idxDesc = headers.indexOf("descricao");
  const idxParcAtual = headers.indexOf("parcela_atual");
  const idxPlano = headers.indexOf("id_plano_parcelas");

  let bestRowIndex = -1;
  let bestParcelaNum = 999999;

  for (let r = 1; r < values.length; r++) {
    const rowPlan = String(values[r][idxPlano] || "").trim();
    const rowCaixa = formatDateISO(parseDateSafe(values[r][idxDataCaixa]));
    const rowMonth = rowCaixa.slice(0, 7);
    const parcelaNum = parseInt(values[r][idxParcAtual], 10) || 1;

    if (rowPlan === String(planId).trim() && rowMonth > String(referenceMonth).trim()) {
      if (parcelaNum < bestParcelaNum) {
        bestParcelaNum = parcelaNum;
        bestRowIndex = r;
      }
    }
  }

  if (bestRowIndex === -1) return { updated: false };

  const oldDesc = String(values[bestRowIndex][idxDesc] || "");
  const newDesc = oldDesc.indexOf("[Quitada]") !== -1 ? oldDesc : oldDesc + " [Quitada]";
  txSheet.getRange(bestRowIndex + 1, idxDataCaixa + 1).setValue(String(referenceMonth).trim() + "-15");
  txSheet.getRange(bestRowIndex + 1, idxDesc + 1).setValue(sanitizeCell(newDesc));

  return { updated: true, row: bestRowIndex + 1 };
}

/**
 * Resposta JSON padronizada.
 */
function jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Atualiza cota mensal livre e dias de cartão de cada membro em Config_Casal.
 */
function saveCoupleConfigRows(ss, configs) {
  let sheet = ss.getSheetByName("Config_Casal");
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName("Config_Casal");
  }
  configs.forEach(function (cfg) {
    const usuario = normalizeMember(cfg.usuario);
    const rowData = [
      usuario,
      Math.max(0, parseFloat(cfg.cota_mensal_livre) || 0),
      Math.min(31, Math.max(1, parseInt(cfg.dia_fechamento_cartao, 10) || 1)),
      Math.min(31, Math.max(1, parseInt(cfg.dia_vencimento_cartao, 10) || 10))
    ];
    const values = sheet.getDataRange().getValues();
    let updated = false;
    for (let r = 1; r < values.length; r++) {
      if (normalizeMember(values[r][0]) === usuario) {
        sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
        updated = true;
        break;
      }
    }
    if (!updated) sheet.appendRow(rowData);
  });
}

/**
 * Cria ou atualiza uma meta em Investimentos_Metas (chave: id_meta).
 */
function upsertGoalRow(ss, goal) {
  let sheet = ss.getSheetByName("Investimentos_Metas");
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName("Investimentos_Metas");
  }
  const goalId = String(goal.id_meta || "meta_" + new Date().getTime()).trim();
  const rowData = [
    sanitizeCell(goalId),
    sanitizeCell(goal.nome || "Meta"),
    goal.tipo === "OBJETIVO_CONSUMO" ? "OBJETIVO_CONSUMO" : "PATRIMONIO",
    Math.round((parseFloat(goal.valor_alvo) || 0) * 100) / 100,
    Math.round((parseFloat(goal.total_aportado) || 0) * 100) / 100,
    Math.round((parseFloat(goal.saldo_bruto_atual) || 0) * 100) / 100
  ];
  const values = sheet.getDataRange().getValues();
  let updated = false;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === goalId) {
      sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
      updated = true;
      break;
    }
  }
  if (!updated) sheet.appendRow(rowData);
  syncGoalsFromAssetsSheet(ss);
}

/**
 * Cria ou atualiza uma despesa anual em Provisoes_Anuais (chave: item).
 */
function upsertProvisionRow(ss, prov) {
  let sheet = ss.getSheetByName("Provisoes_Anuais");
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName("Provisoes_Anuais");
  }
  const item = String(prov.item || "Despesa anual").trim();
  const rowData = [
    sanitizeCell(item),
    sanitizeCell(prov.categoria_pai || "Fundo Anual (Carro/Impostos)"),
    Math.round((parseFloat(prov.valor_anual_estimado) || 0) * 100) / 100,
    Math.min(12, Math.max(1, parseInt(prov.mes_vencimento, 10) || 1)),
    Math.round((parseFloat(prov.saldo_acumulado) || 0) * 100) / 100
  ];
  const values = sheet.getDataRange().getValues();
  let updated = false;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === item) {
      sheet.getRange(r + 1, 1, 1, rowData.length).setValues([rowData]);
      updated = true;
      break;
    }
  }
  if (!updated) sheet.appendRow(rowData);
}

/**
 * Insere linhas de transação já calculadas (ex.: parcelamentos em andamento).
 */
function appendRawTransactions(ss, rows) {
  let sheet = ss.getSheetByName("Transacoes");
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName("Transacoes");
  }
  let count = 0;
  rows.forEach(function (tx) {
    sheet.appendRow([
      sanitizeCell(tx.id),
      sanitizeCell(String(tx.data_competencia || "").slice(0, 10)),
      sanitizeCell(String(tx.data_caixa || "").slice(0, 10)),
      sanitizeCell(tx.tipo_fluxo),
      sanitizeCell(tx.categoria),
      sanitizeCell(tx.descricao),
      Math.round((parseFloat(tx.valor) || 0) * 100) / 100,
      sanitizeCell(tx.conta),
      sanitizeCell(tx.pago_por),
      sanitizeCell(tx.escopo),
      parseInt(tx.parcela_atual, 10) || 1,
      parseInt(tx.total_parcelas, 10) || 1,
      sanitizeCell(tx.id_plano_parcelas || "")
    ]);
    count++;
  });
  return count;
}

/**
 * Apaga todas as linhas de dados (mantém cabeçalhos) e zera a Config_Casal.
 */
function clearAllData(ss) {
  const names = [
    "Transacoes",
    "Investimentos_Metas",
    "Provisoes_Anuais",
    "Ativos_Investimento",
    "Valores_Receber"
  ];
  names.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) {
      sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  const cfg = ss.getSheetByName("Config_Casal");
  if (cfg) {
    if (cfg.getLastRow() > 1) cfg.deleteRows(2, cfg.getLastRow() - 1);
    cfg.appendRow(["Giovanni", 0, 1, 10]);
    cfg.appendRow(["Maria Luiza", 0, 1, 10]);
  }
}

/**
 * 1. ENDPOINT GET: Consumido pelo Next.js na Vercel para hidratar o Dashboard.
 * Suporta ?action=sync para processar a fila do Google Tasks antes de retornar os dados.
 */
function doGet(e) {
  const correlationId = "get_" + new Date().getTime();
  try {
    if (!isAuthorized(e, {})) {
      logEvent("warn", "unauthorized_access", "doGet", correlationId, {});
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ERROR", code: "UNAUTHORIZED", message: "Token inválido ou ausente." })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    let syncedTasks = 0;
    if (e && e.parameter && e.parameter.action === "sync") {
      syncedTasks = syncTasksToSheets();
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let txSheet = ss.getSheetByName("Transacoes");
    let astSheet = ss.getSheetByName("Ativos_Investimento");
    let recSheet = ss.getSheetByName("Valores_Receber");
    if (!txSheet || !astSheet || !recSheet) {
      setupDatabaseSheets();
      txSheet = ss.getSheetByName("Transacoes");
      astSheet = ss.getSheetByName("Ativos_Investimento");
      recSheet = ss.getSheetByName("Valores_Receber");
    }

    const transacoes = getSheetData(txSheet);
    const investimentos = getSheetData(ss.getSheetByName("Investimentos_Metas"));
    const provisoes = getSheetData(ss.getSheetByName("Provisoes_Anuais"));
    const config = getSheetData(ss.getSheetByName("Config_Casal"));
    const ativos = getSheetData(astSheet);
    const recebiveis = getSheetData(recSheet);

    logEvent("info", "sheet_snapshot_read", "doGet", correlationId, {
      transacoesCount: transacoes.length,
      ativosCount: ativos.length,
      recebiveisCount: recebiveis.length,
      syncedTasks: syncedTasks
    });

    const response = {
      status: "SUCCESS",
      transacoes: transacoes,
      investimentos: investimentos,
      provisoes: provisoes,
      config: config,
      ativos: ativos,
      recebiveis: recebiveis,
      syncedTasks: syncedTasks,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    logEvent("error", "do_get_failed", "doGet", correlationId, {
      errorMessage: String(err && err.message ? err.message : err)
    });
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ERROR", message: "Falha ao ler dados da planilha." })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. ENDPOINT POST: Recebe transações do Web App, comandos de sincronização ou Webhooks Mobile.
 * Protegido por LockService contra condições de corrida.
 */
function doPost(e) {
  const correlationId = "post_" + new Date().getTime();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const bodyData = JSON.parse(rawBody);

    if (!isAuthorized(e, bodyData)) {
      logEvent("warn", "unauthorized_access", "doPost", correlationId, {});
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ERROR", code: "UNAUTHORIZED", message: "Token inválido ou ausente." })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (bodyData.action === "SYNC_TASKS") {
      const processedCount = syncTasksToSheetsInternal(ss, correlationId);
      logEvent("info", "tasks_synced_via_post", "doPost", correlationId, {
        syncedTasks: processedCount
      });
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", syncedTasks: processedCount })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "UPSERT_ASSET" && bodyData.asset) {
      const res = upsertAssetRow(ss, bodyData.asset);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", result: res })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "DELETE_ASSET" && bodyData.assetId) {
      const deleted = deleteRowById(ss.getSheetByName("Ativos_Investimento"), bodyData.assetId);
      syncGoalsFromAssetsSheet(ss);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", deleted: deleted })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "DELETE_TRANSACTION" && bodyData.transactionId) {
      const deleted = deleteRowById(ss.getSheetByName("Transacoes"), bodyData.transactionId);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", deleted: deleted })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "UPSERT_RECEIVABLE" && bodyData.receivable) {
      const res = upsertReceivableRow(ss, bodyData.receivable);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", result: res })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "RECEIVE_INSTALLMENT" && bodyData.receivableId) {
      const res = receiveInstallmentAction(ss, bodyData.receivableId);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", result: res })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "DELETE_RECEIVABLE" && bodyData.receivableId) {
      const deleted = deleteRowById(ss.getSheetByName("Valores_Receber"), bodyData.receivableId);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", deleted: deleted })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "PAY_NEXT_INSTALLMENT" && bodyData.planId) {
      const res = payNextInstallmentAction(ss, bodyData.planId, bodyData.referenceMonth);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", result: res })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (bodyData.action === "SAVE_COUPLE_CONFIG" && bodyData.config) {
      saveCoupleConfigRows(ss, bodyData.config);
      return jsonOk({ status: "SUCCESS" });
    }

    if (bodyData.action === "UPSERT_GOAL" && bodyData.goal) {
      upsertGoalRow(ss, bodyData.goal);
      return jsonOk({ status: "SUCCESS" });
    }

    if (bodyData.action === "DELETE_GOAL" && bodyData.goalId) {
      const deleted = deleteRowById(ss.getSheetByName("Investimentos_Metas"), bodyData.goalId);
      return jsonOk({ status: "SUCCESS", deleted: deleted });
    }

    if (bodyData.action === "UPSERT_PROVISION" && bodyData.provision) {
      upsertProvisionRow(ss, bodyData.provision);
      return jsonOk({ status: "SUCCESS" });
    }

    if (bodyData.action === "DELETE_PROVISION" && bodyData.item) {
      const deleted = deleteRowById(ss.getSheetByName("Provisoes_Anuais"), bodyData.item);
      return jsonOk({ status: "SUCCESS", deleted: deleted });
    }

    if (bodyData.action === "APPEND_TRANSACTIONS" && bodyData.rows) {
      const count = appendRawTransactions(ss, bodyData.rows);
      return jsonOk({ status: "SUCCESS", count: count });
    }

    if (bodyData.action === "CLEAR_ALL_DATA") {
      clearAllData(ss);
      return jsonOk({ status: "SUCCESS" });
    }

    const normalizedPayload =
      bodyData.source === "MOBILE_NOTIFICATION"
        ? parseMobileNotificationPayload(bodyData)
        : bodyData;

    const result = recordTransactionRows(ss, normalizedPayload);

    logEvent("info", "transaction_recorded", "doPost", correlationId, {
      entrySource: bodyData.source || "DIRECT_API",
      installmentsCount: result.count,
      planId: result.id_plano_parcelas
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "SUCCESS",
        count: result.count,
        ids: result.ids,
        id_plano_parcelas: result.id_plano_parcelas
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    logEvent("error", "do_post_failed", "doPost", correlationId, {
      errorMessage: String(err && err.message ? err.message : err)
    });
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "ERROR",
        message: "Erro ao processar o lançamento na planilha."
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 3. CONSUMIDOR DA FILA GOOGLE TASKS -> SHEETS (Ponte Assíncrona do Gem no Gemini)
 * Pode ser executado por gatilho temporal (Time-Driven Trigger) ou sob demanda.
 */
function syncTasksToSheets() {
  const correlationId = "sync_" + new Date().getTime();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const count = syncTasksToSheetsInternal(ss, correlationId);
    logEvent("info", "tasks_sync_completed", "syncTasksToSheets", correlationId, {
      syncedTasks: count
    });
    return count;
  } catch (err) {
    logEvent("error", "tasks_sync_failed", "syncTasksToSheets", correlationId, {
      errorMessage: String(err && err.message ? err.message : err)
    });
    return 0;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Implementação interna do consumidor da lista "Finanças" no Google Tasks.
 * Formato esperado (9 campos): DATA;TIPO_FLUXO;CATEGORIA;VALOR;CONTA;PARCELAS;PAGO_POR;ESCOPO;DESCRICAO
 */
function syncTasksToSheetsInternal(ss, correlationId) {
  if (typeof Tasks === "undefined" || !Tasks.Tasklists) {
    logEvent("warn", "tasks_service_not_enabled", "syncTasksToSheets", correlationId, {});
    return 0;
  }

  const taskListsResponse = Tasks.Tasklists.list();
  const taskLists = (taskListsResponse && taskListsResponse.items) || [];
  let targetList = null;
  for (let i = 0; i < taskLists.length; i++) {
    if (taskLists[i].title === "Finanças") {
      targetList = taskLists[i];
      break;
    }
  }

  if (!targetList) {
    return 0;
  }

  const tasksResponse = Tasks.Tasks.list(targetList.id, {
    showCompleted: false,
    showHidden: false
  });
  const tasks = (tasksResponse && tasksResponse.items) || [];
  if (tasks.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task.title || task.status === "completed" || task.hidden) {
      continue;
    }
    if (task.title.indexOf(";") === -1) {
      continue;
    }

    const parts = task.title.split(";").map(function (s) {
      return s.trim();
    });
    if (parts.length < 9) {
      continue;
    }

    const valorNum = parseFloat(parts[3].replace(",", "."));
    if (isNaN(valorNum)) {
      continue;
    }

    const paidBy = normalizeMember(parts[6]);
    const scope = normalizeScope(parts[7], paidBy);
    const descricao = parts.slice(8).join("; ").trim();

    const payload = {
      data_competencia: parts[0],
      tipo_fluxo: parts[1],
      categoria: parts[2],
      valor: valorNum,
      conta: parts[4] || "Nubank",
      total_parcelas: parseInt(parts[5], 10) || 1,
      pago_por: paidBy,
      escopo: scope,
      descricao: descricao || "Lançamento via Gem"
    };

    // Insere as linhas na planilha e SOMENTE após sucesso remove a task da fila
    recordTransactionRows(ss, payload);
    Tasks.Tasks.remove(targetList.id, task.id);
    processedCount++;
  }

  return processedCount;
}

/**
 * Lê todas as linhas de uma aba do Google Sheets e transforma em array de objetos JSON.
 */
function getSheetData(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, idx) {
      const cell = row[idx];
      if (Object.prototype.toString.call(cell) === "[object Date]") {
        obj[h] = formatDateISO(cell);
      } else {
        obj[h] = cell;
      }
    });
    return obj;
  });
}
