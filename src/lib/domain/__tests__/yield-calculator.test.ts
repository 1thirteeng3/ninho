import { describe, expect, it } from "vitest";
import {
  calculateAssetProjection,
  parseYieldRateDescription,
} from "../yield-calculator";

describe("yield-calculator", () => {
  it("interpreta taxas % do CDI, prefixado e IPCA+", () => {
    const cdi100 = parseYieldRateDescription("100% do CDI em dias uteis", 11.15);
    expect(cdi100.isRecognized).toBe(true);
    expect(cdi100.annualRatePct).toBe(11.15);
    expect(cdi100.monthlyRatePct).toBeGreaterThan(0.8);

    const cdi110 = parseYieldRateDescription("110% CDI", 10);
    expect(cdi110.annualRatePct).toBe(11);

    const ipca = parseYieldRateDescription("IPCA + 6,45% a.a.", 11.15, 4.5);
    expect(ipca.isRecognized).toBe(true);
    expect(ipca.annualRatePct).toBeCloseTo(11.24, 1);
  });

  it("projeta 12 meses com aporte mensal e reinvestimento automático", () => {
    const withReinvest = calculateAssetProjection(
      {
        rendimento: "100% do CDI",
        saldo_atual: 40000,
        valor_aportado: 40000,
        aporte_mensal: 1000,
        reinvestimento_automatico: true,
        data_atualizacao: "",
      },
      11.15
    );

    const withoutReinvest = calculateAssetProjection(
      {
        rendimento: "100% do CDI",
        saldo_atual: 40000,
        valor_aportado: 40000,
        aporte_mensal: 1000,
        reinvestimento_automatico: false,
        data_atualizacao: "",
      },
      11.15
    );

    expect(withReinvest.estimatedMonthlyYieldBRL).toBeGreaterThan(300);
    expect(withReinvest.projected12MonthsBRL).toBeGreaterThan(52000);
    expect(withReinvest.projected12MonthsBRL).toBeGreaterThan(
      withoutReinvest.projected12MonthsBRL
    );
  });
});
