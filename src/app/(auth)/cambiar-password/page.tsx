import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cambiar contraseña
        </h1>
        <p className="text-sm text-zinc-500">
          Tu contraseña es provisoria. Definí una nueva para continuar.
        </p>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
