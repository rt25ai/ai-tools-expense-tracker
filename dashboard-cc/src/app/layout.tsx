import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/auth-gate";
import Nav from "@/components/nav";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "Personal Command Center",
  description: "מרכז הפיקוד האישי של רועי",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950">
        <AuthGate>
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
