import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratify AI — Multi-Agent Market Intelligence",
  description:
    "Autonomous distributed market intelligence platform. Submit research inquiries and receive executive-grade reports grounded in real web evidence, synthesized by Google Gemini.",
  keywords: [
    "market intelligence",
    "AI research",
    "competitive analysis",
    "distributed systems",
    "market analysis",
  ],
  authors: [{ name: "Stratify AI" }],
  openGraph: {
    title: "Stratify AI — Multi-Agent Market Intelligence",
    description:
      "Autonomous distributed market intelligence platform powered by real-time web retrieval and AI reasoning.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080c14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
