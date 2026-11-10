import { describe, it, expect } from "vitest";
import {
  roundCurrency,
  filterTransactionsByMonth,
  calculateIncomeAllocation,
  calculateCoupleSettlement,
  splitInstallmentsWithBillingCycle,
  projectFutureInvoices,
} from "../financial-engine";
import type { Transaction, CoupleConfig } from "../types";

const makeTx = (overrides: Partial<Transaction>): Transaction => ({
  id: "tx_1",
  data_competencia: "2026-11-10",
  data_caixa: "2026-11-10",
  tipo_fluxo: "CUSTO",
  categoria: "Lazer",
  descricao: "Jantar",
  valor: -100,
  conta: "Nubank Conjunta",
  pago_por: "Giovanni",
  escopo: "CONJUNTO",
  parcela_atual: 1,
  total_parcelas: 1,
  id_plano_parcelas: "",
  ...overrides,
});

const defaultConfigs: CoupleConfig[] = [
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

describe("financial-engine — Motor Matemático de Finanças Casal", () => {
  describe("roundCurrency & filterTransactionsByMonth", () => {
    it("arredonda valores monetários para exatamente 2 casas decimais com precisão de centavos", () => {
      expect(roundCurrency(10.005)).toBe(10.01);
      expect(roundCurrency(33.3333333)).toBe(33.33);
      expect(roundCurrency(-19.999)).toBe(-20);
    });

    it("filtra transações respeitando a bimodalidade temporal (CAIXA vs COMPETENCIA)", () => {
      const transactions: Transaction[] = [
        makeTx({
          id: "tx_nov_comp_dez_caixa",
          data_competencia: "2026-11-18",
          data_caixa: "2026-12-22",
          valor: -500,
        }),
        makeTx({
          id: "tx_nov_ambos",
          data_competencia: "2026-11-05",
          data_caixa: "2026-11-05",
          valor: -150,
        }),
      ];

      const competenciaNov = filterTransactionsByMonth(
        transactions,
        "2026-11",
        "COMPETENCIA"
      );
      const caixaNov = filterTransactionsByMonth(transactions, "2026-11", "CAIXA");
      const caixaDez = filterTransactionsByMonth(transactions, "2026-12", "CAIXA");

      expect(competenciaNov.map((t) => t.id)).toEqual([
        "tx_nov_comp_dez_caixa",
        "tx_nov_ambos",
      ]);
      expect(caixaNov.map((t) => t.id)).toEqual(["tx_nov_ambos"]);
      expect(caixaDez.map((t) => t.id)).toEqual(["tx_nov_comp_dez_caixa"]);
    });
  });

  describe("calculateIncomeAllocation (Seção 4.2.1)", () => {
    it("calcula alocação descritiva real (R_m, C_k,m, P_p,m, I_j,m e saldo residual Delta_m)", () => {
      const transactions: Transaction[] = [
        makeTx({
          id: "r1",
          tipo_fluxo: "RENDA",
          categoria: "Salário / Renda",
          valor: 5000,
          pago_por: "Giovanni",
        }),
        makeTx({
          id: "r2",
          tipo_fluxo: "RENDA",
          categoria: "Salário / Renda",
          valor: 3000,
          pago_por: "Maria Luiza",
        }),
        makeTx({
          id: "c1",
          tipo_fluxo: "CUSTO",
          categoria: "Habitação & Fixos",
          valor: -2600,
        }),
        makeTx({
          id: "c2",
          tipo_fluxo: "CUSTO",
          categoria: "Carro",
          valor: -1100,
        }),
        makeTx({
          id: "c3",
          tipo_fluxo: "CUSTO",
          categoria: "Saúde",
          valor: -650,
        }),
        makeTx({
          id: "c4",
          tipo_fluxo: "CUSTO",
          categoria: "Lazer",
          valor: -650,
        }),
        makeTx({
          id: "c5",
          tipo_fluxo: "CUSTO",
          categoria: "Estudos (Custeio)",
          valor: -400,
        }),
        makeTx({
          id: "p1",
          tipo_fluxo: "PROVISAO_ANUAL",
          categoria: "Fundo Anual (Carro/Impostos)",
          valor: -400,
        }),
        makeTx({
          id: "i1",
          tipo_fluxo: "INVESTIMENTO",
          categoria: "Casa",
          valor: 1000,
        }),
        makeTx({
          id: "i2",
          tipo_fluxo: "INVESTIMENTO",
          categoria: "Viagem",
          valor: 500,
        }),
        makeTx({
          id: "i3",
          tipo_fluxo: "INVESTIMENTO",
          categoria: "Estudos (Fundo Futuro)",
          valor: 300,
        }),
      ];

      const allocation = calculateIncomeAllocation(
        transactions,
        "2026-11",
        "COMPETENCIA"
      );

      expect(allocation.rendaTotal).toBe(8000);
      expect(allocation.custosTotal).toBe(5400);
      expect(allocation.provisoesTotal).toBe(400);
      expect(allocation.investimentosTotal).toBe(1800);
      expect(allocation.saldoResidual).toBe(400); // 8000 - (5400 + 400 + 1800)
      expect(allocation.percentualCustos).toBe(67.5);
      expect(allocation.percentualInvestimentos).toBe(22.5);
      expect(allocation.percentualProvisoes).toBe(5);

      const hab = allocation.categoriasCusto.find(
        (c) => c.categoria === "Habitação & Fixos"
      );
      expect(hab?.valor).toBe(2600);
      expect(hab?.percentualRenda).toBe(32.5);

      const casa = allocation.categoriasInvestimento.find(
        (i) => i.categoria === "Casa"
      );
      expect(casa?.valor).toBe(1000);
      expect(casa?.percentualRenda).toBe(12.5);
    });

    it("não retorna NaN nem Infinity quando a renda do mês R_m é zero", () => {
      const transactions: Transaction[] = [
        makeTx({
          id: "c1",
          tipo_fluxo: "CUSTO",
          categoria: "Carro",
          valor: -350,
        }),
      ];

      const allocation = calculateIncomeAllocation(
        transactions,
        "2026-11",
        "CAIXA"
      );

      expect(allocation.rendaTotal).toBe(0);
      expect(allocation.custosTotal).toBe(350);
      expect(allocation.saldoResidual).toBe(-350);
      expect(allocation.percentualCustos).toBe(0);
      expect(allocation.percentualInvestimentos).toBe(0);
      expect(allocation.percentualProvisoes).toBe(0);
      expect(Number.isNaN(allocation.percentualCustos)).toBe(false);
      expect(
        allocation.categoriasCusto.every((c) => !Number.isNaN(c.percentualRenda))
      ).toBe(true);
    });
  });

  describe("calculateCoupleSettlement — Reconciliação Conjugal (Seção 4.2.2)", () => {
    it("calcula saldo disponível positivo (DISPONIVEL) quando gastos individuais ficam dentro da cota", () => {
      const transactions: Transaction[] = [
        makeTx({
          id: "g_ind_1",
          pago_por: "Giovanni",
          escopo: "INDIVIDUAL_GIOVANNI",
          categoria: "Cota Individual",
          conta: "Nubank Conjunta",
          valor: -120,
        }),
        makeTx({
          id: "m_ind_1",
          pago_por: "Maria Luiza",
          escopo: "INDIVIDUAL_MARIA_LUIZA",
          categoria: "Cota Individual",
          conta: "Nubank Conjunta",
          valor: -50,
        }),
      ];

      const settlement = calculateCoupleSettlement(
        transactions,
        defaultConfigs,
        "2026-11",
        "COMPETENCIA"
      );

      expect(settlement.giovanni.cotaMensal).toBe(400);
      expect(settlement.giovanni.gastosIndividuaisEmConjunta).toBe(120);
      expect(settlement.giovanni.gastosConjuntosEmIndividual).toBe(0);
      expect(settlement.giovanni.saldoDisponivel).toBe(280);
      expect(settlement.giovanni.status).toBe("DISPONIVEL");
      expect(settlement.giovanni.valorRestituir).toBe(0);

      expect(settlement.mariaLuiza.cotaMensal).toBe(400);
      expect(settlement.mariaLuiza.gastosIndividuaisEmConjunta).toBe(50);
      expect(settlement.mariaLuiza.saldoDisponivel).toBe(350);
      expect(settlement.mariaLuiza.status).toBe("DISPONIVEL");
      expect(settlement.mariaLuiza.valorRestituir).toBe(0);
    });

    it("credita gasto CONJUNTO pago com conta Pessoal/Individual (+D_conj_em_ind) e detecta extrapolação de cota (RESTITUIR_CAIXA)", () => {
      const transactions: Transaction[] = [
        // Giovanni gastou 520 de escopo individual no cartão conjunto -> extrapola 400 em 120
        makeTx({
          id: "g_ind_heavy",
          pago_por: "Giovanni",
          escopo: "INDIVIDUAL_GIOVANNI",
          categoria: "Cota Individual",
          conta: "Nubank Conjunta",
          valor: -520,
        }),
        // Maria Luiza gastou 100 individual, mas pagou uma conta conjunta de 180 com sua Conta Pessoal
        makeTx({
          id: "m_ind_1",
          pago_por: "Maria Luiza",
          escopo: "INDIVIDUAL_MARIA_LUIZA",
          categoria: "Cota Individual",
          conta: "Nubank Conjunta",
          valor: -100,
        }),
        makeTx({
          id: "m_conj_in_ind",
          pago_por: "Maria Luiza",
          escopo: "CONJUNTO",
          categoria: "Saúde",
          conta: "Itaú Pessoal Maria Luiza",
          valor: -180,
        }),
      ];

      const settlement = calculateCoupleSettlement(
        transactions,
        defaultConfigs,
        "2026-11",
        "COMPETENCIA"
      );

      // Giovanni: 400 - 520 + 0 = -120 -> RESTITUIR_CAIXA (120)
      expect(settlement.giovanni.saldoDisponivel).toBe(-120);
      expect(settlement.giovanni.status).toBe("RESTITUIR_CAIXA");
      expect(settlement.giovanni.valorRestituir).toBe(120);

      // Maria Luiza: 400 - 100 + 180 = 480 -> DISPONIVEL
      expect(settlement.mariaLuiza.gastosIndividuaisEmConjunta).toBe(100);
      expect(settlement.mariaLuiza.gastosConjuntosEmIndividual).toBe(180);
      expect(settlement.mariaLuiza.saldoDisponivel).toBe(480);
      expect(settlement.mariaLuiza.status).toBe("DISPONIVEL");
      expect(settlement.mariaLuiza.valorRestituir).toBe(0);
    });
  });

  describe("splitInstallmentsWithBillingCycle — Desdobramento de Parcelas e Ciclo de Fatura (Seção 4.2.3)", () => {
    it("divide R$ 100,00 em 3x aplicando diferença de centavos na parcela 1 (-33.34, -33.33, -33.33)", () => {
      const installments = splitInstallmentsWithBillingCycle(
        {
          data_competencia: "2026-11-10",
          tipo_fluxo: "CUSTO",
          categoria: "Carro",
          descricao: "Alinhamento",
          valor: -100,
          conta: "Nubank",
          pago_por: "Giovanni",
          escopo: "CONJUNTO",
          total_parcelas: 3,
        },
        defaultConfigs[0] // fechamento dia 15, vencimento dia 22
      );

      expect(installments).toHaveLength(3);
      expect(installments.map((i) => i.valor)).toEqual([-33.34, -33.33, -33.33]);
      expect(
        roundCurrency(installments.reduce((acc, cur) => acc + cur.valor, 0))
      ).toBe(-100);

      // Compra dia 10 < fechamento dia 15 -> delta_0 = 0 -> 1ª parcela vence em 2026-11-22
      expect(installments[0]?.data_caixa).toBe("2026-11-22");
      expect(installments[1]?.data_caixa).toBe("2026-12-22");
      expect(installments[2]?.data_caixa).toBe("2027-01-22");
      expect(installments[0]?.descricao).toBe("Alinhamento (1/3)");
    });

    it("desloca a primeira parcela para o mês seguinte (delta_0 = 1) quando compra ocorre no dia ou após o fechamento", () => {
      const installments = splitInstallmentsWithBillingCycle(
        {
          data_competencia: "2026-11-15", // exatamente no dia de fechamento (15)
          tipo_fluxo: "CUSTO",
          categoria: "Lazer",
          descricao: "Show",
          valor: -200,
          conta: "Nubank",
          pago_por: "Giovanni",
          escopo: "CONJUNTO",
          total_parcelas: 2,
        },
        defaultConfigs[0] // fechamento 15, vencimento 22
      );

      expect(installments).toHaveLength(2);
      expect(installments[0]?.data_competencia).toBe("2026-11-15");
      expect(installments[0]?.data_caixa).toBe("2026-12-22");
      expect(installments[1]?.data_caixa).toBe("2027-01-22");
    });
  });

  describe("projectFutureInvoices — Radar de Passivos Futuros", () => {
    it("agrupa transações de custo de meses futuros por YYYY-MM e por conta cronologicamente", () => {
      const transactions: Transaction[] = [
        makeTx({
          id: "cur_1",
          data_caixa: "2026-11-22",
          valor: -300,
          conta: "Nubank",
        }),
        makeTx({
          id: "fut_dez_1",
          data_caixa: "2026-12-22",
          valor: -420,
          conta: "Nubank",
        }),
        makeTx({
          id: "fut_dez_2",
          data_caixa: "2026-12-27",
          valor: -1000,
          conta: "Itaú",
        }),
        makeTx({
          id: "fut_jan_1",
          data_caixa: "2027-01-22",
          valor: -420,
          conta: "Nubank",
        }),
      ];

      const projection = projectFutureInvoices(transactions, "2026-11");

      expect(projection).toHaveLength(2);
      expect(projection[0]?.yearMonth).toBe("2026-12");
      expect(projection[0]?.totalCommitted).toBe(1420);
      expect(projection[0]?.byAccount["Nubank"]).toBe(420);
      expect(projection[0]?.byAccount["Itaú"]).toBe(1000);

      expect(projection[1]?.yearMonth).toBe("2027-01");
      expect(projection[1]?.totalCommitted).toBe(420);
    });
  });
});
