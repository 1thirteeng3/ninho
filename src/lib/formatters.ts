import type { Category, FlowType, Member, Scope } from "@/lib/domain/types";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatBRL(value: number, showPlusSign = false): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const formatted = brlFormatter.format(safeVal);
  if (showPlusSign && safeVal > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatPct(value: number): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  return `${percentFormatter.format(safeVal)}%`;
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.trim().slice(0, 10).split("-");
  if (parts.length === 3 && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}`;
  }
  return isoDate;
}

export function formatYearMonthLabel(yearMonth: string): string {
  const monthNames: Record<string, string> = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  const [yyyy, mm] = yearMonth.split("-");
  if (!yyyy || !mm) return yearMonth;
  return `${monthNames[mm] ?? mm} ${yyyy}`;
}

export function getMonthNameByNumber(monthStr: string): string {
  const normalized = monthStr.trim().padStart(2, "0");
  const names: Record<string, string> = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  return names[normalized] ?? `Mês ${monthStr}`;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  "Habitação & Fixos": "#BE123C", // Berry / Rose 700
  Carro: "#E11D48", // Rose 600
  Saúde: "#F43F5E", // Rose 500
  "Estudos (Custeio)": "#9F1239", // Plum Rose 800
  Lazer: "#FB7185", // Coral Rose 400
  "Cota Individual": "#FDA4AF", // Blush Rose 300
  "Fundo Anual (Carro/Impostos)": "#D97706", // Terracotta / Amber 600
  Casa: "#9F1239", // Deep Berry
  "Estudos (Fundo Futuro)": "#BE123C", // Rose 700
  Viagem: "#E11D48", // Rose 600
  "Reserva & Patrimônio": "#0F766E", // Sage Teal 700
  "Salário / Renda": "#0F766E", // Sage Teal 700
  "Ajuste de Caixa": "#9A828A", // Muted Plum
};

export function getFlowBadgeStyle(flow: FlowType): {
  label: string;
  className: string;
} {
  switch (flow) {
    case "RENDA":
      return {
        label: "↑ Entrada",
        className:
          "border-teal-600/25 bg-teal-500/10 text-teal-800 dark:text-teal-300",
      };
    case "INVESTIMENTO":
      return {
        label: "✦ Investimento",
        className:
          "border-rose-800/25 bg-rose-900/10 text-rose-900 dark:text-rose-200",
      };
    case "PROVISAO_ANUAL":
      return {
        label: "✦ Reserva Anual",
        className:
          "border-amber-600/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      };
    case "CUSTO":
      return {
        label: "↓ Saída",
        className:
          "border-rose-600/25 bg-rose-500/10 text-rose-800 dark:text-rose-200",
      };
    case "AJUSTE":
      return {
        label: "Ajuste",
        className: "surface-subtle text-ink-secondary",
      };
  }
}

export function getMemberBadgeStyle(member: Member): string {
  return member === "Giovanni"
    ? "border-rose-700/20 bg-rose-600/10 text-rose-900 dark:text-rose-200"
    : "border-pink-600/20 bg-pink-500/10 text-pink-900 dark:text-pink-200";
}

export function getScopeBadgeLabel(scope: Scope): {
  label: string;
  className: string;
} {
  switch (scope) {
    case "CONJUNTO":
      return {
        label: "Do Casal",
        className: "surface-subtle text-ink-secondary",
      };
    case "INDIVIDUAL_GIOVANNI":
      return {
        label: "Pessoal · Giovanni",
        className:
          "border-rose-700/20 bg-rose-600/10 text-rose-900 dark:text-rose-200",
      };
    case "INDIVIDUAL_MARIA_LUIZA":
      return {
        label: "Pessoal · Maria Luiza",
        className:
          "border-pink-600/20 bg-pink-500/10 text-pink-900 dark:text-pink-200",
      };
  }
}
