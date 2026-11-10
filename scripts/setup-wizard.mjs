#!/usr/bin/env node
/**
 * Ninho (Finanças Casal) — Setup Wizard Interativo
 *
 * Guia Giovanni e Maria Luiza passo a passo na configuração da infraestrutura
 * Zero-API (Google Sheets + Google Apps Script + Google Tasks + Gem + .env.local).
 *
 * Execução: node scripts/setup-wizard.mjs
 * Dependências externas: Zero (apenas módulos nativos do Node.js).
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TOTAL_STAGES = 5;

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

function printStageHeader(stageNumber, title) {
  console.log("\n" + "─".repeat(72));
  console.log(
    `${C.cyan}${C.bold}[Etapa ${stageNumber}/${TOTAL_STAGES}]${C.reset} ${C.bold}${title}${C.reset}`
  );
  console.log("─".repeat(72));
}

function upsertEnvVar(envContent, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedKey}=.*$`, "m");
  const line = `${key}="${value}"`;
  if (regex.test(envContent)) {
    return envContent.replace(regex, line);
  }
  const trimmed = envContent.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log(
      `\n${C.bold}${C.green}Ninho (Finanças Casal — Giovanni & Maria Luiza)${C.reset}`
    );
    console.log(
      `${C.dim}Assistente interativo de configuração Google Sheets + Apps Script + Gemini Gem${C.reset}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Etapa 1: Criação da Planilha e Bootstrap do Apps Script
    // ─────────────────────────────────────────────────────────────────────────
    printStageHeader(
      1,
      "Criação da Planilha Google Sheets & Bootstrap (setupDatabaseSheets)"
    );
    console.log("1. Acesse https://sheets.new para criar uma nova planilha Google Sheets.");
    console.log('2. Renomeie a planilha para: "Ninho — Finanças Casal".');
    console.log("3. No menu superior da planilha, clique em: Extensões > Apps Script.");
    console.log(
      "4. Substitua todo o conteúdo do arquivo Code.gs pelo conteúdo de:"
    );
    console.log(`   ${C.cyan}google-apps-script/Code.gs${C.reset}`);
    console.log(
      '5. Na barra lateral esquerda do Apps Script, clique em "Serviços (+)", selecione "Google Tasks API" e clique em Adicionar.'
    );
    console.log(
      '6. No topo do editor do Apps Script, selecione a função "setupDatabaseSheets" e clique em "Executar" (autorize as permissões da sua conta Google).'
    );
    console.log(
      "   Isso criará automaticamente as 4 abas: Transacoes, Investimentos_Metas, Provisoes_Anuais e Config_Casal (com Giovanni e Maria Luiza)."
    );

    await rl.question(
      `\n${C.yellow}Pressione ENTER quando tiver executado setupDatabaseSheets() com sucesso...${C.reset}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Etapa 2: Geração do Token Secreto Compartilhado
    // ─────────────────────────────────────────────────────────────────────────
    printStageHeader(2, "Geração do Token Criptográfico (GAS_SECRET_TOKEN)");
    const generatedToken = crypto.randomBytes(24).toString("hex");
    console.log("Geramos automaticamente um token seguro de 48 caracteres hexadecimais:");
    console.log(`\n   ${C.green}${C.bold}${generatedToken}${C.reset}\n`);
    const customToken = (
      await rl.question(
        "Pressione ENTER para usar este token (ou cole outro token personalizado): "
      )
    ).trim();
    const finalToken = customToken || generatedToken;

    // ─────────────────────────────────────────────────────────────────────────
    // Etapa 3: Configuração das Script Properties e Implantação Web App
    // ─────────────────────────────────────────────────────────────────────────
    printStageHeader(
      3,
      "Script Properties e Publicação do Web App (GAS_URL)"
    );
    console.log("1. No editor do Google Apps Script, clique no ícone de Engrenagem (Configurações do Projeto) na barra lateral esquerda.");
    console.log('2. Role até a seção "Propriedades do script" (Script Properties) e clique em "Adicionar propriedade do script".');
    console.log("3. Preencha exatamente:");
    console.log(`   • Propriedade: ${C.bold}API_SECRET_TOKEN${C.reset}`);
    console.log(`   • Valor:       ${C.bold}${finalToken}${C.reset}`);
    console.log('4. Clique em "Salvar propriedades do script".');
    console.log(
      '5. No canto superior direito, clique em "Implantar" > "Nova implantação":'
    );
    console.log('   • Tipo: "App da Web" (Web App)');
    console.log('   • Executar como: "Eu"');
    console.log('   • Quem pode acessar: "Qualquer pessoa" (Anyone)');
    console.log('6. Clique em "Implantar" e copie a URL do App da Web gerada.');

    let gasUrl = "";
    while (!gasUrl) {
      const answer = (
        await rl.question(
          `\n${C.yellow}Cole aqui a URL do App da Web (https://script.google.com/macros/s/.../exec): ${C.reset}`
        )
      ).trim();

      if (
        answer.startsWith("https://script.google.com/") ||
        answer.startsWith("http://localhost")
      ) {
        gasUrl = answer;
      } else {
        console.log(
          `${C.red}URL inválida. A URL deve começar com "https://script.google.com/macros/s/...". Tente novamente.${C.reset}`
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Etapa 4: Gravação Automática do Arquivo .env.local
    // ─────────────────────────────────────────────────────────────────────────
    printStageHeader(4, "Gravação do arquivo .env.local");
    const envPath = path.resolve(process.cwd(), ".env.local");
    let existingEnv = "";
    if (fs.existsSync(envPath)) {
      existingEnv = fs.readFileSync(envPath, "utf8");
    }

    let updatedEnv = upsertEnvVar(existingEnv, "GAS_URL", gasUrl);
    updatedEnv = upsertEnvVar(updatedEnv, "GAS_SECRET_TOKEN", finalToken);
    fs.writeFileSync(envPath, updatedEnv, { encoding: "utf8", mode: 0o600 });

    console.log(
      `${C.green}✔ Arquivo .env.local atualizado com sucesso em:${C.reset} ${envPath}`
    );
    console.log(
      `${C.dim}  Variáveis gravadas (server-only): GAS_URL e GAS_SECRET_TOKEN${C.reset}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Etapa 5: Checklist Final — Google Tasks, Gatilho e Gem "Finanças Casal"
    // ─────────────────────────────────────────────────────────────────────────
    printStageHeader(
      5,
      'Checklist Final: Google Tasks ("Finanças") & Gem no Gemini'
    );
    console.log("Para concluir a ponte Zero-API de voz e texto no celular:");
    console.log(
      '  [ ] 1. Abra o app Google Tasks e crie uma lista chamada exatamente "Finanças".'
    );
    console.log(
      '  [ ] 2. No Apps Script, clique no ícone de Relógio (Acionadores/Triggers) > "Adicionar acionador":'
    );
    console.log("         • Função: syncTasksToSheets");
    console.log("         • Origem do evento: Baseado no tempo (a cada 5 minutos)");
    console.log(
      "  [ ] 3. Abra https://gemini.google.com > Gems > Novo Gem:"
    );
    console.log('         • Nome: "Finanças Casal"');
    console.log(
      `         • Instruções: Copie o prompt de ${C.cyan}docs/gem-system-prompt.md${C.reset}`
    );
    console.log(
      "  [ ] 4. (Opcional) Configure as automações mobile para Giovanni e Maria Luiza seguindo:"
    );
    console.log(`         ${C.cyan}docs/mobile-webhooks-guide.md${C.reset}`);

    await rl.question(
      `\n${C.yellow}Pressione ENTER para finalizar o assistente...${C.reset}`
    );

    console.log(
      `\n${C.green}${C.bold}🎉 Configuração concluída! Execute "npm run dev" para iniciar o Ninho.${C.reset}\n`
    );
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Erro no Setup Wizard:", err);
  process.exit(1);
});
