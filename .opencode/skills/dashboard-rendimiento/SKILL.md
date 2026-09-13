---
name: dashboard-rendimiento
description: Métricas del panel del Dueño, cálculo de rendimiento por técnico (incluidas horas trabajadas), y los principios de diseño mobile-first para la pantalla de inicio del técnico. Usar al implementar cualquier dashboard, vista agregada, o la pantalla principal del rol Técnico.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "11,13"
---

## Panel del Dueño

- Turnos de hoy, técnicos trabajando, trabajos pendientes.
- Monto cobrado (hoy / período seleccionable).
- Clientes totales, clientes con deuda, monto total pendiente en cuenta corriente.
- Presupuestos pendientes, monto presupuestado, monto por cerrar.
- Mantenimientos próximos (contador, ver criterio de "próximo" abajo).
- Alertas: cuentas vencidas, garantías por vencer.

## Rendimiento por técnico

- Trabajos realizados, presupuestos generados y aceptados, facturación generada — son agregaciones directas sobre `work_orders`/`quotes`/`account_charges`, sin complejidad adicional.
- **Horas trabajadas**: `SUM(work_orders.actual_end_at - work_orders.actual_start_at)` por técnico en el período — usar los timestamps reales de inicio/fin, nunca `created_at`.
- **Tiempo promedio de resolución**: promedio de `actual_end_at - actual_start_at` por `work_order`, o si se quiere medir el ciclo completo, `work_order.actual_end_at - service_request.created_at` (desde que se pidió hasta que se resolvió) — definir cuál de las dos métricas se muestra y etiquetarla claramente en la UI para no confundir "tiempo de la visita" con "tiempo de resolución del pedido".

## Mantenimiento preventivo — criterio de "próximo"

Basado en `equipment.install_date` + un intervalo configurable (ej. cada 6 meses, valor por empresa en `company_settings` si existe, o un default fijo si no). Un equipo aparece como "mantenimiento próximo" cuando faltan menos de X días para la fecha calculada — no esperar a que ya haya vencido para mostrarlo.

## Pantalla principal del Técnico — mobile-first

No mostrar un menú administrativo completo. Principio: máximo 4-5 accesos grandes, pensados para uso con una mano:

- Mis Turnos
- Trabajos
- Escanear QR
- Clientes

Indicador permanente de estado de sincronización visible desde esta pantalla (ver skill `offline-powersync`). El flujo esperado en campo es: Escanear QR → ficha del equipo → Nueva visita — con el cliente, equipo, modelo, serie, refrigerante e historial ya cargados en contexto, sin que el técnico tenga que buscarlos de nuevo.

## Errores comunes a evitar

- Calcular horas trabajadas con `created_at`/`updated_at` en vez de `actual_start_at`/`actual_end_at`.
- Mostrar al técnico la misma navegación completa que ve el Dueño/Administrativo en desktop.
- Mezclar "tiempo de la visita" y "tiempo de resolución del pedido" como si fueran la misma métrica sin aclararlo en la UI.
