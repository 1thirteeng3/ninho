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
  "Habitação & Fixos": "#FB7185", // Rose 400
  Carro: "#F472B6", // Pink 400
  Saúde: "#E879F9", // Fuchsia 400
  "Estudos (Custeio)": "#C084FC", // Purple 400
  Lazer: "#F43F5E", // Rose 500
  "Cota Individual": "#FDA4AF", // Rose 300
  "Fundo Anual (Carro/Impostos)": "#FBBF24", // Amber 400
  Casa: "#EC4899", // Pink 500
  "Estudos (Fundo Futuro)": "#D946EF", // Fuchsia 500
  Viagem: "#FB7185", // Coral Rose
  "Reserva & Patrimônio": "#34D399", // Emerald 400
  "Salário / Renda": "#34D399",
  "Ajuste de Caixa": "#CBD5E1",
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
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
      };
    case "INVESTIMENTO":
      return {
        label: "✦ Investimento",
        className:
          "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
      };
    case "PROVISAO_ANUAL":
      return {
        label: "✦ Reserva Anual",
        className: "border-amber-500/30 bg-amber-500/15 text-amber-200",
      };
    case "CUSTO":
      return {
        label: "↓ Saída",
        className: "border-rose-500/30 bg-rose-500/15 text-rose-200",
      };
    case "AJUSTE":
      return {
        label: "Ajuste",
        className: "border-rose-300/25 bg-rose-300/10 text-rose-200",
      };
  }
}

export function getMemberBadgeStyle(member: Member): string {
  return member === "Giovanni"
    ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
    : "border-pink-400/30 bg-pink-500/15 text-pink-200";
}

export function getScopeBadgeLabel(scope: Scope): {
  label: string;
  className: string;
} {
  switch (scope) {
    case "CONJUNTO":
      return {
        label: "Do Casal",
        className: "border-rose-300/20 bg-rose-500/10 text-rose-100",
      };
    case "INDIVIDUAL_GIOVANNI":
      return {
        label: "Pessoal · Giovanni",
        className: "border-rose-400/30 bg-rose-500/15 text-rose-200",
      };
    case "INDIVIDUAL_MARIA_LUIZA":
      return {
        label: "Pessoal · Maria Luiza",
        className: "border-pink-400/30 bg-pink-500/15 text-pink-200",
      };
  }
}
