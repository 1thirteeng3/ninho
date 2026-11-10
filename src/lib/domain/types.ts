import { z } from "zod";

export const MemberSchema = z.enum(["Giovanni", "Maria Luiza"]);
export type Member = z.infer<typeof MemberSchema>;

export const ScopeSchema = z.enum([
  "CONJUNTO",
  "INDIVIDUAL_GIOVANNI",
  "INDIVIDUAL_MARIA_LUIZA",
]);
export type Scope = z.infer<typeof ScopeSchema>;

export const FlowTypeSchema = z.enum([
  "RENDA",
  "CUSTO",
  "PROVISAO_ANUAL",
  "INVESTIMENTO",
  "AJUSTE",
]);
export type FlowType = z.infer<typeof FlowTypeSchema>;

export const CategorySchema = z.enum([
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
  "Ajuste de Caixa",
]);
export type Category = z.infer<typeof CategorySchema>;

export const GoalTypeSchema = z.enum(["PATRIMONIO", "OBJETIVO_CONSUMO"]);
export type GoalType = z.infer<typeof GoalTypeSchema>;

export const ViewModeSchema = z.enum(["CAIXA", "COMPETENCIA"]);
export type ViewMode = z.infer<typeof ViewModeSchema>;

export const AssetTypeSchema = z.enum([
  "CDB",
  "Tesouro Direto",
  "LCI / LCA",
  "Caixinha / Conta Remunerada",
  "Fundo Imobiliário (FII)",
  "Ações / ETF",
  "Poupança / Outros",
]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const InvestmentAssetSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo_ativo: AssetTypeSchema,
  rendimento: z.string(),
  liquidez: z.string(),
  instituicao: z.string(),
  meta_vinculada: z.string(),
  titular: z.enum(["Casal", "Giovanni", "Maria Luiza"]),
  valor_aportado: z.number(),
  saldo_atual: z.number(),
});
export type InvestmentAsset = z.infer<typeof InvestmentAssetSchema>;

export const ReceivablePlanSchema = z.object({
  id: z.string(),
  descricao: z.string(),
  pagador_origem: z.string(),
  recebedor: z.enum(["Casal", "Giovanni", "Maria Luiza"]),
  valor_total: z.number(),
  total_parcelas: z.number().int().min(1),
  parcelas_recebidas: z.number().int().min(0),
  proximo_vencimento: z.string(),
  conta_destino: z.string(),
  status: z.enum(["EM_ANDAMENTO", "CONCLUIDO"]),
});
export type ReceivablePlan = z.infer<typeof ReceivablePlanSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  data_competencia: z.string(),
  data_caixa: z.string(),
  tipo_fluxo: FlowTypeSchema,
  categoria: CategorySchema,
  descricao: z.string(),
  valor: z.number(),
  conta: z.string(),
  pago_por: MemberSchema,
  escopo: ScopeSchema,
  parcela_atual: z.number(),
  total_parcelas: z.number(),
  id_plano_parcelas: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const InvestmentGoalSchema = z.object({
  id_meta: z.string(),
  nome: z.union([CategorySchema, z.string()]),
  tipo: GoalTypeSchema,
  valor_alvo: z.number(),
  total_aportado: z.number(),
  saldo_bruto_atual: z.number(),
});
export type InvestmentGoal = z.infer<typeof InvestmentGoalSchema>;

export const AnnualProvisionSchema = z.object({
  item: z.string(),
  categoria_pai: z.string(),
  valor_anual_estimado: z.number(),
  mes_vencimento: z
    .union([z.string(), z.number()])
    .transform((val) => String(val)),
  saldo_acumulado: z.number(),
});
export type AnnualProvision = z.infer<typeof AnnualProvisionSchema>;

export const CoupleConfigSchema = z.object({
  usuario: MemberSchema,
  cota_mensal_livre: z.number(),
  dia_fechamento_cartao: z.number(),
  dia_vencimento_cartao: z.number(),
});
export type CoupleConfig = z.infer<typeof CoupleConfigSchema>;

export const DashboardPayloadSchema = z.object({
  transacoes: z.array(TransactionSchema),
  investimentos: z.array(InvestmentGoalSchema),
  provisoes: z.array(AnnualProvisionSchema),
  config: z.array(CoupleConfigSchema),
  ativos: z.array(InvestmentAssetSchema).optional().default([]),
  recebiveis: z.array(ReceivablePlanSchema).optional().default([]),
  timestamp: z.string(),
  mode: z.enum(["LIVE", "DEMO", "WORST_CASE"]).optional(),
});
export type DashboardPayload = z.infer<typeof DashboardPayloadSchema>;
