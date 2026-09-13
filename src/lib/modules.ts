export type Plan = "basico" | "profesional" | "premium";

export const PLANS: Plan[] = ["basico", "profesional", "premium"];

export const MODULES = [
  { key: "clientes", label: "Clientes" },
  { key: "equipos", label: "Equipos y QR" },
  { key: "agenda", label: "Agenda" },
  { key: "presupuestos", label: "Presupuestos" },
  { key: "ordenes_trabajo", label: "Órdenes de trabajo" },
  { key: "cuenta_corriente", label: "Cuenta corriente" },
  { key: "garantias", label: "Garantías" },
  { key: "dashboard", label: "Dashboard" },
  { key: "reportes", label: "Reportes" },
  { key: "notificaciones", label: "Notificaciones" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

/** Módulos habilitados por defecto según el plan (el Superusuario puede
 * sobrescribirlos manualmente en el panel). */
export const MODULE_PRESETS: Record<Plan, ModuleKey[]> = {
  basico: ["clientes", "agenda"],
  profesional: [
    "clientes",
    "equipos",
    "agenda",
    "presupuestos",
    "ordenes_trabajo",
    "cuenta_corriente",
    "dashboard",
  ],
  premium: MODULES.map((m) => m.key),
};
