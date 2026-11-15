import { roundCurrency } from "./financial-engine";
import type { InvestmentAsset } from "./types";

export const DEFAULT_CDI_ANNUAL_PCT = 11.15;
export const DEFAULT_IPCA_ANNUAL_PCT = 4.5;

export interface ParsedYieldRate {
  annualRatePct: number;
  monthlyRatePct: number;
  dailyBusinessRate: number;
  label: string;
  isRecognized: boolean;
}

export interface AssetYieldProjection {
  parsed: ParsedYieldRate;
  estimatedMonthlyYieldBRL: number;
  estimatedAccruedBRL: number;
  businessDaysElapsed: number;
  projected12MonthsBRL: number;
  projected12MonthsGainBRL: number;
}

/**
 * Interpreta textos como "100% do CDI", "110% CDI em dias úteis", "12,5% a.a.",
 * "1% a.m." ou "IPCA + 6,45% a.a." em taxa anual/mensal efetiva.
 */
export function parseYieldRateDescription(
  description: string,
  cdiAnnualPct: number = DEFAULT_CDI_ANNUAL_PCT,
  ipcaAnnualPct: number = DEFAULT_IPCA_ANNUAL_PCT
): ParsedYieldRate {
  const raw = (description || "").trim();
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let annualRatePct = 0;
  let isRecognized = false;

  // 1. "% do CDI" ou "% CDI" (ex: "100% do CDI em dias uteis", "110% CDI")
  const cdiMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:do\s*)?cdi/);
  if (cdiMatch && cdiMatch[1]) {
    const pctOfCdi = parseFloat(cdiMatch[1].replace(",", "."));
    if (!Number.isNaN(pctOfCdi) && pctOfCdi > 0) {
      annualRatePct = (pctOfCdi / 100) * cdiAnnualPct;
      isRecognized = true;
    }
  }

  // 2. "CDI + X%" (ex: "CDI + 1,5%")
  if (!isRecognized) {
    const cdiPlusMatch = normalized.match(/cdi\s*\+\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (cdiPlusMatch && cdiPlusMatch[1]) {
      const spread = parseFloat(cdiPlusMatch[1].replace(",", "."));
      if (!Number.isNaN(spread)) {
        annualRatePct = cdiAnnualPct + spread;
        isRecognized = true;
      }
    }
  }

  // 3. "IPCA + X%" (ex: "IPCA + 6.45% a.a.")
  if (!isRecognized) {
    const ipcaMatch = normalized.match(/ipca\s*\+\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (ipcaMatch && ipcaMatch[1]) {
      const realRate = parseFloat(ipcaMatch[1].replace(",", "."));
      if (!Number.isNaN(realRate)) {
        annualRatePct =
          ((1 + ipcaAnnualPct / 100) * (1 + realRate / 100) - 1) * 100;
        isRecognized = true;
      }
    }
  }

  // 4. Taxa mensal explícita ("1% a.m.", "0,85% ao mes")
  if (!isRecognized) {
    const monthlyMatch = normalized.match(
      /(\d+(?:[.,]\d+)?)\s*%\s*(?:a\.?m\.?|ao\s*mes)/
    );
    if (monthlyMatch && monthlyMatch[1]) {
      const monthly = parseFloat(monthlyMatch[1].replace(",", "."));
      if (!Number.isNaN(monthly) && monthly > 0) {
        annualRatePct = (Math.pow(1 + monthly / 100, 12) - 1) * 100;
        isRecognized = true;
      }
    }
  }

  // 5. Taxa anual explícita ("12% a.a.", "12,5% ao ano", ou apenas "12%")
  if (!isRecognized) {
    const annualMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (annualMatch && annualMatch[1]) {
      const annual = parseFloat(annualMatch[1].replace(",", "."));
      if (!Number.isNaN(annual) && annual > 0) {
        annualRatePct = annual;
        isRecognized = true;
      }
    }
  }

  const annualDecimal = Math.max(0, annualRatePct) / 100;
  const monthlyDecimal =
    annualDecimal > 0 ? Math.pow(1 + annualDecimal, 1 / 12) - 1 : 0;
  const dailyBusinessRate =
    annualDecimal > 0 ? Math.pow(1 + annualDecimal, 1 / 252) - 1 : 0;

  return {
    annualRatePct: roundCurrency(annualRatePct),
    monthlyRatePct: roundCurrency(monthlyDecimal * 100),
    dailyBusinessRate,
    label: raw || "Sem taxa",
    isRecognized,
  };
}

/**
 * Conta dias úteis aproximados (seg-sex) entre dataISO e hoje.
 */
export function countBusinessDaysSince(dateISO?: string): number {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO.trim())) {
    return 0;
  }
  const [y, m, d] = dateISO.split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0
  );
  if (today <= start) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  // Limite de segurança de 3650 dias (~10 anos)
  while (cursor <= today && count < 3650) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Calcula rendimento mensal estimado, ganho acumulado em dias úteis desde a última atualização
 * e projeção em 12 meses considerando aporte mensal e reinvestimento automático.
 */
export function calculateAssetProjection(
  asset: Pick<
    InvestmentAsset,
    | "rendimento"
    | "saldo_atual"
    | "valor_aportado"
    | "aporte_mensal"
    | "reinvestimento_automatico"
    | "data_atualizacao"
  >,
  cdiAnnualPct: number = DEFAULT_CDI_ANNUAL_PCT
): AssetYieldProjection {
  const parsed = parseYieldRateDescription(asset.rendimento, cdiAnnualPct);
  const monthlyRate = Math.pow(1 + parsed.annualRatePct / 100, 1 / 12) - 1;
  const baseBalance = Math.max(0, asset.saldo_atual || 0);
  const monthlyContribution = Math.max(0, asset.aporte_mensal || 0);
  const reinvest = asset.reinvestimento_automatico !== false;

  const estimatedMonthlyYieldBRL = roundCurrency(baseBalance * monthlyRate);

  const businessDaysElapsed = countBusinessDaysSince(asset.data_atualizacao);
  const estimatedAccruedBRL =
    businessDaysElapsed > 0 && parsed.dailyBusinessRate > 0
      ? roundCurrency(
          baseBalance *
            (Math.pow(1 + parsed.dailyBusinessRate, businessDaysElapsed) - 1)
        )
      : 0;

  // Projeção de 12 meses com ou sem reinvestimento dos rendimentos
  let projected = baseBalance;
  let totalYieldOnly = 0;
  for (let m = 0; m < 12; m++) {
    const monthYield = projected * monthlyRate;
    if (reinvest) {
      projected += monthYield + monthlyContribution;
    } else {
      totalYieldOnly += monthYield;
      projected += monthlyContribution;
    }
  }
  const finalBalance12M = roundCurrency(
    reinvest ? projected : projected + totalYieldOnly
  );
  const totalContributed12M = baseBalance + monthlyContribution * 12;
  const projected12MonthsGainBRL = roundCurrency(
    finalBalance12M - totalContributed12M
  );

  return {
    parsed,
    estimatedMonthlyYieldBRL,
    estimatedAccruedBRL,
    businessDaysElapsed,
    projected12MonthsBRL: finalBalance12M,
    projected12MonthsGainBRL,
  };
}
