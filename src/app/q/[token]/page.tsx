import { createHash } from "node:crypto";
import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser, hasPermission } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/equipment-types";
import { InquiryForm } from "./inquiry-form";

async function getIpHash(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";
    const ip = fwd.split(",")[0].trim();
    return createHash("sha256").update(ip).digest("hex");
  } catch {
    return "unknown";
  }
}

const VISIT_LABELS: Record<string, string> = {
  instalacion: "Instalación",
  mantenimiento: "Mantenimiento",
  reparacion: "Reparación",
  limpieza: "Limpieza",
  otro: "Otro",
};

export default async function QrPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ipHash = await getIpHash();

  const admin = createAdminClient();
  const { data: equipment } = await admin
    .from("equipment")
    .select("id, company_id")
    .eq("qr_token", token)
    .maybeSingle();

  // La RPC registra el acceso (audit) y devuelve la whitelist pública.
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_equipment_public", {
    p_token: token,
    p_ip_hash: ipHash,
  });

  if (!equipment || !data?.found) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Equipo no encontrado</h1>
        <p className="text-sm text-zinc-500">
          El código QR no corresponde a un equipo válido.
        </p>
      </main>
    );
  }

  // Vista privada para miembros de la empresa dueña del equipo.
  const user = await getCurrentUser();
  const isMember =
    user != null && !user.isSuperuser && user.companyId === equipment.company_id;

  if (isMember) {
    const { data: full } = await admin
      .from("equipment")
      .select("*")
      .eq("id", equipment.id)
      .single();
    const { data: workOrders } = await admin
      .from("work_orders")
      .select("id, visit_type, diagnosis_notes, status, actual_end_at, created_at")
      .eq("equipment_id", equipment.id)
      .order("created_at", { ascending: false });

    const canCreate = await hasPermission(user!, "work_orders.create");

    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
        <section className="flex flex-col gap-1">
          <p className="text-sm text-zinc-500">
            {EQUIPMENT_TYPE_LABELS[full.equipment_type] ?? full.equipment_type}
            {full.serial_number ? ` · Serie ${full.serial_number}` : ""}
          </p>
          <h1 className="text-2xl font-semibold">
            {full.brand ?? "Equipo"} {full.model ?? ""}
          </h1>
          {full.location_label && (
            <p className="text-sm text-zinc-500">{full.location_label}</p>
          )}
        </section>

        {canCreate && (
          <Link
            href={`/ordenes/nuevo?equipo=${equipment.id}`}
            className="rounded-md bg-zinc-900 px-4 py-3 text-center text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Registrar nueva visita
          </Link>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Historial de visitas</h2>
          {(workOrders ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">Sin visitas registradas.</p>
          )}
          {(workOrders ?? []).map((wo) => (
            <div
              key={wo.id}
              className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <p className="text-sm font-medium">
                {new Date(wo.actual_end_at ?? wo.created_at).toLocaleDateString("es-AR")}{" "}
                — {VISIT_LABELS[wo.visit_type] ?? wo.visit_type}
              </p>
              {wo.diagnosis_notes && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {wo.diagnosis_notes}
                </p>
              )}
            </div>
          ))}
        </section>
      </main>
    );
  }

  const type = EQUIPMENT_TYPE_LABELS[data.equipment_type] ?? data.equipment_type;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-10">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {data.brand ?? "Equipo"} {data.model ?? ""}
        </h1>
        <p className="text-sm text-zinc-500">
          {type}
          {data.install_date ? ` · Instalado ${data.install_date}` : ""}
        </p>
      </section>

      {data.history && data.history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Historial</h2>
          {(data.history ?? []).map((h: { date: string; visit_type: string }, i: number) => (
            <p key={i} className="text-sm text-zinc-600 dark:text-zinc-400">
              {h.date} — {VISIT_LABELS[h.visit_type] ?? h.visit_type}
            </p>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">¿Necesitás servicio?</h2>
        <InquiryForm token={token} />
      </section>
    </main>
  );
}
