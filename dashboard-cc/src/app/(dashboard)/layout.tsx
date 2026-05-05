import AuthGate from "@/components/auth-gate";
import Nav from "@/components/nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Nav />
        <main className="flex-1 bg-gray-50 p-6 overflow-auto">{children}</main>
      </div>
    </AuthGate>
  );
}
