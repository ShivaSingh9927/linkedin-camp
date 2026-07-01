import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Mango Grotesque — condensed display grotesque, self-hosted variable font
// (free for commercial use, designer Rajesh Rajput). Exposed as --font-mango
// and used as the heading/display face (see globals.css).
const mangoGrotesque = localFont({
  src: "../fonts/MangoGrotesque-VF.ttf",
  variable: "--font-mango",
  display: "swap",
  weight: "100 900",
});

const SITE_URL = "https://qampi.com";
const TITLE = "Qampi - Smart LinkedIn & Email Outreach That Gets Replies";
const DESCRIPTION =
  "Automate your LinkedIn and cold email outreach with AI-personalized campaigns. Qampi reads every prospect and writes outreach worth replying to. Start free.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Qampi",
  keywords: [
    "LinkedIn outreach automation",
    "AI LinkedIn messages",
    "cold email outreach",
    "LinkedIn lead generation",
    "sales prospecting tool",
    "personalized outreach",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Qampi",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Qampi — Smart LinkedIn & email outreach that gets replies" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Google domain-ownership verification (Chrome Web Store publisher).
  verification: {
    google: "G7OoNVB6ELxmmd4MEdaEYSmhWjcRwEgLuSPZWCbcpB0",
  },
};

// Structured data — helps Google understand the product (rich results eligibility).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Qampi",
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
    },
    {
      "@type": "SoftwareApplication",
      name: "Qampi",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Chrome",
      url: SITE_URL,
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`scroll-smooth ${mangoGrotesque.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
