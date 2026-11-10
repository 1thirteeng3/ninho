import { describe, it, expect } from "vitest";
import { parseQuickEntry } from "../quick-entry-parser";

describe("quick-entry-parser — Parser Léxico Determinístico de 0ms (Seção 4.4.1)", () => {
  it("faz parse de lançamento completo com #categoria, @conta e valor inteiro", () => {
    const parsed = parseQuickEntry(
      "150 jantar pizzaria #lazer @nubank",
      "Giovanni",
      "2026-11-10"
    );

    expect(parsed.isValid).toBe(true);
    expect(parsed.valor).toBe(-150);
    expect(parsed.descricao).toBe("Jantar pizzaria");
    expect(parsed.categoria).toBe("Lazer");
    expect(parsed.tipo_fluxo).toBe("CUSTO");
    expect(parsed.conta).toBe("Nubank");
    expect(parsed.pago_por).toBe("Giovanni");
    expect(parsed.escopo).toBe("CONJUNTO");
    expect(parsed.total_parcelas).toBe(1);
    expect(parsed.data_competencia).toBe("2026-11-10");
  });

  it("interpreta valores decimais com vírgula, prefixo R$ e separador de milhar", () => {
    const parsed = parseQuickEntry(
      "R$ 1.245,80 revisão preventiva #carro @itau 4x",
      "Giovanni",
      "2026-11-10"
    );

    expect(parsed.isValid).toBe(true);
    expect(parsed.valor).toBe(-1245.8);
    expect(parsed.total_parcelas).toBe(4);
    expect(parsed.categoria).toBe("Carro");
    expect(parsed.conta).toBe("Itaú");
    expect(parsed.descricao).toBe("Revisão preventiva");
  });

  it("classifica automaticamente via dicionário heurístico quando nenhuma #hashtag é informada", () => {
    const gasolina = parseQuickEntry("180 gasolina posto shell @nubank");
    expect(gasolina.categoria).toBe("Carro");
    expect(gasolina.tipo_fluxo).toBe("CUSTO");

    const farmacia = parseQuickEntry("89,90 drogasil remedio");
    expect(farmacia.categoria).toBe("Saúde");
    expect(farmacia.tipo_fluxo).toBe("CUSTO");

    const mercado = parseQuickEntry("420,50 supermercado extra");
    expect(mercado.categoria).toBe("Habitação & Fixos");
    expect(mercado.tipo_fluxo).toBe("CUSTO");

    const curso = parseQuickEntry("59,90 livro clean architecture");
    expect(curso.categoria).toBe("Estudos (Custeio)");
    expect(curso.tipo_fluxo).toBe("CUSTO");
  });

  it("distingue corretamente PROVISAO_ANUAL, INVESTIMENTO e RENDA com sinal positivo para entradas/aportes", () => {
    const provisao = parseQuickEntry("200 ipva mensal #provisao");
    expect(provisao.tipo_fluxo).toBe("PROVISAO_ANUAL");
    expect(provisao.categoria).toBe("Fundo Anual (Carro/Impostos)");
    expect(provisao.valor).toBe(-200);

    const aporteCasa = parseQuickEntry("1000 aporte casa #casa");
    expect(aporteCasa.tipo_fluxo).toBe("INVESTIMENTO");
    expect(aporteCasa.categoria).toBe("Casa");
    expect(aporteCasa.valor).toBe(1000);

    const fundoEstudos = parseQuickEntry("300 fundo mba #futuro");
    expect(fundoEstudos.tipo_fluxo).toBe("INVESTIMENTO");
    expect(fundoEstudos.categoria).toBe("Estudos (Fundo Futuro)");
    expect(fundoEstudos.valor).toBe(300);

    const renda = parseQuickEntry("5000 salario mensal");
    expect(renda.tipo_fluxo).toBe("RENDA");
    expect(renda.categoria).toBe("Salário / Renda");
    expect(renda.valor).toBe(5000);
  });

  it("detecta pagadora Maria Luiza (por:malu, @malu) e converte escopo !individual para o membro correto", () => {
    const maluIndividual = parseQuickEntry(
      "120 vestido loja !individual por:malu @nubank"
    );
    expect(maluIndividual.pago_por).toBe("Maria Luiza");
    expect(maluIndividual.escopo).toBe("INDIVIDUAL_MARIA_LUIZA");
    expect(maluIndividual.categoria).toBe("Cota Individual");
    expect(maluIndividual.valor).toBe(-120);

    const giovanniIndividual = parseQuickEntry(
      "95 jogo steam !ind @nubank",
      "Giovanni"
    );
    expect(giovanniIndividual.pago_por).toBe("Giovanni");
    expect(giovanniIndividual.escopo).toBe("INDIVIDUAL_GIOVANNI");
    expect(giovanniIndividual.categoria).toBe("Cota Individual");
  });

  it("detecta viagem como INVESTIMENTO quando acompanhada de #viagem ou palavra 'aporte'/'meta'/'fundo'", () => {
    const aporteViagem = parseQuickEntry("500 aporte viagem europa #viagem");
    expect(aporteViagem.tipo_fluxo).toBe("INVESTIMENTO");
    expect(aporteViagem.categoria).toBe("Viagem");
    expect(aporteViagem.valor).toBe(500);
  });

  it("retorna isValid=false quando nenhum valor numérico positivo está presente na string", () => {
    const invalid = parseQuickEntry("apenas texto sem numeros");
    expect(invalid.isValid).toBe(false);
    expect(invalid.valor).toBe(0);
  });
});
