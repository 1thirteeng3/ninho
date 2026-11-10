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
    initialGoals.forEach(function (row) {
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
    initialProvisions.forEach(function (row) {
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
    cfgSheet.appendRow(["Giovanni", 400.0, 15, 22]);
    cfgSheet.appendRow(["Maria Luiza", 400.0, 20, 27]);
  }

  logEvent("info", "database_sheets_bootstrapped", "setupDatabaseSheets", correlationId, {
    sheets: ["Transacoes", "Investimentos_Metas", "Provisoes_Anuais", "Config_Casal"]
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
    if (!txSheet) {
      setupDatabaseSheets();
      txSheet = ss.getSheetByName("Transacoes");
    }

    const transacoes = getSheetData(txSheet);
    const investimentos = getSheetData(ss.getSheetByName("Investimentos_Metas"));
    const provisoes = getSheetData(ss.getSheetByName("Provisoes_Anuais"));
    const config = getSheetData(ss.getSheetByName("Config_Casal"));

    logEvent("info", "sheet_snapshot_read", "doGet", correlationId, {
      transacoesCount: transacoes.length,
      syncedTasks: syncedTasks
    });

    const response = {
      status: "SUCCESS",
      transacoes: transacoes,
      investimentos: investimentos,
      provisoes: provisoes,
      config: config,
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

    if (bodyData.action === "SYNC_TASKS") {
      const processedCount = syncTasksToSheetsInternal(SpreadsheetApp.getActiveSpreadsheet(), correlationId);
      logEvent("info", "tasks_synced_via_post", "doPost", correlationId, {
        syncedTasks: processedCount
      });
      return ContentService.createTextOutput(
        JSON.stringify({ status: "SUCCESS", syncedTasks: processedCount })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
