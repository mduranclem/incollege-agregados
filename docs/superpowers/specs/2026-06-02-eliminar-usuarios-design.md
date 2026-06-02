# Diseño: Eliminar Usuarios + Limpieza de DB

**Fecha:** 2026-06-02  
**Estado:** Aprobado

---

## Contexto

Actualmente el sistema solo permite *desactivar* usuarios (soft delete con `activo=false`). Tanto `ADMINISTRADOR` como `GERENTE` pueden gestionar usuarios. Se requiere:

1. Que **solo el GERENTE** pueda gestionar usuarios (editar, desactivar, eliminar).
2. Una opción de **eliminación permanente** que preserve el nombre del usuario en el historial.
3. Una **limpieza única de la DB** para arrancar en producción.

---

## Parte 1 — Limpieza única de la base de datos

Script de limpieza a ejecutar una sola vez antes de salir a producción:

- **Eliminar** todos los pedidos y datos relacionados (etapas de producción, pagos, logs de auditoría, tokens de sesión).
- **Eliminar** todos los usuarios excepto los siguientes:
  - `mduranclem@gmail.com`
  - `laurabrito76produccion@gmail.com`
  - `silviaincollege1977@gmail.com`
  - `valeriaclementi3@gmail.com`

Se implementa como un script Node.js con Prisma Client (`scripts/reset-db.js`), ejecutable con `node scripts/reset-db.js`.

---

## Parte 2 — Feature: Eliminar usuarios

### Modelo de datos

Agregar campo al modelo `Usuario` en `prisma/schema.prisma`:

```prisma
eliminado Boolean @default(false)
```

Un usuario eliminado tiene:
- `eliminado = true`
- `activo = false`
- `nombre` conservado (para historial)
- `email` anonimizado (ej: `eliminado_<id>@deleted.local`)
- `password` invalidado (hash vacío o aleatorio)
- `refreshTokens` borrados

### Backend

**Cambios en `backend/src/routes/usuarios.js`:**

| Endpoint | Cambio |
|----------|--------|
| `GET /api/usuarios` | Solo `GERENTE`. Filtrar `eliminado: false` en la query. |
| `POST /api/usuarios` | Solo `GERENTE`. |
| `PUT /api/usuarios/:id` | Solo `GERENTE`. |
| `DELETE /api/usuarios/:id` | Solo `GERENTE`. Comportamiento: **tombstone** (ver abajo). |

**Lógica del DELETE (tombstone):**
1. Verificar que el usuario no se elimine a sí mismo.
2. Anonimizar email → `eliminado_<id>@deleted.local`
3. Invalidar password → hash bcrypt de un UUID aleatorio
4. Borrar todos sus `refreshTokens`
5. Marcar `eliminado=true`, `activo=false`
6. Loguear acción `ELIMINAR_USUARIO`

### Frontend

**`frontend/src/App.jsx`:**
- Ruta `/usuarios` restringida a `roles={['GERENTE']}` únicamente.

**`frontend/src/pages/Usuarios.jsx`:**
- Agregar mutation `eliminar` que llama `DELETE /api/usuarios/:id`.
- Agregar botón "Eliminar" (rojo) en cada fila, visible solo si el usuario logueado es `GERENTE`.
- El botón dispara un modal de confirmación con texto: _"¿Estás seguro? Esta acción es permanente. El historial del usuario se conservará."_
- Al confirmar, el usuario desaparece de la lista.
- No mostrar usuarios con `eliminado=true` (el backend ya los filtra).

---

## Restricciones

- Un GERENTE no puede eliminarse a sí mismo.
- Los datos históricos (pedidos, pagos, etapas, logs) conservan la referencia al nombre del usuario eliminado sin ningún cambio.
- La limpieza de DB es un script one-shot, no una función de la app.
