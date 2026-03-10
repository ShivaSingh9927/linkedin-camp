import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarWrapper } from "@/components/SidebarWrapper";
import { AuthWrapper } from "@/components/AuthWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LEADMATE | LinkedIn Automation",
  description: "Scale your LinkedIn outreach with AI-powered campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <AuthWrapper>
          <SidebarWrapper> 
            {children}
          </SidebarWrapper>
        </AuthWrapper>
      </body>
    </html>
  );
}
