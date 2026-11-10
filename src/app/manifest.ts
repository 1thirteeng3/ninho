import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ninho — Finanças Giovanni & Maria Luiza",
    short_name: "Ninho",
    description:
      "Sistema de Governança e Inteligência Financeira Conjugal — Caixa Único, Cota Individual e Desdobramento Temporal de Faturas.",
    start_url: "/",
    display: "standalone",
    background_color: "#090A0F",
    theme_color: "#090A0F",
    orientation: "portrait-primary",
    lang: "pt-BR",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
