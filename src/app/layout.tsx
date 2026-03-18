import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "SvindelSjekk – Er dette svindel?",
  description: "Sjekk SMS, e-post eller lenke gratis. Beskytt deg mot svindel i Norge.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SvindelSjekk",
  },
  openGraph: {
    title: "SvindelSjekk – Er dette svindel?",
    description: "Sjekk SMS, e-post eller lenke gratis. Beskytt deg mot svindel i Norge.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SvindelSjekk" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered'); })
                  .catch(function(err) { console.log('SW error:', err); });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}