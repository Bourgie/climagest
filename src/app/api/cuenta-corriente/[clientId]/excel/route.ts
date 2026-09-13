import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLedger } from "@/server/services/accounting";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/cuenta-corriente");
  if (!(await hasPermission(user, "charges.view"))) redirect("/cuenta-corriente");

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!client) return new Response("No encontrado", { status: 404 });

  const { entries, balance } = await getLedger(admin, user.companyId, clientId);

  const headers = ["Fecha", "Detalle", "Debe", "Haber", "Saldo"];
  const rows = entries.map((e) => [
    new Date(e.date).toLocaleDateString("es-AR"),
    e.description,
    e.debe > 0 ? e.debe.toFixed(2) : "",
    e.haber > 0 ? e.haber.toFixed(2) : "",
    e.saldo.toFixed(2),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(",")), `,,,,${balance.toFixed(2)}`].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuenta-${clientId.slice(0, 8)}.csv"`,
    },
  });
}