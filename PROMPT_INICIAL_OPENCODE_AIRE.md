Vas a construir un proyecto nuevo desde cero en esta carpeta. Antes de escribir una sola línea de código, leé todo lo que ya está acá:

1. **`Plan_Completo_V1_AireAcondicionado.pdf`** — es el plan técnico completo y ya cerrado del proyecto: visión, alcance, roles y permisos (incluido el sistema de permisos granulares configurables), autenticación de 3 factores, modelo de datos completo, arquitectura offline con PowerSync, seguridad del QR público, roadmap de 14 fases, checklist de seguridad de 25 puntos y criterios de aceptación. Es la fuente de verdad del proyecto. No propongas alcance nuevo ni te desvíes de él sin preguntar primero.

2. **Carpeta `.opencode/`** — ya tiene configurados 5 agentes (`.opencode/agent/`) y 8 skills (`.opencode/skills/`) específicos de este proyecto. Usalos activamente:
   - `rls-auditor`, `db-schema-reviewer`, `code-reviewer` y `qa-tester` como revisores en cada fase.
   - `security-checklist` obligatorio antes de cualquier deploy a producción.
   - Los skills (`flujo-orden-trabajo`, `permisos-granulares`, `offline-powersync`, `qr-equipo-seguridad`, `cuenta-corriente-garantias`, `gestion-usuarios-auth`, `dashboard-rendimiento`, `checklist-seguridad`) son referencia obligatoria al tocar esos módulos — consultalos, no reinventes esas reglas por tu cuenta.

No hay archivos de ejemplo tipo PDF de cotización en este proyecto (a diferencia de otro que hice antes) — acá no hay ingesta de documentos externos, así que no busques ni esperes ese tipo de input.

## Reglas no negociables (repetidas acá porque son las más fáciles de romper por accidente)

- **Login de 3 factores**: código de empresa + usuario + contraseña, resuelto internamente a un email sintético de Supabase Auth (ver skill `gestion-usuarios-auth`). El usuario nunca ve ni escribe ese email interno. No lo reemplaces por un login de email+password simple aunque parezca "más estándar".
- **Dos capas de seguridad separadas, nunca mezcladas**: RLS resuelve *aislamiento* multiempresa (qué filas de qué empresa). Los permisos granulares de negocio (¿puede este Administrativo eliminar un cliente?) se validan en Server Actions contra `role_permissions`, nunca dentro de una política RLS.
- **El QR público sirve una whitelist explícita de campos**, nunca el registro completo con algo "oculto" en el frontend. Precios, costos, contacto del cliente, dirección completa y diagnóstico técnico detallado NUNCA viajan a la vista pública.
- **PowerSync solo sincroniza el flujo del Técnico en campo** (sus turnos, equipos relacionados, carga de Orden de Trabajo) — no sincronices offline el dashboard, la cuenta corriente ni la administración, no hace falta y complica las Sync Rules sin necesidad.
- **Pagos parciales se aplican manualmente**, nunca automático a la deuda más vieja. **Recargo por mora nunca es automático**, lo decide el Dueño caso por caso.
- **El formulario técnico estructurado de la Orden de Trabajo es siempre opcional** — no fuerces el llenado de mediciones (presión, superheat, subcooling) en visitas simples.
- No agregues módulos fuera de alcance (inventario real, cobro online, integración de API de WhatsApp, portal de cliente con login propio) — están explícitamente diferidos a V1.1/V2 en el plan.

## Cómo quiero que trabajes

- Seguí el roadmap de 14 fases tal como está en el plan (sección 14), en orden. No saltes de fase sin que yo confirme que la anterior está validada.
- Al cerrar cada fase: corré `qa-tester`, y si la fase tocó tablas/RLS/permisos, corré también `rls-auditor` y `db-schema-reviewer`.
- Al cerrar la Fase 8 (Offline/PowerSync) específicamente: probá con al menos 2 técnicos de la misma empresa y 1 de otra empresa que las Sync Rules no mezclen datos entre ellos, antes de darla por cerrada.
- Antes del primer deploy a producción (fin de Fase 14): corré `security-checklist` completo (25 puntos) y no avances si queda algún punto en ❌.
- Si encontrás una ambigüedad que el plan no resuelve, preguntame antes de asumir — no la resuelvas "a tu criterio" en silencio, sobre todo si toca seguridad, permisos o el modelo de datos.
- Documentá las variables de entorno que vayas necesitando (`.env.example`, incluidas las de PowerSync además de las de Supabase) y las decisiones arquitectónicas relevantes a medida que avances.
- Creá datos seed y una empresa/cuenta demo solo para desarrollo, nunca con datos reales.
- Diseño mobile-first real para el rol Técnico: pantallas simples, botones grandes, máximo 4-5 accesos desde la pantalla principal — no le muestres la misma navegación que ve el Dueño en desktop.

## Para arrancar ahora

Empezá por **Fase 0 — Foundation**: inicializar Next.js + TypeScript, estructura modular, configuración de Supabase, integración inicial de PowerSync (instalación de SDK, aunque la sincronización real se implemente recién en Fase 8), lint/formatting, y el `.gitignore` con las variables de entorno excluidas desde el primer commit (checklist de seguridad, punto 2).

Antes de tocar código, contame qué necesitás de mí para arrancar (credenciales de Supabase, cuenta de PowerSync, algún dato del negocio del cliente que el plan no haya cubierto) para que te lo prepare.
