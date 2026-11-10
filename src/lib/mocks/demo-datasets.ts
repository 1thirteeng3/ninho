import {
  roundCurrency,
  splitInstallmentsWithBillingCycle,
} from "@/lib/domain/financial-engine";
import type {
  AnnualProvision,
  CoupleConfig,
  DashboardPayload,
  InvestmentAsset,
  InvestmentGoal,
  ReceivablePlan,
  Transaction,
} from "@/lib/domain/types";

const DEFAULT_COUPLE_CONFIG: CoupleConfig[] = [
  {
    usuario: "Giovanni",
    cota_mensal_livre: 400,
    dia_fechamento_cartao: 15,
    dia_vencimento_cartao: 22,
  },
  {
    usuario: "Maria Luiza",
    cota_mensal_livre: 400,
    dia_fechamento_cartao: 20,
    dia_vencimento_cartao: 27,
  },
];

const REALISTIC_PROVISIONS: AnnualProvision[] = [
  {
    item: "IPVA e Licenciamento",
    categoria_pai: "Fundo Anual (Carro/Impostos)",
    valor_anual_estimado: 2800,
    mes_vencimento: "01",
    saldo_acumulado: 2100,
  },
  {
    item: "Seguro Automotivo",
    categoria_pai: "Fundo Anual (Carro/Impostos)",
    valor_anual_estimado: 2000,
    mes_vencimento: "05",
    saldo_acumulado: 1500,
  },
  {
    item: "Revisão Anual",
    categoria_pai: "Fundo Anual (Carro/Impostos)",
    valor_anual_estimado: 1200,
    mes_vencimento: "09",
    saldo_acumulado: 600,
  },
];

const REALISTIC_INVESTMENT_GOALS: InvestmentGoal[] = [
  {
    id_meta: "meta_casa",
    nome: "Casa",
    tipo: "PATRIMONIO",
    valor_alvo: 80000,
    total_aportado: 39500,
    saldo_bruto_atual: 42000,
  },
  {
    id_meta: "meta_viagem",
    nome: "Viagem",
    tipo: "OBJETIVO_CONSUMO",
    valor_alvo: 10000,
    total_aportado: 6100,
    saldo_bruto_atual: 6500,
  },
  {
    id_meta: "meta_estudos",
    nome: "Estudos (Fundo Futuro)",
    tipo: "OBJETIVO_CONSUMO",
    valor_alvo: 15000,
    total_aportado: 3980,
    saldo_bruto_atual: 4200,
  },
  {
    id_meta: "meta_reserva",
    nome: "Reserva & Patrimônio",
    tipo: "PATRIMONIO",
    valor_alvo: 30000,
    total_aportado: 18000,
    saldo_bruto_atual: 19620,
  },
];

const REALISTIC_INVESTMENT_ASSETS: InvestmentAsset[] = [
  {
    id: "asset_casa_tesouro",
    nome: "Tesouro IPCA+ 2029 (Entrada Apartamento)",
    tipo_ativo: "Tesouro Direto",
    rendimento: "IPCA + 6,45% ao ano",
    liquidez: "D+1 (Marcação a mercado)",
    instituicao: "XP Investimentos",
    meta_vinculada: "Casa",
    titular: "Casal",
    valor_aportado: 24500,
    saldo_atual: 26100,
  },
  {
    id: "asset_casa_lci",
    nome: "LCI Banco Inter Imobiliário Isento IR",
    tipo_ativo: "LCI / LCA",
    rendimento: "94% do CDI (Isento de IR)",
    liquidez: "90 dias",
    instituicao: "Banco Inter",
    meta_vinculada: "Casa",
    titular: "Casal",
    valor_aportado: 15000,
    saldo_atual: 15900,
  },
  {
    id: "asset_viagem_caixinha",
    nome: "Caixinha Nubank Eurotrip & Férias",
    tipo_ativo: "Caixinha / Conta Remunerada",
    rendimento: "100% do CDI",
    liquidez: "Diária imediata",
    instituicao: "Nubank",
    meta_vinculada: "Viagem",
    titular: "Maria Luiza",
    valor_aportado: 6100,
    saldo_atual: 6500,
  },
  {
    id: "asset_estudos_cdb",
    nome: "CDB Itaú Pós-Graduação & Certificações",
    tipo_ativo: "CDB",
    rendimento: "108% do CDI",
    liquidez: "Diária",
    instituicao: "Itaú",
    meta_vinculada: "Estudos (Fundo Futuro)",
    titular: "Giovanni",
    valor_aportado: 3980,
    saldo_atual: 4200,
  },
  {
    id: "asset_reserva_caixinha",
    nome: "Caixinha Reserva de Emergência Casal",
    tipo_ativo: "Caixinha / Conta Remunerada",
    rendimento: "100% do CDI",
    liquidez: "Imediata 24h",
    instituicao: "Nubank",
    meta_vinculada: "Reserva & Patrimônio",
    titular: "Casal",
    valor_aportado: 11000,
    saldo_atual: 11820,
  },
  {
    id: "asset_reserva_cdb",
    nome: "CDB BTG Pactual Liquidez + FIIs",
    tipo_ativo: "CDB",
    rendimento: "112% do CDI",
    liquidez: "Diária",
    instituicao: "BTG Pactual",
    meta_vinculada: "Reserva & Patrimônio",
    titular: "Casal",
    valor_aportado: 7000,
    saldo_atual: 7800,
  },
];

