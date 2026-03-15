import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SvindelSjekk – Er dette svindel?",
  description: "Sjekk SMS, e-post eller lenke gratis. Beskytt deg mot svindel i Norge.",
  openGraph: {
    title: "SvindelSjekk – Er dette svindel?",
    description: "Sjekk SMS, e-post eller lenke gratis. Beskytt deg mot svindel i Norge.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
