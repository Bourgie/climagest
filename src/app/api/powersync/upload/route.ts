import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, hasPermission } from "@/server/auth";

type CrudOp = {
  table: string;
  op: "PUT" | "PATCH" | "DELETE";
  id: string;
  opData?: Record<string, unknown>;
};

const WRITABLE_TABLES = new Set([
  "work_orders",
  "work_order_materials",
  "work_order_photos",
]);

const WO_PATCH_FIELDS = new Set([
  "visit_type",
  "diagnosis_notes",
  "measurements",
  "fault_found",
  "actual_start_at",
  "actual_end_at",
  "signature_image",
  "status",
  "warranty_days",
  "warranty_until",
]);

const MATERIAL_PATCH_FIELDS = new Set([
  "description",
  "quantity",
  "unit_cost",
  "subtotal",
]);

const PHOTO_PATCH_FIELDS = new Set(["storage_path", "photo_type"]);

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseMeasurements(v: unknown): Record<string, number> | null {
  if (v == null || v === "") return null;
  try {
    const obj = typeof v === "string" ? JSON.parse(v) : v;
    if (typeof obj !== "object" || Array.isArray(obj)) return null;
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
      const n = toNumber(val);
      if (n != null) out[k] = n;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Errores permanentes de DB (no tiene sentido reintentar): constraint, RLS, sintaxis. */
function isPermanentDbError(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? "";
  return (
    code.startsWith("23") || code.startsWith("PGRST") || code === "42501"
  );
}

async function bestEffortAudit(
  admin: ReturnType<typeof createAdminClient>,
  entry: Record<string, unknown>,
) {
  try {
    await admin.from("audit_logs").insert(entry);
  } catch (e) {
    console.error("upload audit failed (best-effort):", e);
  }
}

/**
 * Endpoint de subida de PowerSync: aplica la cola de escrituras offline del
 * técnico contra Supabase Postgres.
 *
 * - 200 {ok:true}: todo aplicado (o nada pendiente) → el cliente marca completo.
 * - 400 {ok:false}: error PERMANENTE (permiso, validación, constraint) → el
 *   cliente descarta la cola. Lo aplicado antes del fallo queda aplicado.
 * - 401/500: transitorio o sin sesión → el cliente reintenta.
 *
 * Solo acepta work_orders + hijas. Todo se valida server-side: permiso
 * granular, company_id de la sesión (nunca del body) y pertenencia del equipo.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.isSuperuser || !user.companyId) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const crud = body?.crud;
    if (!Array.isArray(crud) || crud.length === 0 || crud.length > 200) {
      return NextResponse.json({ ok: false, error: "Batch inválido." }, { status: 400 });
    }

    const admin = createAdminClient();

    for (const raw of crud) {
      const op = raw as CrudOp;
      if (!op || !WRITABLE_TABLES.has(op.table) || typeof op.id !== "string" || !op.id) {
        return NextResponse.json(
          { ok: false, error: `Operación no permitida: ${op?.table ?? "?"} ${op?.op ?? "?"}` },
          { status: 400 },
        );
      }

      try {
        if (op.table === "work_orders") {
          await applyWorkOrderOp(admin, user, op);
        } else if (op.table === "work_order_materials") {
          await applyMaterialOp(admin, user, op);
        } else {
          await applyPhotoOp(admin, user, op);
        }
      } catch (e) {
        if (isPermanentDbError(e)) {
          console.error("upload permanente, se descarta la cola:", e);
          return NextResponse.json(
            { ok: false, error: "Operación rechazada." },
            { status: 400 },
          );
        }
        throw e;
      }
    }

    return NextResponse.json({ ok: true, applied: crud.length });
  } catch (e) {
    console.error("upload transitorio, reintenta:", e);
    return NextResponse.json({ ok: false, error: "Error transitorio." }, { status: 500 });
  }
}

type RouteUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type Admin = ReturnType<typeof createAdminClient>;

async function applyWorkOrderOp(admin: Admin, user: RouteUser, op: CrudOp) {
  const d = op.opData ?? {};
  const companyId = user.companyId!;

  if (op.op === "PUT") {
    if (!(await hasPermission(user, "work_orders.create"))) {
      return fail("Sin permiso para crear órdenes.");
    }
    if (d.company_id !== companyId) return fail("Empresa inválida.");
    const { data: eq } = await admin
      .from("equipment")
      .select("id")
      .eq("id", d.equipment_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!eq) return fail("Equipo inválido.");
    const { error } = await admin.from("work_orders").insert({
      id: op.id,
      company_id: companyId,
      equipment_id: d.equipment_id,
      appointment_id: d.appointment_id ?? null,
      service_request_id: d.service_request_id ?? null,
      created_by: user.id,
      visit_type: String(d.visit_type ?? "mantenimiento"),
      diagnosis_notes: d.diagnosis_notes != null ? String(d.diagnosis_notes) : null,
      measurements: parseMeasurements(d.measurements),
      fault_found: d.fault_found != null ? String(d.fault_found) : null,
      actual_start_at: d.actual_start_at ?? null,
      actual_end_at: d.actual_end_at ?? null,
      signature_image: d.signature_image ?? null,
      status: "borrador",
      warranty_days: toNumber(d.warranty_days),
      warranty_until: d.warranty_until ?? null,
    });
    if (error) throw error;
    await bestEffortAudit(admin, {
      company_id: companyId,
      user_id: user.id,
      action: "work_orders.create",
      entity_type: "work_orders",
      entity_id: op.id,
      new_data: { offline: true },
    });
    try {
      await admin.from("qr_access_audit").insert({
        equipment_id: d.equipment_id,
        actor_type: "user",
        user_id: user.id,
        action: "edit_success",
        ip_hash: null,
      });
    } catch (e) {
      console.error("upload qr audit failed (best-effort):", e);
    }
    return;
  }

  // PATCH / DELETE: la OT debe existir y pertenecer a la empresa.
  const { data: existing } = await admin
    .from("work_orders")
    .select("id, created_by")
    .eq("id", op.id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!existing) return fail("Orden no encontrada.");

  if (op.op === "DELETE") {
    if (!(await hasPermission(user, "work_orders.delete"))) return fail("Sin permiso.");
    const { error } = await admin.from("work_orders").delete().eq("id", op.id);
    if (error) throw error;
    return;
  }

  // PATCH
  if (!(await hasPermission(user, "work_orders.update"))) return fail("Sin permiso.");
  if (user.role === "technician" && existing.created_by !== user.id) {
    return fail("Solo tu propia orden.");
  }
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(op.opData ?? {})) {
    if (!WO_PATCH_FIELDS.has(k)) continue;
    patch[k] = k === "measurements" ? parseMeasurements(v) : v;
  }
  const { error } = await admin.from("work_orders").update(patch).eq("id", op.id);
  if (error) throw error;
}

async function parentWorkOrder(admin: Admin, companyId: string, workOrderId: unknown) {
  if (typeof workOrderId !== "string" || !workOrderId) return null;
  const { data } = await admin
    .from("work_orders")
    .select("id, created_by")
    .eq("id", workOrderId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

function fail(message: string): never {
  const e = new Error(message) as Error & { code: string };
  e.code = "42501";
  throw e;
}

async function applyMaterialOp(admin: Admin, user: RouteUser, op: CrudOp) {
  const companyId = user.companyId!;
  const d = op.opData ?? {};
  if (!(await hasPermission(user, "work_orders.update"))) return fail("Sin permiso.");

  if (op.op === "PUT") {
    const parent = await parentWorkOrder(admin, companyId, d.work_order_id);
    if (!parent) return fail("Orden inválida.");
    if (user.role === "technician" && parent.created_by !== user.id) {
      return fail("Solo tu propia orden.");
    }
    const quantity = toNumber(d.quantity) ?? 0;
    const unitCost = toNumber(d.unit_cost) ?? 0;
    const { error } = await admin.from("work_order_materials").insert({
      id: op.id,
      work_order_id: d.work_order_id,
      description: String(d.description ?? ""),
      quantity,
      unit_cost: unitCost,
      subtotal: round2Local(quantity * unitCost),
    });
    if (error) throw error;
    return;
  }

  const { data: existing } = await admin
    .from("work_order_materials")
    .select("id, work_order_id")
    .eq("id", op.id)
    .maybeSingle();
  if (!existing) return fail("Material no encontrado.");
  const parent = await parentWorkOrder(admin, companyId, existing.work_order_id);
  if (!parent) return fail("Orden inválida.");
  if (user.role === "technician" && parent.created_by !== user.id) {
    return fail("Solo tu propia orden.");
  }

  if (op.op === "DELETE") {
    const { error } = await admin.from("work_order_materials").delete().eq("id", op.id);
    if (error) throw error;
    return;
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (MATERIAL_PATCH_FIELDS.has(k)) patch[k] = v;
  }
  if ("quantity" in patch || "unit_cost" in patch) {
    const { data: current } = await admin
      .from("work_order_materials")
      .select("quantity, unit_cost")
      .eq("id", op.id)
      .maybeSingle();
    const q = "quantity" in patch ? toNumber(patch.quantity) ?? 0 : Number(current?.quantity ?? 0);
    const u = "unit_cost" in patch ? toNumber(patch.unit_cost) ?? 0 : Number(current?.unit_cost ?? 0);
    patch.quantity = q;
    patch.unit_cost = u;
    patch.subtotal = round2Local(q * u);
  }
  const { error } = await admin.from("work_order_materials").update(patch).eq("id", op.id);
  if (error) throw error;
}

async function applyPhotoOp(admin: Admin, user: RouteUser, op: CrudOp) {
  const companyId = user.companyId!;
  const d = op.opData ?? {};
  if (!(await hasPermission(user, "work_orders.update"))) return fail("Sin permiso.");

  if (op.op === "PUT") {
    const parent = await parentWorkOrder(admin, companyId, d.work_order_id);
    if (!parent) return fail("Orden inválida.");
    if (user.role === "technician" && parent.created_by !== user.id) {
      return fail("Solo tu propia orden.");
    }
    const { error } = await admin.from("work_order_photos").insert({
      id: op.id,
      work_order_id: d.work_order_id,
      storage_path: String(d.storage_path ?? ""),
      photo_type: String(d.photo_type ?? "durante"),
    });
    if (error) throw error;
    return;
  }

  const { data: existing } = await admin
    .from("work_order_photos")
    .select("id, work_order_id")
    .eq("id", op.id)
    .maybeSingle();
  if (!existing) return fail("Foto no encontrada.");
  const parent = await parentWorkOrder(admin, companyId, existing.work_order_id);
  if (!parent) return fail("Orden inválida.");
  if (user.role === "technician" && parent.created_by !== user.id) {
    return fail("Solo tu propia orden.");
  }

  if (op.op === "DELETE") {
    const { error } = await admin.from("work_order_photos").delete().eq("id", op.id);
    if (error) throw error;
    return;
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (PHOTO_PATCH_FIELDS.has(k)) patch[k] = v;
  }
  const { error } = await admin.from("work_order_photos").update(patch).eq("id", op.id);
  if (error) throw error;
}

function round2Local(n: number): number {
  return Math.round(n * 100) / 100;
}
