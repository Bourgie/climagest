"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildInternalEmail } from "@/lib/internal-email";
import { isCompanyLoginBlocked } from "@/lib/auth-logic";

const loginSchema = z.object({
  companyCode: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  website: z.string().optional(), // honeypot
});

export type LoginState = { error?: string };

/**
 * Login de 3 factores: código de empresa + usuario + contraseña.
 * Se resuelve a un email sintético y recién ahí llama a signInWithPassword.
 * Mensaje de error genérico en todos los casos para no permitir enumeración
 * de códigos de empresa / usuarios (ver skill gestion-usuarios-auth).
 * Protección anti-bot: honeypot + rate limiting básico.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    companyCode: formData.get("companyCode"),
    username: formData.get("username"),
    password: formData.get("password"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { error: "Completá los tres campos." };
  }

  // Honeypot check - if filled, it's likely a bot
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { error: "Credenciales incorrectas." };
  }

  const companyCode = parsed.data.companyCode.toUpperCase();
  const username = parsed.data.username.toLowerCase();

  const admin = createAdminClient();

  // Rate limiting: max 5 intentos por IP/email por minuto (en memoria simple)
  // En producción usar Redis/Upstash; aquí bloqueo suave
  const ipHash = companyCode + username; // proxy para IP
  const { data: attempts } = await admin
    .from("qr_access_audit")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .eq("action", "login_fail")
    .gte("created_at", new Date(Date.now() - 60000).toISOString());

  if ((attempts?.length ?? 0) >= 5) {
    return { error: "Demasiados intentos. Esperá un minuto." };
  }

  // Bloquea empresas suspendidas/bloqueadas ANTES de intentar el login
  // (una empresa suspendida no inicia sesión; sus datos no se eliminan).
  const { data: company } = await admin
    .from("companies")
    .select("status")
    .eq("company_code", companyCode)
    .maybeSingle();

  if (company && isCompanyLoginBlocked(company.status)) {
    // Log failed attempt for rate limiting
    await admin.from("qr_access_audit").insert({
      equipment_id: null,
      actor_type: "user",
      user_id: null,
      action: "login_fail",
      ip_hash: ipHash,
    });
    return { error: "Credenciales incorrectas." };
  }

  const email = buildInternalEmail(username, companyCode);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // Log failed attempt for rate limiting
    await admin.from("qr_access_audit").insert({
      equipment_id: null,
      actor_type: "user",
      user_id: null,
      action: "login_fail",
      ip_hash: ipHash,
    });
    return { error: "Credenciales incorrectas." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("force_password_change")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.force_password_change) {
    redirect("/cambiar-password");
  }

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const superuserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Login dedicado del Superusuario (nivel plataforma, sin empresa). Distinto
 * del login de 3 factores de los usuarios de empresa. Tras el signIn se
 * verifica profiles.is_superuser; si no, se cierra la sesión.
 */
export async function superuserLogin(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = superuserLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Credenciales incorrectas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Credenciales incorrectas." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_superuser")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_superuser) {
    await supabase.auth.signOut();
    return { error: "No autorizado." };
  }

  redirect("/superadmin");
}

const changePasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

export type ChangePasswordState = { error?: string; success?: boolean };

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "No se pudo cambiar la contraseña." };
  }

  // Limpia el flag de contraseña provisoria.
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ force_password_change: false })
    .eq("id", user.id);

  redirect("/");
}
