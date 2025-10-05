import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Eco-Safe — NASA Liveability Advisor",
    template: "%s · Eco-Safe",
  },
  description:
    "Eco-Safe helps renters and homebuyers evaluate any location with NASA Earth data: heat, hazards, population density, greenness, and clear, health-minded advice.",
  keywords: [
    "Eco-Safe",
    "NASA",
    "livability",
    "heat index",
    "hazards",
    "population density",
    "NDVI",
    "GIBS",
    "POWER",
    "EONET",
    "SEDAC",
  ],
  authors: [{ name: "Eco-Safe" }],
  creator: "Eco-Safe",
  publisher: "Eco-Safe",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Eco-Safe — NASA Liveability Advisor",
    description:
      "Score any location for livability using NASA Earth data: heat, hazards, density, and greenness.",
    images: [
      {
        url: "/globe.svg",
        width: 1200,
        height: 630,
        alt: "Eco-Safe",
      },
    ],
    siteName: "Eco-Safe",
  },
  twitter: {
    card: "summary_large_image",
    site: "@",
    title: "Eco-Safe — NASA Liveability Advisor",
    description:
      "Score any location for livability using NASA Earth data: heat, hazards, density, and greenness.",
    images: ["/globe.svg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
