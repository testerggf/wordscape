import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "词境 WordScape",
  description: "AI 驱动的词汇精读平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
