import type { Metadata } from "next";
import { Geist_Mono, Heebo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDashboardModel } from "@/lib/dashboard-data";
import { withBasePath } from "@/lib/site";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "מעקב הוצאות AI וכלים עסקיים",
  description: "לוח בקרה מקצועי לניהול הוצאות, ספקים, אוטומציות ודוחות של כלי AI וכלים עסקיים.",
  manifest: withBasePath("/manifest.json"),
  icons: {
    icon: withBasePath("/favicon.ico"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { raw } = getDashboardModel();

  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground text-right">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
        <LiveRefresh initialBuiltAt={raw.built_at ?? raw.generated} />
      </body>
    </html>
  );
}
