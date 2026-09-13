# Agentes y Skills para OpenCode — App de Gestión para Empresas de Aire Acondicionado

Este paquete complementa el **Plan_Completo_V1_AireAcondicionado.pdf**. Define subagentes y skills que OpenCode puede usar automáticamente (o invocarse con `@nombre`) durante el desarrollo del proyecto.

## Instalación

1. Copiá la carpeta `.opencode/` completa a la raíz del repositorio del proyecto (mismo nivel que `package.json`).
2. OpenCode detecta automáticamente los agentes y skills al abrir el proyecto.
3. Verificá con `opencode agent list` dentro de una sesión.

## Agentes (`.opencode/agent/`)

| Agente | Cuándo se usa |
|---|---|
| `rls-auditor` | Después de crear/modificar tablas, políticas RLS, server actions, o el endpoint del QR público. Solo lectura. |
| `db-schema-reviewer` | Antes de aplicar una migración nueva o modificar una tabla existente. Solo lectura. |
| `code-reviewer` | Al cerrar una fase, revisión general de calidad de código. Solo lectura. |
| `qa-tester` | Al cerrar cada fase, verifica cobertura de tests (aislamiento, permisos granulares, flujo operativo, QR, offline). Puede escribir tests. |
| `security-checklist` | Antes de cualquier deploy a producción. Corre los 25 puntos del skill `checklist-seguridad`. Solo lectura. |

Invocación manual: `@rls-auditor`, `@db-schema-reviewer`, `@code-reviewer`, `@qa-tester`, `@security-checklist`.

## Skills (`.opencode/skills/`)

| Skill | Contenido |
|---|---|
| `flujo-orden-trabajo` | Máquina de estados Pedido→Presupuesto→Turno→Orden de Trabajo→Cobro, incluida garantía y horas reales. |
| `permisos-granulares` | Sistema de permisos configurables por el Dueño (role_permissions), separado de RLS. |
| `offline-powersync` | Arquitectura offline-first del flujo del técnico, Sync Rules de PowerSync, alcance acotado. |
| `qr-equipo-seguridad` | Whitelist de la vista pública del QR, consultas externas, auditoría de accesos. |
| `cuenta-corriente-garantias` | Cargos, pagos con aplicación manual, recargo por mora opcional, garantías por trabajo. |
| `gestion-usuarios-auth` | Login de 3 factores (código de empresa + usuario + contraseña) sobre email sintético de Supabase Auth, jerarquía de reseteo. |
| `dashboard-rendimiento` | Métricas del panel del Dueño, cálculo de horas trabajadas por técnico, principios mobile-first. |
| `checklist-seguridad` | Los 25 puntos de seguridad (22 generales + 3 específicos del proyecto). |

## Notas

- Estos archivos reflejan el estado del **Plan Completo V1** consolidado (multiempresa modular, permisos granulares configurables desde V1, offline-first con PowerSync, flujo Pedido→Presupuesto→Turno→Orden de Trabajo, QR con vista pública/privada, WhatsApp por enlace, cuenta corriente con aplicación manual de pagos, garantías con alerta de reingreso).
- Si el plan cambia, actualizá el skill correspondiente — son la fuente de verdad operativa que OpenCode va a seguir.
- Los agentes `rls-auditor`, `db-schema-reviewer` y `security-checklist` tienen `permission.edit: deny` a propósito: son revisores, no ejecutores.
- Este proyecto reutiliza el mismo patrón de agentes que el proyecto de "Seguimiento Comercial", adaptado a un dominio distinto — si trabajás ambos proyectos en paralelo, no mezcles las carpetas `.opencode/` de uno y otro, cada repo tiene la suya propia.
