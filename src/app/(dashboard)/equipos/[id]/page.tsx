import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { hasPermission, requireUser } from "@/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/equipment-types";
import { EquipmentForm, type EquipmentClientOption } from "../equipment-form";
import { DeleteEquipmentButton } from "../delete-equipment-button";

export default async function EquipoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.isSuperuser || !user.companyId) redirect("/");

  const [canView, canUpdate, canDelete] = await Promise.all([
    hasPermission(user, "equipment.view"),
    hasPermission(user, "equipment.update"),
    hasPermission(user, "equipment.delete"),
  ]);
  if (!canView) redirect("/equipos");

  const admin = createAdminClient();
  const { data: equipment } = await admin
    .from("equipment")
    .select("*")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!equipment) notFound();

  const { data: clients } = await admin
    .from("clients")
    .select("id, name, client_addresses(id, address, label)")
    .eq("company_id", user.companyId)
    .order("name");
  const options: EquipmentClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    addresses: (c.client_addresses ?? []).map((a) => ({
      id: a.id,
      address: a.address,
      label: a.label,
    })),
  }));

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/q/${equipment.qr_token}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { width: 320, margin: 1 });

  const initial = {
    id: equipment.id,
    clientId: equipment.client_id,
    addressId: equipment.address_id,
    equipmentType: equipment.equipment_type,
    brand: equipment.brand ?? "",
    model: equipment.model ?? "",
    serialNumber: equipment.serial_number ?? "",
    btu: equipment.btu != null ? String(equipment.btu) : "",
    power: equipment.power ?? "",
    refrigerantType: equipment.refrigerant_type ?? "",
    installDate: equipment.install_date ?? "",
    warrantyUntil: equipment.warranty_until ?? "",
    conditionStatus: equipment.condition_status ?? "",
    locationLabel: equipment.location_label ?? "",
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/equipos" className="text-sm text-zinc-500">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">
            {equipment.brand ?? "—"} {equipment.model ?? ""}
          </h1>
        </div>
        {canDelete && <DeleteEquipmentButton equipmentId={equipment.id} />}
      </div>

      <section className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 sm:flex-row sm:justify-center sm:gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Código QR del equipo" width={200} height={200} />
        <div className="text-center sm:text-left">
          <p className="text-sm text-zinc-500">QR del equipo</p>
          <p className="font-mono text-xs break-all">{publicUrl}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {EQUIPMENT_TYPE_LABELS[equipment.equipment_type] ?? equipment.equipment_type}
            {equipment.serial_number ? ` · Serie ${equipment.serial_number}` : ""}
          </p>
        </div>
      </section>

      {canUpdate ? (
        <EquipmentForm mode="edit" clients={options} initial={initial} />
      ) : (
        <p className="text-sm text-zinc-500">
          {equipment.location_label ?? "Sin ubicación registrada."}
        </p>
      )}
    </main>
  );
}
