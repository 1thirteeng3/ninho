# Guia de Automação Passiva Mobile (Webhooks Android & iOS)

Este guia configura o **Canal C (Ingestão Passiva Mobile)** da arquitetura Ninho para **Giovanni** e **Maria Luiza**. Sempre que uma compra presencial ou online gera uma notificação do **Nubank**, **Itaú** ou **Carteira Digital (Google Wallet / Apple Pay)**, o celular envia automaticamente um `POST` JSON para o Google Apps Script (`Code.gs`), eliminando a necessidade de digitação manual.

---

## Contrato do Payload HTTP POST (`MOBILE_NOTIFICATION`)

O endpoint `doPost(e)` do Google Apps Script aceita requisições `POST` (`Content-Type: application/json`) com a seguinte estrutura:

```json
{
  "token": "SEU_GAS_SECRET_TOKEN_AQUI",
  "source": "MOBILE_NOTIFICATION",
  "paid_by": "Giovanni",
  "raw_notification": "Compra aprovada no seu cartao final 1234 em SUPERMERCADO EXTRA valor R$ 245,80 em 10/11"
}
```

- **`token`**: Mesmo valor definido na propriedade `API_SECRET_TOKEN` nas *Script Properties* do Google Apps Script e no `.env.local`.
- **`source`**: Deve ser exatamente `"MOBILE_NOTIFICATION"`.
- **`paid_by`**: `"Giovanni"` (no celular do Giovanni) ou `"Maria Luiza"` (no celular da Maria Luiza).
- **`raw_notification`**: Texto bruto capturado da barra de notificações ou do gatilho da carteira digital. O motor em `Code.gs` extrai o valor após `R$`, identifica o estabelecimento após `em `, infere a categoria oficial por dicionário heurístico e projeta a data de vencimento da fatura.

---

## 1. Configuração no Android (MacroDroid — Recomendado)

O **MacroDroid** é gratuito na Google Play Store e permite interceptar notificações de aplicativos específicos sem código.

### Passo a Passo (fazer no celular de Giovanni e/ou Maria Luiza)

1. Instale e abra o **MacroDroid** e conceda a permissão de **Acesso a Notificações** quando solicitado.
2. Toque em **Adicionar Macro**.
3. **Gatilhos (Triggers) — Bloco Vermelho:**
   - Selecione **Dispositivo (Eventos)** > **Notificação** > **Notificação Recebida**.
   - Escolha **Selecionar Aplicativo(s)** e marque:
     - **Nubank** (`com.nu.production`)
     - **Itaú** (`com.itau`)
     - **Carteira do Google / Google Wallet** (`com.google.android.apps.walletnfcrel`)
   - Em **Conteúdo de Texto**, selecione **Contém** e digite: `R$` (isso evita disparar para notificações promocionais que não contêm valor monetário).
4. **Ações (Actions) — Bloco Azul:**
   - Selecione **Web / Conectividade** > **Requisição HTTP (HTTP Request)**.
   - **Método de Requisição:** `POST`
   - **URL:** Cole a sua `GAS_URL` (ex.: `https://script.google.com/macros/s/AKfycb.../exec`).
   - Na aba **Corpo do Conteúdo (Content Body)**:
     - **Tipo de Conteúdo (Content Type):** `application/json`
     - **Texto do Corpo (Body Text):**
       - No aparelho do **Giovanni**:
         ```json
         {
           "token": "SEU_GAS_SECRET_TOKEN_AQUI",
           "source": "MOBILE_NOTIFICATION",
           "paid_by": "Giovanni",
           "raw_notification": "{not_title} - {not_text}"
         }
         ```
       - No aparelho da **Maria Luiza**:
         ```json
         {
           "token": "SEU_GAS_SECRET_TOKEN_AQUI",
           "source": "MOBILE_NOTIFICATION",
           "paid_by": "Maria Luiza",
           "raw_notification": "{not_title} - {not_text}"
         }
         ```
5. Salve a macro com o nome **`Ninho Auto-Log Bancos`**.

### Alternativa Android: Tasker

Caso prefira o **Tasker**:
1. **Profile:** *Event* > *UI* > *Notification* > Owner Application: `Nubank`, `Itaú`, `Carteira` | Text: `*R$*`.
2. **Task:** *Net* > *HTTP Request*:
   - Method: `POST`
   - URL: `https://script.google.com/macros/s/AKfycb.../exec`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {"token":"SEU_GAS_SECRET_TOKEN_AQUI","source":"MOBILE_NOTIFICATION","paid_by":"Giovanni","raw_notification":"%evtprm2 %evtprm3"}
     ```

---

## 2. Configuração no iOS (App Atalhos / Shortcuts)

No iPhone, o aplicativo nativo **Atalhos (Shortcuts)** possui o gatilho automático **"Transação (Ao tocar para pagar com Apple Pay)"**, que captura o estabelecimento e o valor instantaneamente no momento da aproximação NFC.

### Passo a Passo no iPhone (Giovanni ou Maria Luiza)

1. Abra o app **Atalhos (Shortcuts)** e toque na aba **Automação** na barra inferior.
2. Toque no botão **`+`** (canto superior direito) e selecione **Transação (Transaction)**.
3. Configure o gatilho:
   - Selecione os cartões usados no Apple Pay (ex.: **Nubank**, **Itaú**).
   - Marque **Executar Imediatamente (Run Immediately)** para não exigir confirmação na tela bloqueada.
   - Toque em **Seguinte**.
4. Escolha **Nova Automação em Branco** e adicione a ação **Obter Conteúdo de URL (Get Contents of URL)**:
   - **URL:** Cole a sua `GAS_URL` (`https://script.google.com/macros/s/AKfycb.../exec`).
   - Toque na seta ao lado da URL para expandir as opções avançadas:
     - **Método:** `POST`
     - **Cabeçalhos:** Adicione `Content-Type` = `application/json`
     - **Corpo da Solicitação:** `JSON`
5. Adicione os 4 campos no dicionário JSON da ação:
   - `token` (*Texto*): `SEU_GAS_SECRET_TOKEN_AQUI`
   - `source` (*Texto*): `MOBILE_NOTIFICATION`
   - `paid_by` (*Texto*): `Giovanni` (ou `Maria Luiza` no iPhone da Maria Luiza)
   - `raw_notification` (*Texto*): Monte usando as variáveis mágicas da Entrada do Atalho:
     `Compra aprovada em [Nome ou Estabelecimento da Entrada do Atalho] valor R$ [Valor da Entrada do Atalho]`
6. Toque em **Concluído**.

---

## 3. Como Testar a Integração via Terminal

Antes de realizar uma compra real, valide se o seu endpoint `doPost(e)` está recebendo e classificando notificações corretamente usando `curl`:

```bash
curl -L -X POST "SUA_GAS_URL_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "SEU_GAS_SECRET_TOKEN_AQUI",
    "source": "MOBILE_NOTIFICATION",
    "paid_by": "Maria Luiza",
    "raw_notification": "Compra aprovada no seu cartao final 4321 em DROGASIL valor R$ 89,90 em 10/11"
  }'
```

**Resultado esperado na aba `Transacoes` da planilha:**
- `tipo_fluxo`: `CUSTO`
- `categoria`: `Saúde` (inferida automaticamente por `"DROGASIL"`)
- `descricao`: `DROGASIL`
- `valor`: `-89.9`
- `pago_por`: `Maria Luiza`
- `escopo`: `CONJUNTO`
- `data_caixa`: Calculada automaticamente para o dia `27` (vencimento do cartão da Maria Luiza conforme `Config_Casal`).
