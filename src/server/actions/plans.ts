"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MODULES } from "@/lib/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperuser } from "@/server/auth";

export type PlanActionState = {
  error?: string;
  success?: boolean;
};

const planSchema = z.object({
  key: z.string().trim().min(1, "Key requerido").regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guión bajo"),
  name: z.string().trim().min(1, "Nombre requerido"),
  description: z.string().optional(),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0),
  sort_order: z.number().min(0),
  is_active: z.boolean(),
});

function modulesToFeatures(modules: Set<string>): string[] {
  const allModuleKeys = MODULES.map((m) => m.key);
  return allModuleKeys.filter((k) => modules.has(k));
}

export async function createPlanAction(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSuperuser();
  const modules = MODULES.map((m) => m.key).filter((k) => formData.get(`module_${k}`) === "on");
  const moduleSet = new Set(modules);

  const parsed = planSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price_monthly: Number(formData.get("price_monthly")),
    price_yearly: Number(formData.get("price_yearly")),
    sort_order: Number(formData.get("sort_order")),
    is_active: formData.get("is_active") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const features = modules;

  const { error } = await admin.from("plans").insert({
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price_monthly: parsed.data.price_monthly,
    price_yearly: parsed.data.price_yearly,
    features,
    is_active: parsed.data.is_active,
    sort_order: parsed.data.sort_order,
  });

  if (error) return { error: error.message };

  revalidatePath("/superadmin/planes");
  redirect("/superadmin/planes");
}

export async function updatePlanAction(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSuperuser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID requerido." };

  const modules = MODULES.map((m) => m.key).filter((k) => formData.get(`module_${k}`) === "on");

  const parsed = planSchema.extend({ id: z.string().uuid() }).safeParse({
    id,
    key: formData.get("key"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price_monthly: Number(formData.get("price_monthly")),
    price_yearly: Number(formData.get("price_yearly")),
    sort_order: Number(formData.get("sort_order")),
    is_active: formData.get("is_active") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("plans")
    .update({
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price_monthly: parsed.data.price_monthly,
      price_yearly: parsed.data.price_yearly,
      features: modules,
      is_active: parsed.data.is_active,
      sort_order: parsed.data.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/superadmin/planes");
  redirect("/superadmin/planes");
}

export async function deletePlanAction(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await requireSuperuser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID requerido." };

  const admin = createAdminClient();

  const { data: companies } = await admin.from("companies").select("id").eq("plan", id).limit(1);
  if (companies && companies.length > 0) {
    return { error: "No se puede eliminar: hay empresas usando este plan." };
  }

  const { error } = await admin.from("plans").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/superadmin/planes");
  redirect("/superadmin/planes");
}