import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getRealisticDemoDataset,
  getWorstCaseDataset,
} from "../demo-datasets";
import {
  calculateCoupleSettlement,
  calculateIncomeAllocation,
  projectFutureInvoices,
} from "@/lib/domain/financial-engine";
import { DashboardPayloadSchema } from "@/lib/domain/types";
import { GET, POST, resetDemoMemoryStore } from "@/app/api/sheets/route";

describe("demo-datasets & /api/sheets BFF Route", () => {
  beforeEach(() => {
    delete process.env.GAS_URL;
    delete process.env.GAS_SECRET_TOKEN;
    resetDemoMemoryStore();
  });

  it("getRealisticDemoDataset valida contra DashboardPayloadSchema e reproduz os números de Giovanni e Maria Luiza", () => {
    const demo = getRealisticDemoDataset("2026-11");
    const parsed = DashboardPayloadSchema.safeParse(demo);
    expect(parsed.success).toBe(true);

    // Renda de 2026-11 = R$ 8.000,00 (Giovanni 4.500 + Maria Luiza 3.500)
    const allocComp = calculateIncomeAllocation(
      demo.transacoes,
      "2026-11",
      "COMPETENCIA"
    );
    expect(allocComp.rendaTotal).toBe(8000);

    // Competência vs Caixa possuem valores distintos em 2026-11 devido aos parcelamentos
    const allocCaixa = calculateIncomeAllocation(
      demo.transacoes,
      "2026-11",
      "CAIXA"
    );
    expect(allocComp.custosTotal).not.toBe(allocCaixa.custosTotal);

    // Couple Settlement em 2026-11:
    // Giovanni: 400 - 120 = 280
    // Maria Luiza: 400 - 90 + 40 = 350
    const settlement = calculateCoupleSettlement(
      demo.transacoes,
      demo.config,
      "2026-11",
      "COMPETENCIA"
    );
    expect(settlement.giovanni.saldoDisponivel).toBe(280);
    expect(settlement.giovanni.status).toBe("DISPONIVEL");
    expect(settlement.mariaLuiza.gastosIndividuaisEmConjunta).toBe(90);
    expect(settlement.mariaLuiza.gastosConjuntosEmIndividual).toBe(40);
    expect(settlement.mariaLuiza.saldoDisponivel).toBe(350);
    expect(settlement.mariaLuiza.status).toBe("DISPONIVEL");

    // Projeção de faturas futuras em 2026-12, 2027-01 e 2027-02
    const future = projectFutureInvoices(demo.transacoes, "2026-11");
    const futureMonths = future.map((f) => f.yearMonth);
    expect(futureMonths).toContain("2026-12");
    expect(futureMonths).toContain("2027-01");
    expect(futureMonths).toContain("2027-02");
  });

  it("getWorstCaseDataset valida todos os casos extremos da skill break-ui", () => {
    const worst = getWorstCaseDataset("2026-11");
    const parsed = DashboardPayloadSchema.safeParse(worst);
    expect(parsed.success).toBe(true);

    // 1. Extrapolação de cota para ambos (L_{u,m} < 0 -> RESTITUIR_CAIXA)
    const settlement = calculateCoupleSettlement(
      worst.transacoes,
      worst.config,
      "2026-11",
      "COMPETENCIA"
    );
    expect(settlement.giovanni.status).toBe("RESTITUIR_CAIXA");
    expect(settlement.giovanni.saldoDisponivel).toBeLessThan(0);
    expect(settlement.mariaLuiza.status).toBe("RESTITUIR_CAIXA");
    expect(settlement.mariaLuiza.saldoDisponivel).toBeLessThan(0);

    // 2. Dízima periódica de R$ 100 em 3x (-33.34, -33.33, -33.33)
    const dizima3x = worst.transacoes.filter(
      (t) => t.id_plano_parcelas === "plan_worst_dizima_3x"
    );
    expect(dizima3x.map((t) => t.valor)).toEqual([-33.34, -33.33, -33.33]);

    // 3. Mês 2026-09 com Renda R$ 0,00 e custos presentes sem NaN% ou Infinity%
    const zeroIncomeAlloc = calculateIncomeAllocation(
      worst.transacoes,
      "2026-09",
      "CAIXA"
    );
    expect(zeroIncomeAlloc.rendaTotal).toBe(0);
    expect(zeroIncomeAlloc.custosTotal).toBeGreaterThan(0);
    expect(Number.isNaN(zeroIncomeAlloc.percentualCustos)).toBe(false);
    expect(zeroIncomeAlloc.percentualCustos).toBe(0);
  });

  it("API /api/sheets GET e POST funcionam em modo DEMO em memória desdobrando parcelas", async () => {
    const getReq = new NextRequest("http://localhost:3000/api/sheets?mode=DEMO");
    const getRes = await GET(getReq);
    const initialData = await getRes.json();
    const initialCount = initialData.transacoes.length;
    expect(initialData.mode).toBe("DEMO");
    expect(initialData.isConnectedToSheets).toBe(false);

    // Criar nova transação parcelada em 3x no modo DEMO
    const postReq = new NextRequest("http://localhost:3000/api/sheets", {
      method: "POST",
      body: JSON.stringify({
        data_competencia: "2026-11-10",
        tipo_fluxo: "CUSTO",
        categoria: "Lazer",
        descricao: "Ingressos Teatro Municipal",
        valor: -100,
        conta: "Nubank Conjunta",
        pago_por: "Giovanni",
        escopo: "CONJUNTO",
        total_parcelas: 3,
        mode: "DEMO",
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.status).toBe("SUCCESS");
    expect(postJson.count).toBe(3);
    expect(postJson.createdTransactions).toHaveLength(3);
    expect(postJson.createdTransactions[0].valor).toBe(-33.34);

    // Verificar que o GET subsequente reflete as 3 parcelas inseridas no store em memória
    const afterGetRes = await GET(
      new NextRequest("http://localhost:3000/api/sheets?mode=DEMO")
    );
    const afterData = await afterGetRes.json();
    expect(afterData.transacoes.length).toBe(initialCount + 3);

    // Testar RESET_DEMO
    const resetRes = await POST(
      new NextRequest("http://localhost:3000/api/sheets", {
        method: "POST",
        body: JSON.stringify({ action: "RESET_DEMO" }),
      })
    );
    expect(resetRes.status).toBe(200);

    const afterResetRes = await GET(
      new NextRequest("http://localhost:3000/api/sheets?mode=DEMO")
    );
    const afterResetData = await afterResetRes.json();
    expect(afterResetData.transacoes.length).toBe(initialCount);
  });
});
