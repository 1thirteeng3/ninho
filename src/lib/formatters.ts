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
  "Habitação & Fixos": "#6366F1", // Indigo
  Carro: "#06B6D4", // Cyan
  Saúde: "#14B8A6", // Teal
  "Estudos (Custeio)": "#8B5CF6", // Violet
  Lazer: "#EC4899", // Pink
  "Cota Individual": "#38BDF8", // Sky
  "Fundo Anual (Carro/Impostos)": "#F59E0B", // Amber
  Casa: "#10B981", // Emerald
  "Estudos (Fundo Futuro)": "#A855F7", // Purple
  Viagem: "#22D3EE", // Light Cyan
  "Reserva & Patrimônio": "#34D399", // Soft Emerald
  "Salário / Renda": "#10B981",
  "Ajuste de Caixa": "#94A3B8",
};

export function getFlowBadgeStyle(flow: FlowType): {
  label: string;
  className: string;
} {
  switch (flow) {
    case "RENDA":
      return {
        label: "RENDA",
        className:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
      };
    case "INVESTIMENTO":
      return {
        label: "INVESTIMENTO",
        className:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
      };
    case "PROVISAO_ANUAL":
      return {
        label: "PROVISÃO ANUAL",
        className: "border-amber-500/30 bg-amber-500/15 text-amber-300",
      };
    case "CUSTO":
      return {
        label: "CUSTO",
        className: "border-indigo-500/30 bg-indigo-500/15 text-indigo-200",
      };
    case "AJUSTE":
      return {
        label: "AJUSTE",
        className: "border-slate-500/30 bg-slate-500/15 text-slate-300",
      };
  }
}

export function getMemberBadgeStyle(member: Member): string {
  return member === "Giovanni"
    ? "border-sky-500/30 bg-sky-500/15 text-sky-200"
    : "border-pink-500/30 bg-pink-500/15 text-pink-200";
}

export function getScopeBadgeLabel(scope: Scope): {
  label: string;
  className: string;
} {
  switch (scope) {
    case "CONJUNTO":
      return {
        label: "CONJUNTO",
        className: "border-white/15 bg-white/[0.05] text-slate-300",
      };
    case "INDIVIDUAL_GIOVANNI":
      return {
        label: "COTA GIOVANNI",
        className: "border-sky-500/30 bg-sky-500/15 text-sky-200",
      };
    case "INDIVIDUAL_MARIA_LUIZA":
      return {
        label: "COTA MARIA LUIZA",
        className: "border-pink-500/30 bg-pink-500/15 text-pink-200",
      };
  }
}
