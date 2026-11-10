# Glossário de Domínio — Ninho (Finanças Casal)

Este glossário define os termos canônicos do domínio financeiro conjugal de **Giovanni** e **Maria Luiza**, sem detalhes de implementação.

## Membros e Governança

- **Casal (`Member`)**: Os dois titulares do sistema financeiro: `Giovanni` e `Maria Luiza`.
- **Caixa Único com Cota Individual**: Regime financeiro em que todas as receitas convergem para o fundo comum do casal, mas cada membro possui uma franquia mensal livre (`cota_mensal_livre`) isenta de prestação de contas.
- **Escopo (`Scope`)**: Define a quem pertence o benefício econômico de um lançamento:
  - `CONJUNTO`: Despesa ou aporte de interesse comum do casal.
  - `INDIVIDUAL_GIOVANNI`: Despesa estritamente pessoal de Giovanni, abatida de sua cota livre mensal.
  - `INDIVIDUAL_MARIA_LUIZA`: Despesa estritamente pessoal de Maria Luiza, abatida de sua cota livre mensal.
- **Encontro de Contas (`Couple Settlement` / $L_{u,m}$)**: Disponibilidade líquida restante da cota individual de cada membro no mês $m$, calculada como $L_{u,m} = Q_u - D_{u,m}^{\text{ind\_em\_conj}} + D_{u,m}^{\text{conj\_em\_ind}}$, onde $Q_u$ é a franquia mensal livre, $D_{u,m}^{\text{ind\_em\_conj}}$ são gastos individuais pagos com meio conjunto/do outro cônjuge e $D_{u,m}^{\text{conj\_em\_ind}}$ são gastos conjuntos pagos com recursos estritamente individuais.

## Bimodalidade Temporal

- **Data de Competência (`data_competencia`)**: Data do fato gerador (dia real da compra ou contratação da despesa), utilizada para analisar o padrão de decisão de consumo no mês.
- **Data de Caixa (`data_caixa`)**: Data do efetivo desembolso financeiro (débito em conta ou dia de vencimento da fatura do cartão de crédito), utilizada para projeção de liquidez e passivos de faturas.
- **Deslocamento de Fatura (`Billing Offset` / $\delta_0$)**: Determina se a primeira parcela de uma compra a crédito cai na fatura do mês corrente ($\delta_0 = 0$, quando o dia da compra é anterior ao `dia_fechamento_cartao`) ou do mês subsequente ($\delta_0 = 1$, quando o dia da compra é igual ou posterior ao fechamento).

## Taxonomia de Fluxos (`FlowType`)

- **`RENDA`**: Entradas líquidas de recursos (salários, pró-labore, rendimentos extras, restituições) que compõem a base $R_m$ do mês.
- **`CUSTO`**: Desembolsos definitivos para manutenção da vida, consumo imediato ou fruição de serviços.
- **`PROVISAO_ANUAL`**: Retenções mensais programadas (*Sinking Funds*, 1/12 avos) para cobrir passivos obrigatórios concentrados anualmente (IPVA, seguro automotivo, licenciamento, impostos).
- **`INVESTIMENTO`**: Transferências de capital para ativos financeiros vinculados a metas de acumulação de patrimônio ou consumo diferido.
- **`AJUSTE`**: Lançamentos corretivos ou de reconciliação de saldo.

## Categorias Oficiais (`Category`)

### Sob `CUSTO`
- **`Habitação & Fixos`**: Aluguel/financiamento, condomínio, energia, água, gás, internet, supermercado base e insumos domésticos.
- **`Carro`**: Combustível, estacionamento, pedágio, lavagem, Uber/transporte complementar e pequenos reparos imediatos.
- **`Saúde`**: Plano de saúde, farmácia, consultas, exames, odontologia, psicoterapia e atividades físicas.
- **`Estudos (Custeio)`**: Mensalidades de cursos correntes, livros, assinaturas técnicas e papelaria de consumo imediato.
- **`Lazer`**: Gastronomia fora do lar, delivery, entretenimento, streaming, passeios e estilo de vida conjunto.
- **`Cota Individual`**: Despesas estritamente pessoais de Giovanni ou Maria Luiza (vestuário pessoal, hobbies, jogos, estética).

### Sob `PROVISAO_ANUAL`
- **`Fundo Anual (Carro/Impostos)`**: Provisão mensal para IPVA, Seguro Automotivo, Licenciamento, Revisão Preventiva Anual e anuidades.

### Sob `INVESTIMENTO`
- **`Casa`**: Formação de capital para aquisição de imóvel próprio, entrada, amortização ou reformas estruturais (`PATRIMONIO`).
- **`Estudos (Fundo Futuro)`**: Acumulação para projetos educacionais futuros de alto valor, como pós-graduação, MBA ou intercâmbio (`OBJETIVO_CONSUMO`).
- **`Viagem`**: Fundo de férias e viagens programadas de médio prazo (`OBJETIVO_CONSUMO`).
- **`Reserva & Patrimônio`**: Colchão de liquidez de emergência e investimentos previdenciários de longo prazo (`PATRIMONIO`).
