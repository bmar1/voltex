import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GridGuard — Storm Outage Risk Predictor",
  description:
    "Live outage risk assessment for Ontario utility operators. Weighted scoring across wind, canopy, flood exposure, and outage history with an LLM-generated action brief.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ddd2bc" },
    { media: "(prefers-color-scheme: dark)", color: "#24221b" },
  ],
};

/* Inline script: read the stored theme and apply it to the <html> element
 * before the body renders. Avoids any flash of the wrong theme on hard
 * reload. Kept tiny (no closures, no exception escapes). */
const THEME_BOOT = `(function(){try{var c={dark:'#24221b',light:'#ddd2bc'};var t=localStorage.getItem('gg-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',c[t]);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