const REALISTIC_RECEIVABLES: ReceivablePlan[] = [
  {
    id: "rec_iphone_antigo",
    descricao: "Venda do iPhone 13 antigo",
    pagador_origem: "Pedro (Amigo)",
    recebedor: "Giovanni",
    valor_total: 2400,
    total_parcelas: 3,
    parcelas_recebidas: 1,
    proximo_vencimento: "2026-11-15",
    conta_destino: "Nubank Conjunta",
    status: "EM_ANDAMENTO",
  },
  {
    id: "rec_reembolso_exames",
    descricao: "Reembolso Exames Laboratoriais",
    pagador_origem: "Plano de Saúde Bradesco",
    recebedor: "Maria Luiza",
    valor_total: 380,
    total_parcelas: 1,
    parcelas_recebidas: 0,
    proximo_vencimento: "2026-11-20",
    conta_destino: "Itaú Conjunta",
    status: "EM_ANDAMENTO",
  },
  {
    id: "rec_consultoria_extra",
    descricao: "Consultoria Arquitetura & Design",
    pagador_origem: "Cliente Studio",
    recebedor: "Casal",
    valor_total: 1800,
    total_parcelas: 2,
    parcelas_recebidas: 1,
    proximo_vencimento: "2026-12-05",
    conta_destino: "Nubank Conjunta",
    status: "EM_ANDAMENTO",
  },
];

/**
 * Recalcula total_aportado e saldo_bruto_atual de cada meta a partir dos ativos vinculados.
 */
export function syncGoalsFromAssets(
  goals: InvestmentGoal[],
  assets: InvestmentAsset[]
): InvestmentGoal[] {
  return goals.map((goal) => {
    const linked = assets.filter(
      (a) =>
        a.meta_vinculada.trim().toLowerCase() ===
        String(goal.nome).trim().toLowerCase()
    );
    if (linked.length === 0) {
      return { ...goal };
    }
    const totalAportado = roundCurrency(
      linked.reduce((acc, item) => acc + item.valor_aportado, 0)
    );
    const saldoBruto = roundCurrency(
      linked.reduce((acc, item) => acc + item.saldo_atual, 0)
    );
    return {
      ...goal,
      total_aportado: totalAportado,
      saldo_bruto_atual: saldoBruto,
    };
  });
}

/**
 * Dataset realista de demonstração para Giovanni e Maria Luiza (arquitetura.txt).
 * Cobre:
 * - Renda mensal de R$ 8.000,00 em 2026-11 (Giovanni: R$ 4.500; Maria Luiza: R$ 3.500),
 *   além de histórico em 2026-10 e faturas projetadas até 2027-02.
 * - As 6 categorias de custo com divergência real entre data_competencia e data_caixa.
 * - Cruzamento de contas do Couple Settlement Engine:
 *   - Giovanni: R$ 120,00 individuais no cartão conjunto -> saldo disponível R$ 280,00.
 *   - Maria Luiza: R$ 90,00 individuais no cartão conjunto + R$ 40,00 de farmácia conjunta
 *     paga com "Itaú Individual" -> saldo disponível 400 - 90 + 40 = R$ 350,00.
 * - Provisões Anuais (Sinking Funds) e Metas de Investimento Bifurcadas (Aportado vs. Bruto).
 */
