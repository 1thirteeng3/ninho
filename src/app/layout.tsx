import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ninho — Finanças do Casal (Giovanni & Maria Luiza)",
  description:
    "Organização financeira editorial, simples e acolhedora para o casal — entradas, saídas, investimentos, metas e parcelas.",
  applicationName: "Ninho",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
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
  themeColor: "#FAF5F4",
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
      data-theme="light"
      className={`${plusJakartaSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased selection:bg-rose-500/20 selection:text-rose-900">
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          mobileOffset={16}
        />
      </body>
    </html>
  );
}
