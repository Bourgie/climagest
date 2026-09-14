import { getCurrentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PowerSyncClientProvider } from "@/components/powersync/PowerSyncClientProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.forcePasswordChange) redirect("/cambiar-password");

  return (
    <PowerSyncClientProvider>
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <Header
          user={{
            role: user.role ?? "",
            isSuperuser: user.isSuperuser,
            companyId: user.companyId ?? undefined,
          }}
        />
        <main className="flex-1">{children}</main>
      </div>
    </PowerSyncClientProvider>
  );
}