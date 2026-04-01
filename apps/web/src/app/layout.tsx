import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarWrapper } from "@/components/SidebarWrapper";
import { AuthWrapper } from "@/components/AuthWrapper";
import { Toaster } from 'sonner';
import { GoogleOAuthProvider } from '@react-oauth/google';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LEADMATE | LinkedIn Automation",
  description: "Scale your LinkedIn outreach with AI-powered campaigns.",
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
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} antialiased h-full`}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthWrapper>
            <SidebarWrapper>
              {children}
            </SidebarWrapper>
          </AuthWrapper>
        </GoogleOAuthProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
