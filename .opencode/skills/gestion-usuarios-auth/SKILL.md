---
name: gestion-usuarios-auth
description: Login de 3 factores (código de empresa + usuario + contraseña) sobre Supabase Auth vía email sintético, jerarquía de alta/reseteo de contraseña, y estados de empresa gestionados por el Superusuario. Usar al implementar login, alta de usuarios, panel de Superusuario, o cualquier pantalla de autenticación.
license: Proprietary
compatibility: opencode
metadata:
  project: aire-acondicionado
  fase: "1,2"
---

## Login de 3 factores sobre Supabase Auth

El formulario de login pide: código de empresa + usuario + contraseña. Sin login social, sin autoregistro público en ningún punto de la app.

**Problema técnico**: Supabase Auth exige un email único por proyecto, y todas las empresas comparten el mismo proyecto Supabase (es un solo backend multiempresa, no un proyecto Supabase por empresa).

**Solución**: cada `profile` tiene un `internal_email` sintético generado automáticamente al crear el usuario (ej. `{username}+{company_code}@internal.app`), invisible para el usuario final. El flujo de login es:

1. El usuario ingresa código de empresa + usuario + contraseña.
2. Un Server Action busca el `internal_email` correspondiente a esa combinación (join `companies.company_code` + `profiles`/`memberships`).
3. Recién ahí se llama a `supabase.auth.signInWithPassword({ email: internal_email, password })`.

El usuario nunca ve ni necesita conocer el `internal_email` — es un detalle de implementación, no algo que se le pida escribir.

**No confundir**: el código de empresa no reemplaza a `company_id` (UUID interno) en ningún lado del modelo de datos ni de las políticas RLS — es solo un identificador amigable usado en el formulario de login, que se resuelve a `company_id` en el mismo paso que resuelve el email sintético.

## Jerarquía de alta y reseteo de contraseña

| Usuario | Quién lo da de alta / resetea |
|---|---|
| Técnico / Administrativo | Dueño de su empresa |
| Dueño | Superusuario |
| Superusuario | Fuera de la app (consola de Supabase Auth), no expuesto en la UI |

Toda contraseña generada por un superior es provisoria y marca `force_password_change = true` en `profiles`. Al ingresar con esa contraseña, el sistema fuerza el cambio antes de permitir cualquier otra acción. Cada alta y reseteo queda en `audit_logs`.

## Estados de empresa

`companies.status`: `active` / `suspended` / `blocked` / `trial`. Una empresa `suspended` o `blocked` no puede iniciar sesión (bloquear en el mismo Server Action de login, antes de intentar `signInWithPassword`) — pero sus datos nunca se eliminan, solo se bloquea el acceso.

El `company_code` es único, permanente y no reutilizable — al "eliminar" una empresa (si algún día se soporta), su código no vuelve a estar disponible para una empresa nueva.

## No enumeración

El formulario de login no debe revelar si un código de empresa existe o no antes de completar el intento completo (código + usuario + contraseña) — un mensaje de error genérico ("credenciales incorrectas") sirve para los tres casos: código inexistente, usuario inexistente, o contraseña incorrecta. Registrar el intento fallido en auditoría igual (ver skill `qr-equipo-seguridad` para el patrón de `action: login_fail`, aplicable también acá a nivel de sesión general, no solo del QR).

## Superusuario — alta de empresa

Pantalla mínima: crear `company` (name, company_code, status inicial), definir `company_modules` activos, y crear el primer `profile` con rol Dueño (con `internal_email` generado y `force_password_change = true`). Desde ahí, ese Dueño ya administra su empresa por su cuenta.
