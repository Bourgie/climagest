import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { TecnicoHome } from "./tecnico-home";

export default async function TecnicoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.forcePasswordChange) redirect("/cambiar-password");
  if (user.isSuperuser || !user.companyId) redirect("/");

  return (
    <TecnicoHome
      userId={user.id}
      companyId={user.companyId}
      fullName={user.fullName}
    />
  );
}