export function getRealisticDemoDataset(
  _referenceYearMonth = "2026-11"
): DashboardPayload {
  const giovanniCard = DEFAULT_COUPLE_CONFIG[0]!;
  const mariaLuizaCard = DEFAULT_COUPLE_CONFIG[1]!;

  // Parcelamentos desdobrados pelo motor de ciclo de faturas
  const pneusInstallments = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_demo_pneus",
      data_competencia: "2026-11-10", // < 15 -> 1ª parcela em 2026-11-22, depois 2026-12-22, 2027-01-22, 2027-02-22
      tipo_fluxo: "CUSTO",
      categoria: "Carro",
      descricao: "Jogo de Pneus Michelin + Alinhamento",
      valor: -1200,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      total_parcelas: 4,
      id_plano_parcelas: "plan_demo_pneus_4x",
    },
    giovanniCard
  );

  const jantarPosFechamento = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_demo_aniversario",
      data_competencia: "2026-11-18", // >= 15 (fechamento Giovanni) -> delta_0 = 1 -> 1ª em 2026-12-22, 2ª em 2027-01-22
      tipo_fluxo: "CUSTO",
      categoria: "Lazer",
      descricao: "Jantar Degustação Aniversário de Casamento",
      valor: -440,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      total_parcelas: 2,
      id_plano_parcelas: "plan_demo_aniversario_2x",
    },
    giovanniCard
  );

  const checkupOdonto = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_demo_odonto",
      data_competencia: "2026-11-12", // < 20 (fechamento Maria Luiza) -> 2026-11-27, 2026-12-27, 2027-01-27
      tipo_fluxo: "CUSTO",
      categoria: "Saúde",
      descricao: "Check-up Odontológico & Profilaxia Casal",
      valor: -540,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      total_parcelas: 3,
      id_plano_parcelas: "plan_demo_odonto_3x",
    },
    mariaLuizaCard
  );

  const baseTransactions: Transaction[] = [
    // =========================================================================
    // HISTÓRICO: OUTUBRO 2026 (2026-10)
    // =========================================================================
    {
      id: "tx_oct_renda_gio",
      data_competencia: "2026-10-01",
      data_caixa: "2026-10-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Giovanni",
      valor: 4500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_renda_malu",
      data_competencia: "2026-10-01",
      data_caixa: "2026-10-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Maria Luiza",
      valor: 3500,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_hab_1",
      data_competencia: "2026-10-05",
      data_caixa: "2026-10-05",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Aluguel + Condomínio + Internet Fibra",
      valor: -2350,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_hab_2",
      data_competencia: "2026-10-11",
      data_caixa: "2026-10-22",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Supermercado Pão de Açúcar & Feira",
      valor: -890,
      conta: "Nubank Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_carro_1",
      data_competencia: "2026-10-14",
      data_caixa: "2026-10-22",
      tipo_fluxo: "CUSTO",
      categoria: "Carro",
      descricao: "Combustível Shell Box & Tag Pedágio",
      valor: -460,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_saude_1",
      data_competencia: "2026-10-10",
      data_caixa: "2026-10-10",
      tipo_fluxo: "CUSTO",
      categoria: "Saúde",
      descricao: "Coparticipação Plano de Saúde & Farmácia",
      valor: -410,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_estudos_1",
      data_competencia: "2026-10-08",
      data_caixa: "2026-10-27",
      tipo_fluxo: "CUSTO",
      categoria: "Estudos (Custeio)",
      descricao: "Mensalidade Inglês & Livros Técnicos",
      valor: -380,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_lazer_1",
      data_competencia: "2026-10-19",
      data_caixa: "2026-10-19",
      tipo_fluxo: "CUSTO",
      categoria: "Lazer",
      descricao: "Bistrô Fim de Semana & Cinema",
      valor: -520,
      conta: "Pix Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_prov_1",
      data_competencia: "2026-10-15",
      data_caixa: "2026-10-15",
      tipo_fluxo: "PROVISAO_ANUAL",
      categoria: "Fundo Anual (Carro/Impostos)",
      descricao: "Reserva Mensal p/ Despesas Anuais (IPVA, Seguro e Revisão)",
      valor: -500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_inv_casa",
      data_competencia: "2026-10-05",
      data_caixa: "2026-10-05",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Casa",
      descricao: "Aporte Mensal Fundo Casa Própria (Tesouro IPCA+)",
      valor: 1200,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_oct_inv_reserva",
      data_competencia: "2026-10-05",
      data_caixa: "2026-10-05",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Reserva & Patrimônio",
      descricao: "Aporte Reserva de Liquidez (CDB DI 102%)",
      valor: 600,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    // Compra parcelada feita em Outubro cuja 2ª parcela vence em Novembro (2026-11-22)
    {
      id: "tx_oct_microondas_1",
      data_competencia: "2026-10-09",
      data_caixa: "2026-10-22",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Forno Airfryer Inox Cozinha (1/2)",
      valor: -280,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 2,
      id_plano_parcelas: "plan_demo_airfryer_2x",
    },
    {
      id: "tx_oct_microondas_2",
      data_competencia: "2026-10-09",
      data_caixa: "2026-11-22",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Forno Airfryer Inox Cozinha (2/2)",
      valor: -280,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 2,
      total_parcelas: 2,
      id_plano_parcelas: "plan_demo_airfryer_2x",
    },

    // =========================================================================
    // MÊS ATUAL DE REFERÊNCIA: NOVEMBRO 2026 (2026-11)
    // =========================================================================
    // 1. Rendas do Casal (Total R$ 8.000,00 = Giovanni 4.500 + Maria Luiza 3.500)
    {
      id: "tx_nov_renda_gio",
      data_competencia: "2026-11-01",
      data_caixa: "2026-11-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Giovanni",
      valor: 4500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_renda_malu",
      data_competencia: "2026-11-01",
      data_caixa: "2026-11-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Maria Luiza",
      valor: 3500,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2. Custos Operacionais nas 6 Categorias Oficiais
    // 2.1 Habitação & Fixos
    {
      id: "tx_nov_hab_aluguel",
      data_competencia: "2026-11-05",
      data_caixa: "2026-11-05",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Aluguel + Condomínio + Energia Enel",
      valor: -2150,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_hab_mercado",
      data_competencia: "2026-11-08",
      data_caixa: "2026-11-22",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Supermercado Extra & Hortifruti Semanal",
      valor: -640,
      conta: "Nubank Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2.2 Carro (além do parcelamento de pneus em 4x)
    {
      id: "tx_nov_carro_combustivel",
      data_competencia: "2026-11-07",
      data_caixa: "2026-11-22",
      tipo_fluxo: "CUSTO",
      categoria: "Carro",
      descricao: "Abastecimento Posto Shell + Tag Sem Parar",
      valor: -320,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2.3 Saúde (inclui a despesa conjunta de R$ 40,00 paga por Maria Luiza na conta Itaú Individual)
    {
      id: "tx_nov_saude_farmacia_cruzada",
      data_competencia: "2026-11-09",
      data_caixa: "2026-11-09",
      tipo_fluxo: "CUSTO",
      categoria: "Saúde",
      descricao: "Farmácia Drogasil (Medicamentos Casa)",
      valor: -40,
      conta: "Itaú Individual",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_saude_academia",
      data_competencia: "2026-11-06",
      data_caixa: "2026-11-27",
      tipo_fluxo: "CUSTO",
      categoria: "Saúde",
      descricao: "Plano Academia & Pilates Casal",
      valor: -260,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2.4 Estudos (Custeio)
    {
      id: "tx_nov_estudos_custeio",
      data_competencia: "2026-11-10",
      data_caixa: "2026-11-22",
      tipo_fluxo: "CUSTO",
      categoria: "Estudos (Custeio)",
      descricao: "Assinatura Alura + Livros Arquitetura de Software",
      valor: -310,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2.5 Lazer (além do jantar pós-fechamento em 2x)
    {
      id: "tx_nov_lazer_pizzaria",
      data_competencia: "2026-11-11",
      data_caixa: "2026-11-22",
      tipo_fluxo: "CUSTO",
      categoria: "Lazer",
      descricao: "Noite de Pizza Artesanal & Streaming",
      valor: -230,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 2.6 Cota Individual (Encontro de Contas / Couple Settlement Engine)
    // Giovanni: R$ 120,00 individuais no cartão conjunto -> restam R$ 280,00 de R$ 400,00
    {
      id: "tx_nov_ind_giovanni",
      data_competencia: "2026-11-11",
      data_caixa: "2026-11-11",
      tipo_fluxo: "CUSTO",
      categoria: "Cota Individual",
      descricao: "Fone Bluetooth & Jogo Steam (Cota Giovanni)",
      valor: -120,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "INDIVIDUAL_GIOVANNI",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    // Maria Luiza: R$ 90,00 individuais no cartão conjunto (+ R$ 40,00 de crédito da farmácia conjunta) -> restam R$ 350,00 de R$ 400,00
    {
      id: "tx_nov_ind_malu",
      data_competencia: "2026-11-11",
      data_caixa: "2026-11-11",
      tipo_fluxo: "CUSTO",
      categoria: "Cota Individual",
      descricao: "Cosméticos & Skincare (Cota Maria Luiza)",
      valor: -90,
      conta: "Nubank Conjunta",
      pago_por: "Maria Luiza",
      escopo: "INDIVIDUAL_MARIA_LUIZA",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 3. Provisões Anuais (Sinking Funds 1/12)
    {
      id: "tx_nov_provisao_anual",
      data_competencia: "2026-11-13",
      data_caixa: "2026-11-13",
      tipo_fluxo: "PROVISAO_ANUAL",
      categoria: "Fundo Anual (Carro/Impostos)",
      descricao: "Reserva Mensal p/ Despesas Anuais (IPVA, Seguro e Revisão)",
      valor: -500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // 4. Aportes em Metas de Investimento
    {
      id: "tx_nov_inv_casa",
      data_competencia: "2026-11-12",
      data_caixa: "2026-11-12",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Casa",
      descricao: "Aporte Mensal Fundo Casa (Tesouro IPCA+)",
      valor: 1000,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_inv_viagem",
      data_competencia: "2026-11-12",
      data_caixa: "2026-11-12",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Viagem",
      descricao: "Aporte Programado Fundo Viagem",
      valor: 450,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_inv_estudos",
      data_competencia: "2026-11-12",
      data_caixa: "2026-11-12",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Estudos (Fundo Futuro)",
      descricao: "Aporte Fundo Pós-Graduação / MBA",
      valor: 300,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_nov_inv_reserva",
      data_competencia: "2026-11-12",
      data_caixa: "2026-11-12",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Reserva & Patrimônio",
      descricao: "Reforço Reserva de Emergência & Patrimônio",
      valor: 450,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
  ];

  const transacoes: Transaction[] = [
    ...baseTransactions,
    ...pneusInstallments,
    ...jantarPosFechamento,
    ...checkupOdonto,
  ];

  const initialAssets = REALISTIC_INVESTMENT_ASSETS.map((a) => ({ ...a }));
  const syncedGoals = syncGoalsFromAssets(
    REALISTIC_INVESTMENT_GOALS.map((g) => ({ ...g })),
    initialAssets
  );

  return {
    transacoes,
    investimentos: syncedGoals,
    provisoes: REALISTIC_PROVISIONS.map((p) => ({ ...p })),
    config: DEFAULT_COUPLE_CONFIG.map((c) => ({ ...c })),
    ativos: initialAssets,
    recebiveis: REALISTIC_RECEIVABLES.map((r) => ({ ...r })),
    timestamp: new Date().toISOString(),
    mode: "DEMO",
  };
}

/**
 * Dataset de Pior Caso (Adversarial Stress-Test — skill `break-ui`).
 * Testa limites visuais e matemáticos da aplicação sem alterar componentes:
 * 1. Strings longas sem espaços (tokens de nota fiscal/identificadores bancários) e com emojis/caracteres compostos.
 * 2. Dízimas periódicas em compras de 3x (R$ 100 -> -33.34, -33.33, -33.33), 12x e 24x.
 * 3. Extrapolação da cota individual (L_{u,m} < 0) para AMBOS Giovanni e Maria Luiza em 2026-11,
 *    acionando o badge de restituição ao caixa conjunto.
 * 4. Mês alternativo (2026-09) com Renda R$ 0,00 e custos presentes para provar ausência de NaN% ou Infinity%.
 */
export function getWorstCaseDataset(
  _referenceYearMonth = "2026-11"
): DashboardPayload {
  const giovanniCard = DEFAULT_COUPLE_CONFIG[0]!;
  const mariaLuizaCard = DEFAULT_COUPLE_CONFIG[1]!;

  // 1. Dízima clássica 3x: R$ 100,00 -> -33.34, -33.33, -33.33
  const dizima3x = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_worst_3x",
      data_competencia: "2026-11-04",
      tipo_fluxo: "CUSTO",
      categoria: "Carro",
      descricao: "Balanceamento Precisão Dízima 3x",
      valor: -100,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      total_parcelas: 3,
      id_plano_parcelas: "plan_worst_dizima_3x",
    },
    giovanniCard
  );

  // 2. Dízima longa 12x: R$ 1.000,00 em 12x -> 1ª parcela -83.37, demais 11x de -83.33
  const dizima12x = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_worst_12x",
      data_competencia: "2026-11-06",
      tipo_fluxo: "CUSTO",
      categoria: "Saúde",
      descricao:
        "Tratamento Ortodôntico Especializado 🦷✨ — Dra. Aleksandra Wiśniewska-Kowalczyk",
      valor: -1000,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      total_parcelas: 12,
      id_plano_parcelas: "plan_worst_12x",
    },
    mariaLuizaCard
  );

  // 3. Dízima extrema 24x: R$ 2.500,00 em 24x -> 1ª parcela -104.24, demais 23x de -104.16
  const dizima24x = splitInstallmentsWithBillingCycle(
    {
      id_base: "tx_worst_24x",
      data_competencia: "2026-11-16", // pós-fechamento Giovanni (15) -> projeta 24 meses no Radar de Passivos
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao:
        "CompraInternacionalSupermercadoExtraordinariamenteLongoSemQuebraDeLinha_NF998877665544332211",
      valor: -2500,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      total_parcelas: 24,
      id_plano_parcelas: "plan_worst_24x",
    },
    giovanniCard
  );

  const worstCaseBaseTransactions: Transaction[] = [
    // =========================================================================
    // MÊS DE RENDA ZERO: SETEMBRO 2026 (2026-09) — R_m = R$ 0,00 com custos > 0
    // Prova que calculateIncomeAllocation e a UI nunca geram NaN% ou Infinity%
    // =========================================================================
    {
      id: "tx_worst_sep_custo_1",
      data_competencia: "2026-09-05",
      data_caixa: "2026-09-05",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao: "Despesa Condominial Extraordinária em Mês Sem Renda Cadastrada",
      valor: -1450.75,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_sep_custo_2",
      data_competencia: "2026-09-10",
      data_caixa: "2026-09-10",
      tipo_fluxo: "CUSTO",
      categoria: "Carro",
      descricao: "Bateria Automotiva Emergencial 24h",
      valor: -599.9,
      conta: "Pix Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // =========================================================================
    // MÊS ATUAL DE STRESS: NOVEMBRO 2026 (2026-11)
    // =========================================================================
    {
      id: "tx_worst_nov_renda_gio",
      data_competencia: "2026-11-01",
      data_caixa: "2026-11-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Giovanni + Reembolso Plantão",
      valor: 4500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_nov_renda_malu",
      data_competencia: "2026-11-01",
      data_caixa: "2026-11-01",
      tipo_fluxo: "RENDA",
      categoria: "Salário / Renda",
      descricao: "Salário Mensal Maria Luiza",
      valor: 3500,
      conta: "Itaú Conjunta",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_nov_hab_long",
      data_competencia: "2026-11-03",
      data_caixa: "2026-11-03",
      tipo_fluxo: "CUSTO",
      categoria: "Habitação & Fixos",
      descricao:
        "CompraInternacionalSupermercadoExtraordinariamenteLongoSemQuebraDeLinha_NF998877665544332211",
      valor: -3120.49,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_nov_estudos_emoji",
      data_competencia: "2026-11-07",
      data_caixa: "2026-11-07",
      tipo_fluxo: "CUSTO",
      categoria: "Estudos (Custeio)",
      descricao:
        "📚 Certificação Cloud & AI Engineering — Prüfungsgebühr / 試験費用 (Nível Avançado #2026)",
      valor: -689.99,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_nov_lazer_short",
      data_competencia: "2026-11-08",
      data_caixa: "2026-11-08",
      tipo_fluxo: "CUSTO",
      categoria: "Lazer",
      descricao: "☕",
      valor: -9.5,
      conta: "Pix",
      pago_por: "Maria Luiza",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // Extrapolação de Cota Individual (L_{u,m} < 0) para Giovanni (Cota: 400, Gasto: 685.90 -> -285.90 RESTITUIR_CAIXA)
    {
      id: "tx_worst_nov_ind_giovanni_over",
      data_competencia: "2026-11-09",
      data_caixa: "2026-11-09",
      tipo_fluxo: "CUSTO",
      categoria: "Cota Individual",
      descricao:
        "Upgrade Teclado Mecânico Customizado + Monitor Ultrawide 🎮⚡ (Excesso Cota Giovanni)",
      valor: -685.9,
      conta: "Nubank Conjunta",
      pago_por: "Giovanni",
      escopo: "INDIVIDUAL_GIOVANNI",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    // Extrapolação de Cota Individual (L_{u,m} < 0) para Maria Luiza (Cota: 400, Gasto: 590.40 -> -190.40 RESTITUIR_CAIXA)
    {
      id: "tx_worst_nov_ind_malu_over",
      data_competencia: "2026-11-10",
      data_caixa: "2026-11-10",
      tipo_fluxo: "CUSTO",
      categoria: "Cota Individual",
      descricao:
        "Vestido Festa Casamento + Sapato Couro 👗👠 (Excesso Cota Maria Luiza)",
      valor: -590.4,
      conta: "Nubank Conjunta",
      pago_por: "Maria Luiza",
      escopo: "INDIVIDUAL_MARIA_LUIZA",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },

    {
      id: "tx_worst_nov_provisao",
      data_competencia: "2026-11-11",
      data_caixa: "2026-11-11",
      tipo_fluxo: "PROVISAO_ANUAL",
      categoria: "Fundo Anual (Carro/Impostos)",
      descricao: "Reserva p/ Despesas Anuais IPVA/Seguro/Revisão Lote Extra",
      valor: -750,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
    {
      id: "tx_worst_nov_inv",
      data_competencia: "2026-11-12",
      data_caixa: "2026-11-12",
      tipo_fluxo: "INVESTIMENTO",
      categoria: "Casa",
      descricao: "Aporte Amortização Extraordinária Fundo Imobiliário Casa",
      valor: 1500,
      conta: "Itaú Conjunta",
      pago_por: "Giovanni",
      escopo: "CONJUNTO",
      parcela_atual: 1,
      total_parcelas: 1,
      id_plano_parcelas: "",
    },
  ];

  const worstCaseGoals: InvestmentGoal[] = [
    {
      id_meta: "meta_casa_worst",
      nome: "Casa",
      tipo: "PATRIMONIO",
      valor_alvo: 850000,
      total_aportado: 142350.67,
      saldo_bruto_atual: 168920.14,
    },
    {
      id_meta: "meta_viagem_worst",
      nome: "Viagem",
      tipo: "OBJETIVO_CONSUMO",
      valor_alvo: 12000,
      total_aportado: 12450, // Acima de 100% da meta para testar clamp de barra de progresso
      saldo_bruto_atual: 13180.45,
    },
    {
      id_meta: "meta_estudos_worst",
      nome: "Estudos (Fundo Futuro)",
      tipo: "OBJETIVO_CONSUMO",
      valor_alvo: 45000,
      total_aportado: 0, // 0% aportado para testar estado inicial sem divisão incorreta
      saldo_bruto_atual: 0,
    },
    {
      id_meta: "meta_reserva_worst",
      nome: "Reserva & Patrimônio",
      tipo: "PATRIMONIO",
      valor_alvo: 60000,
      total_aportado: 31200,
      saldo_bruto_atual: 35890.8,
    },
  ];

  return {
    transacoes: [
      ...worstCaseBaseTransactions,
      ...dizima3x,
      ...dizima12x,
      ...dizima24x,
    ],
    investimentos: worstCaseGoals,
    provisoes: REALISTIC_PROVISIONS.map((p) => ({ ...p })),
    config: DEFAULT_COUPLE_CONFIG.map((c) => ({ ...c })),
    ativos: REALISTIC_INVESTMENT_ASSETS.map((a) => ({ ...a })),
    recebiveis: REALISTIC_RECEIVABLES.map((r) => ({ ...r })),
    timestamp: new Date().toISOString(),
    mode: "WORST_CASE",
  };
}

let demoMemoryStore: DashboardPayload | null = null;
let worstCaseExtraTransactions: Transaction[] = [];

export function getOrInitDemoStore(): DashboardPayload {
  if (!demoMemoryStore) {
    demoMemoryStore = getRealisticDemoDataset();
  }
  return demoMemoryStore;
}

export function resetDemoMemoryStore(): DashboardPayload {
  demoMemoryStore = getRealisticDemoDataset();
  worstCaseExtraTransactions = [];
  return demoMemoryStore;
}

export function getWorstCaseExtraTransactions(): Transaction[] {
  return worstCaseExtraTransactions;
}

export function prependWorstCaseExtraTransactions(txs: Transaction[]): void {
  worstCaseExtraTransactions = [...txs, ...worstCaseExtraTransactions];
}

export function upsertDemoAsset(asset: InvestmentAsset): DashboardPayload {
  const store = getOrInitDemoStore();
  const currentAssets = store.ativos ?? [];
  const existingIndex = currentAssets.findIndex((a) => a.id === asset.id);
  const nextAssets =
    existingIndex >= 0
      ? currentAssets.map((a, idx) => (idx === existingIndex ? { ...asset } : a))
      : [{ ...asset }, ...currentAssets];

  store.ativos = nextAssets;
  store.investimentos = syncGoalsFromAssets(store.investimentos, nextAssets);
  store.timestamp = new Date().toISOString();
  return store;
}

export function deleteDemoAsset(id: string): DashboardPayload {
  const store = getOrInitDemoStore();
  const nextAssets = (store.ativos ?? []).filter((a) => a.id !== id);
  store.ativos = nextAssets;
  store.investimentos = syncGoalsFromAssets(store.investimentos, nextAssets);
  store.timestamp = new Date().toISOString();
  return store;
}

export function deleteDemoTransaction(id: string): DashboardPayload {
  const store = getOrInitDemoStore();
  store.transacoes = store.transacoes.filter((t) => t.id !== id);
  worstCaseExtraTransactions = worstCaseExtraTransactions.filter(
    (t) => t.id !== id
  );
  store.timestamp = new Date().toISOString();
  return store;
}

export function upsertDemoReceivable(item: ReceivablePlan): DashboardPayload {
  const store = getOrInitDemoStore();
  const current = store.recebiveis ?? [];
  const idx = current.findIndex((r) => r.id === item.id);
  const nextReceivables =
    idx >= 0
      ? current.map((r, i) => (i === idx ? { ...item } : r))
      : [{ ...item }, ...current];

  store.recebiveis = nextReceivables;
  store.timestamp = new Date().toISOString();
  return store;
}

function advanceIsoMonth(isoDate: string): string {
  const parts = isoDate.trim().split("-");
  const yyyy = Number(parts[0] ?? 2026);
  const mm = Number(parts[1] ?? 11);
  const dd = Number(parts[2] ?? 15);
  const d = new Date(yyyy, mm, dd, 12, 0, 0);
  const nextY = String(d.getFullYear()).padStart(4, "0");
  const nextM = String(d.getMonth() + 1).padStart(2, "0");
  const nextD = String(d.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

export function receiveNextInstallment(
  id: string,
  targetYearMonth = "2026-11"
): {
  store: DashboardPayload;
  updatedReceivable: ReceivablePlan | null;
  createdTransaction: Transaction | null;
} {
  const store = getOrInitDemoStore();
  const current = store.recebiveis ?? [];
  const item = current.find((r) => r.id === id);

  if (!item || item.parcelas_recebidas >= item.total_parcelas) {
    return {
      store,
      updatedReceivable: item ?? null,
      createdTransaction: null,
    };
  }

  const nextParcelaNumber = item.parcelas_recebidas + 1;
  const isCompleted = nextParcelaNumber >= item.total_parcelas;
  const installmentAmount = roundCurrency(
    item.valor_total / Math.max(1, item.total_parcelas)
  );

  const updated: ReceivablePlan = {
    ...item,
    parcelas_recebidas: nextParcelaNumber,
    status: isCompleted ? "CONCLUIDO" : "EM_ANDAMENTO",
    proximo_vencimento: isCompleted
      ? item.proximo_vencimento
      : advanceIsoMonth(item.proximo_vencimento),
  };

  store.recebiveis = current.map((r) => (r.id === id ? updated : r));

  const txDate = `${targetYearMonth.slice(0, 7)}-15`;
  const createdTx: Transaction = {
    id: `tx_rec_${id}_${nextParcelaNumber}_${Date.now()}`,
    data_competencia: txDate,
    data_caixa: txDate,
    tipo_fluxo: "RENDA",
    categoria: "Salário / Renda",
    descricao: `Recebimento: ${item.descricao} (${nextParcelaNumber}/${item.total_parcelas}) — ${item.pagador_origem}`,
    valor: installmentAmount,
    conta: item.conta_destino,
    pago_por: item.recebedor === "Maria Luiza" ? "Maria Luiza" : "Giovanni",
    escopo: "CONJUNTO",
    parcela_atual: nextParcelaNumber,
    total_parcelas: item.total_parcelas,
    id_plano_parcelas: `rec_plan_${id}`,
  };

  store.transacoes = [createdTx, ...store.transacoes];
  store.timestamp = new Date().toISOString();

  return {
    store,
    updatedReceivable: updated,
    createdTransaction: createdTx,
  };
}

export function deleteDemoReceivable(id: string): DashboardPayload {
  const store = getOrInitDemoStore();
  store.recebiveis = (store.recebiveis ?? []).filter((r) => r.id !== id);
  store.timestamp = new Date().toISOString();
  return store;
}

export function payNextPayableInstallment(
  planIdOrTxId: string,
  currentYearMonth = "2026-11"
): {
  store: DashboardPayload;
  paidTransaction: Transaction | null;
} {
  const store = getOrInitDemoStore();
  const ymPrefix = currentYearMonth.trim().slice(0, 7);

  // Find the earliest future installment for this plan or transaction id
  const candidates = store.transacoes
    .filter(
      (t) =>
        (t.id_plano_parcelas === planIdOrTxId || t.id === planIdOrTxId) &&
        t.data_caixa.slice(0, 7) > ymPrefix
    )
    .sort((a, b) => a.parcela_atual - b.parcela_atual);

  const nextToPay = candidates[0];
  if (!nextToPay) {
    return { store, paidTransaction: null };
  }

  const paidDate = `${ymPrefix}-15`;
  const updatedTx: Transaction = {
    ...nextToPay,
    data_caixa: paidDate,
    descricao: nextToPay.descricao.includes("[Antecipada]")
      ? nextToPay.descricao
      : `${nextToPay.descricao} [Antecipada]`,
  };

  store.transacoes = store.transacoes.map((t) =>
    t.id === nextToPay.id ? updatedTx : t
  );
  store.timestamp = new Date().toISOString();

  return { store, paidTransaction: updatedTx };
}
