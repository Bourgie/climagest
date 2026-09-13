---
name: offline-powersync
description: Arquitectura offline-first del flujo de campo del técnico usando PowerSync sobre Supabase — qué datos se sincronizan, cómo se definen las Sync Rules, y la separación con RLS. Usar al integrar PowerSync, definir qué sincroniza offline, o construir cualquier pantalla del técnico que deba funcionar sin conexión.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "8"
---

## Qué necesita ser offline (alcance acotado, no toda la app)

Solo el flujo del **Técnico en campo**:
- Sus turnos del día (`appointments` donde participa vía `appointment_technicians`).
- Los `clients`, `equipment` y `client_addresses` relacionados a esos turnos.
- La carga completa de una `work_order` (texto, `measurements`, `work_order_materials`, `work_order_photos`, firma).

El resto de la app (dashboard del Dueño, cuenta corriente, administración, configuración de permisos) es 100% online. No sincronices esas tablas offline — no hace falta y complica las Sync Rules sin necesidad.

## Cómo funciona

PowerSync mantiene una base SQLite local en el dispositivo del técnico. La app lee y escribe siempre contra esa base local — instantáneo, haya o no señal. PowerSync sincroniza en segundo plano con el Postgres de Supabase vía logical replication, y sube la cola de escrituras pendientes cuando hay conexión.

## Sync Rules — la pieza que hay que definir con cuidado

PowerSync **no usa las políticas RLS de Postgres** para decidir qué le corresponde a cada técnico — tiene su propio sistema de reglas ("buckets") que hay que definir explícitamente. Estas reglas deben replicar el mismo scope que ya aplican las políticas RLS para ese técnico (sus turnos, los equipos relacionados), o vas a terminar con dos fuentes de autorización desalineadas: una que protege el acceso online (RLS) y otra que decide qué se descarga al celular (Sync Rules), y si no coinciden, el técnico podría terminar con datos de otro técnico u otra empresa en su base local.

Antes de dar por cerrada la Fase 8, verificar explícitamente: un técnico A nunca debe recibir en su SQLite local datos de turnos, equipos o clientes que no le correspondan — probarlo con al menos dos técnicos de la misma empresa y uno de otra empresa.

## Indicador de estado (UX obligatoria)

La pantalla del técnico debe mostrar siempre un indicador de estado de sincronización: 🟢 Sincronizado / 🔴 Sin conexión / 🔄 Sincronizando (N registros). No lo escondas en un menú — el técnico necesita saber en todo momento si lo que cargó ya subió al servidor.

## Conflictos

No se esperan conflictos reales: cada `work_order` tiene un único `created_by` (el técnico que la carga), y si un turno tiene varios técnicos asignados, cada uno carga su propia sección/registro — no editan el mismo registro a la vez. No implementes UI de resolución de conflictos en V1; si en el futuro aparece un caso real de escritura concurrente sobre el mismo registro, se revisa entonces.

## Errores comunes a evitar

- Sincronizar offline tablas que no lo necesitan (cuenta corriente, dashboard, configuración) — aumenta la superficie de Sync Rules sin ningún beneficio real.
- Dar por sentado que las Sync Rules replican RLS automáticamente — hay que escribirlas a mano y testearlas aparte.
- No mostrar el estado de sincronización, dejando al técnico sin saber si su trabajo ya se guardó en el servidor.
