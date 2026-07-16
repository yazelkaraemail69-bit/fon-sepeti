import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fon Sepeti Optimizasyonu",
  description:
    "TEFAS fonlarınızı analiz edin, korelasyon ve risk bazlı optimal fon sepeti önerileri alın.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
