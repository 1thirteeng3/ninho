import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ninho — Finanças Giovanni & Maria Luiza",
  description:
    "Sistema de Governança e Inteligência Financeira Conjugal — Caixa Único, Cota Individual, Alocação Descritiva e Desdobramento Temporal de Faturas.",
  applicationName: "Ninho",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ninho",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#090A0F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          mobileOffset={16}
        />
      </body>
    </html>
  );
}
