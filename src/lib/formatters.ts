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

export function formatShortDate(isoDate: string | number | null | undefined): string {
  const safeStr = String(isoDate ?? "").trim();
  const parts = safeStr.slice(0, 10).split("-");
  if (parts.length === 3 && parts[1] && parts[2]) {
    return `${parts[2]}/${parts[1]}`;
  }
  return safeStr;
}

export function formatYearMonthLabel(yearMonth: string | number | null | undefined): string {
  const safeYm = String(yearMonth ?? "").trim();
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
  const [yyyy, mm] = safeYm.split("-");
  if (!yyyy || !mm) return safeYm;
  return `${monthNames[mm] ?? mm} ${yyyy}`;
}

export function getMonthNameByNumber(monthStr: string | number | null | undefined): string {
  const normalized = String(monthStr ?? "").trim().padStart(2, "0");
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
  return names[normalized] ?? `Mês ${String(monthStr ?? "")}`;
}

// Paleta 100% Rosa / Pink / Lilás / Menta / Amarelo Neo-Brutalista (Zero Vermelho)
export const CATEGORY_COLORS: Record<Category, string> = {
  "Habitação & Fixos": "#FF3B9A", // Vibrant Hot Pink
  Carro: "#EC4899", // Bubblegum Pink 500
  Saúde: "#F472B6", // Flamingo Pink 400
  "Estudos (Custeio)": "#C084FC", // Orchid Lavender 400
  Lazer: "#FF85C0", // Candy Pink
  "Cota Individual": "#F9A8D4", // Pastel Sakura Pink 300
  "Fundo Anual (Carro/Impostos)": "#FBBF24", // Neo-Brutalist Butter Gold
  Casa: "#EC4899", // Pink 500
  "Estudos (Fundo Futuro)": "#C084FC", // Lavender Pink
  Viagem: "#F472B6", // Flamingo Pink 400
  "Reserva & Patrimônio": "#10B981", // Neo-Mint
  "Salário / Renda": "#10B981", // Neo-Mint
  "Ajuste de Caixa": "#A87D95", // Muted Mauve
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
          "border-[#1F0D18] bg-[#A7F3D0] text-[#064E3B] dark:bg-emerald-500/20 dark:text-emerald-200",
      };
    case "INVESTIMENTO":
      return {
        label: "✦ Investimento",
        className:
          "border-[#1F0D18] bg-[#E9D5FF] text-[#4C1D95] dark:bg-purple-500/20 dark:text-purple-200",
      };
    case "PROVISAO_ANUAL":
      return {
        label: "✦ Reserva Anual",
        className:
          "border-[#1F0D18] bg-[#FDE68A] text-[#78350F] dark:bg-amber-500/20 dark:text-amber-200",
      };
    case "CUSTO":
      return {
        label: "↓ Saída",
        className:
          "border-[#1F0D18] bg-[#FFC9E3] text-[#831843] dark:bg-pink-500/20 dark:text-pink-200",
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
    ? "border-[#1F0D18] bg-[#FBCFE8] text-[#831843] dark:bg-pink-500/25 dark:text-pink-200"
    : "border-[#1F0D18] bg-[#F5D0FE] text-[#701A75] dark:bg-fuchsia-500/25 dark:text-fuchsia-200";
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
          "border-[#1F0D18] bg-[#FBCFE8] text-[#831843] dark:bg-pink-500/25 dark:text-pink-200",
      };
    case "INDIVIDUAL_MARIA_LUIZA":
      return {
        label: "Pessoal · Maria Luiza",
        className:
          "border-[#1F0D18] bg-[#F5D0FE] text-[#701A75] dark:bg-fuchsia-500/25 dark:text-fuchsia-200",
      };
  }
}
