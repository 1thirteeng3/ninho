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
  title: "Ninho — Finanças do Casal (Giovanni & Maria Luiza)",
  description:
    "Organização financeira simples e acolhedora para o casal — entradas, saídas, investimentos, metas e parcelas.",
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
  themeColor: "#120910",
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
      <body className="font-sans antialiased selection:bg-rose-500/30 selection:text-rose-100">
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
