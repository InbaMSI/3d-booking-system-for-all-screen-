import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";
import { isServerUsingMockApi } from "@/lib/server/api";
import "./globals.css";

export const metadata: Metadata = {
  title: "reel. — Movies, made memorable",
  description: "Discover a better night at the movies. Find your film, choose your seat, and see the view before you go.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <span>reel.</span>
            <span>Good films. Better seats.</span>
            <span className="mock-footer">{isServerUsingMockApi() ? "DEMO · MOCK API" : "DEMO · LOCAL SQLITE"}</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
