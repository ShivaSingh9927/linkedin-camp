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

export const metadata: Metadata = {
  title: "Qampi | B2B Lead Gen & Automated Sales Assistant",
  description: "A powerhouse B2B lead generation tool. Browser Extension + Web Dashboard designed to automate LinkedIn outreach and cold email at scale.",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`scroll-smooth ${mangoGrotesque.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
