# Eliminar Usuarios + Limpieza de DB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que solo el GERENTE pueda gestionar, desactivar y eliminar usuarios permanentemente (tombstone), y limpiar la DB para producción.

**Architecture:** Se agrega un campo `eliminado` al modelo `Usuario`. El DELETE hace tombstone (anonimiza email/password, borra tokens, marca `eliminado=true`). Los datos históricos (pedidos, logs, pagos) conservan la referencia al nombre. Se restringe todo el módulo a solo `GERENTE`. Un script one-shot limpia la DB.

**Tech Stack:** Node.js/Express, Prisma ORM, PostgreSQL, React + TanStack Query

---

## Files Modified / Created

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Modify — agregar campo `eliminado` |
| `backend/src/routes/usuarios.js` | Modify — restricción GERENTE, tombstone DELETE, filtro GET |
| `frontend/src/App.jsx` | Modify — ruta /usuarios solo GERENTE |
| `frontend/src/pages/Usuarios.jsx` | Modify — botón Eliminar, modal confirmación, mostrar GERENTE en roles |
| `backend/scripts/reset-db.js` | Create — script one-shot limpieza DB |

---

## Task 1: Migración — agregar campo `eliminado` al modelo Usuario

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Agregar campo `eliminado` al modelo Usuario**

En `backend/prisma/schema.prisma`, dentro del modelo `Usuario` (después de la línea `activo Boolean @default(true)`), agregar:

```prisma
eliminado      Boolean  @default(false)
```

El modelo queda:
```prisma
model Usuario {
  id             Int      @id @default(autoincrement())
  nombre         String
  email          String   @unique
  password       String
  rol            Rol
  localPrincipal Local?
  activo         Boolean  @default(true)
  eliminado      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  pedidosCreados    Pedido[]          @relation("PedidoCreador")
  etapasCompletadas EtapaProduccion[]
  logs              Log[]
  refreshTokens     RefreshToken[]
  pagosRegistrados  Pago[]
}
```

- [ ] **Step 2: Correr la migración**

```bash
cd backend
npx prisma migrate dev --name add-eliminado-usuario
```

Salida esperada: `✔ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: agregar campo eliminado al modelo Usuario"
```

---

## Task 2: Backend — restricción GERENTE + tombstone DELETE + filtro GET

**Files:**
- Modify: `backend/src/routes/usuarios.js`

- [ ] **Step 1: Cambiar middleware a solo GERENTE y filtrar eliminados en GET**

Reemplazar el contenido completo de `backend/src/routes/usuarios.js`:

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRol } = require('../middleware/auth');
const { log } = require('../services/logger');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate, requireRol('GERENTE'));

// GET /api/usuarios
router.get('/', async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { eliminado: false },
    select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true, createdAt: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(usuarios);
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  const { nombre, email, password, rol, localPrincipal } = req.body;
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

  const usuario = await prisma.usuario.create({
    data: { nombre, email, password: bcrypt.hashSync(password, 10), rol, localPrincipal: localPrincipal || null },
    select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true },
  });

  await log({ usuarioId: req.user.id, accion: 'CREAR_USUARIO', entidad: 'Usuario', entidadId: usuario.id, detalle: `${nombre} (${rol})` });
  res.status(201).json(usuario);
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, email, password, rol, localPrincipal, activo } = req.body;

  const data = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (email !== undefined) data.email = email;
  if (password) data.password = bcrypt.hashSync(password, 10);
  if (rol !== undefined) data.rol = rol;
  if (localPrincipal !== undefined) data.localPrincipal = localPrincipal || null;
  if (activo !== undefined) data.activo = activo;

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true },
    });
    await log({ usuarioId: req.user.id, accion: 'EDITAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: JSON.stringify(data) });
    res.json(usuario);
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

// DELETE /api/usuarios/:id (desactivar — soft disable)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: { id: true, nombre: true },
  });
  await log({ usuarioId: req.user.id, accion: 'DESACTIVAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: usuario.nombre });
  res.json({ ok: true });
});

// DELETE /api/usuarios/:id/eliminar (tombstone — eliminación permanente)
router.delete('/:id/eliminar', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { nombre: true, eliminado: true } });
    if (!usuario || usuario.eliminado) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nombreOriginal = usuario.nombre;

    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { usuarioId: id } }),
      prisma.usuario.update({
        where: { id },
        data: {
          email: `eliminado_${id}@deleted.local`,
          password: bcrypt.hashSync(crypto.randomUUID(), 10),
          activo: false,
          eliminado: true,
        },
      }),
    ]);

    await log({ usuarioId: req.user.id, accion: 'ELIMINAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: nombreOriginal });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/usuarios.js
git commit -m "feat: restricción GERENTE, tombstone DELETE y filtro eliminados en usuarios"
```

---

## Task 3: Frontend — ruta solo GERENTE + botón Eliminar con confirmación

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Usuarios.jsx`

- [ ] **Step 1: Restringir ruta /usuarios a solo GERENTE en App.jsx**

En `frontend/src/App.jsx`, línea 36, cambiar:
```jsx
<Route path="usuarios" element={<PrivateRoute roles={['ADMINISTRADOR', 'GERENTE']}><Usuarios /></PrivateRoute>} />
```
por:
```jsx
<Route path="usuarios" element={<PrivateRoute roles={['GERENTE']}><Usuarios /></PrivateRoute>} />
```

- [ ] **Step 2: Reemplazar Usuarios.jsx con soporte para Eliminar**

Reemplazar el contenido completo de `frontend/src/pages/Usuarios.jsx`:

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const ROL_LABEL = { ADMINISTRADOR:'Administrador', VENDEDOR:'Vendedor', PRODUCCION:'Producción', GERENTE:'Gerente' };
const ROL_COLOR = { ADMINISTRADOR:'bg-brand/15 text-brand', VENDEDOR:'bg-blue-500/15 text-blue-400', PRODUCCION:'bg-purple-500/15 text-purple-400', GERENTE:'bg-yellow-500/15 text-yellow-400' };

const INIT_FORM = { nombre:'', email:'', password:'', rol:'VENDEDOR', localPrincipal:'' };

export default function Usuarios() {
  const qc = useQueryClient();
  const { usuario: usuarioActual } = useAuth();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(INIT_FORM);
  const [error, setError] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = useMutation({
    mutationFn: (data) => editando
      ? api.put(`/usuarios/${editando.id}`, data).then((r) => r.data)
      : api.post('/usuarios', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); cerrarModal(); },
    onError: (err) => setError(err.response?.data?.error || 'Error'),
  });

  const desactivar = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const eliminar = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}/eliminar`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setConfirmarEliminar(null); },
  });

  function abrirCrear() {
    setEditando(null);
    setForm(INIT_FORM);
    setError('');
    setModal(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, localPrincipal: u.localPrincipal || '' });
    setError('');
    setModal(true);
  }

  function cerrarModal() { setModal(false); setEditando(null); setError(''); }

  function handleSubmit(e) {
    e.preventDefault();
    const data = { nombre: form.nombre, email: form.email, rol: form.rol, localPrincipal: form.localPrincipal || null };
    if (form.password) data.password = form.password;
    if (!editando) data.password = form.password;
    guardar.mutate(data);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <button onClick={abrirCrear} className="btn-primary">+ Nuevo usuario</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Rol</th>
                <th className="pb-3 pr-4">Local</th>
                <th className="pb-3 pr-4">Estado</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 pr-4 text-white font-medium">{u.nombre}</td>
                  <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${ROL_COLOR[u.rol]}`}>{ROL_LABEL[u.rol]}</span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{u.localPrincipal ? LOCAL_LABEL[u.localPrincipal] : '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${u.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(u)} className="text-xs text-gray-400 hover:text-white">Editar</button>
                      {u.activo && u.id !== usuarioActual?.id && (
                        <button onClick={() => desactivar.mutate(u.id)} className="text-xs text-orange-400 hover:text-orange-300">Desactivar</button>
                      )}
                      {u.id !== usuarioActual?.id && (
                        <button onClick={() => setConfirmarEliminar(u)} className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={cerrarModal} title={editando ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">{editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!editando} minLength={6} />
          </div>
          <div>
            <label className="label">Rol *</label>
            <select className="input" value={form.rol} onChange={(e) => set('rol', e.target.value)} required>
              <option value="VENDEDOR">Vendedor</option>
              <option value="PRODUCCION">Producción</option>
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="GERENTE">Gerente</option>
            </select>
          </div>
          <div>
            <label className="label">Local principal</label>
            <select className="input" value={form.localPrincipal} onChange={(e) => set('localPrincipal', e.target.value)}>
              <option value="">Sin local asignado</option>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={cerrarModal}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal open={!!confirmarEliminar} onClose={() => setConfirmarEliminar(null)} title="Eliminar usuario">
        <div className="space-y-4">
          <p className="text-gray-300">
            ¿Estás seguro que querés eliminar a <span className="text-white font-semibold">{confirmarEliminar?.nombre}</span>?
          </p>
          <p className="text-gray-500 text-sm">
            Esta acción es permanente. El historial del usuario se conservará con su nombre.
          </p>
          <div className="flex gap-3">
            <button
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => eliminar.mutate(confirmarEliminar.id)}
              disabled={eliminar.isPending}
            >
              {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button className="btn-secondary" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx frontend/src/pages/Usuarios.jsx
git commit -m "feat: eliminar usuarios (tombstone) + restricción solo GERENTE"
```

---

## Task 4: Script one-shot — limpieza de DB para producción

**Files:**
- Create: `backend/scripts/reset-db.js`

- [ ] **Step 1: Crear directorio y script**

```bash
mkdir -p backend/scripts
```

Crear `backend/scripts/reset-db.js`:

```javascript
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMAILS_A_CONSERVAR = [
  'mduranclem@gmail.com',
  'laurabrito76produccion@gmail.com',
  'silviaincollege1977@gmail.com',
  'valeriaclementi3@gmail.com',
];

async function main() {
  console.log('Iniciando limpieza de base de datos...');

  // 1. Borrar logs
  const logs = await prisma.log.deleteMany({});
  console.log(`Logs eliminados: ${logs.count}`);

  // 2. Borrar pagos
  const pagos = await prisma.pago.deleteMany({});
  console.log(`Pagos eliminados: ${pagos.count}`);

  // 3. Borrar etapas de producción
  const etapas = await prisma.etapaProduccion.deleteMany({});
  console.log(`Etapas eliminadas: ${etapas.count}`);

  // 4. Borrar prendas
  const prendas = await prisma.prenda.deleteMany({});
  console.log(`Prendas eliminadas: ${prendas.count}`);

  // 5. Borrar pedidos
  const pedidos = await prisma.pedido.deleteMany({});
  console.log(`Pedidos eliminados: ${pedidos.count}`);

  // 6. Borrar refresh tokens
  const tokens = await prisma.refreshToken.deleteMany({});
  console.log(`Tokens eliminados: ${tokens.count}`);

  // 7. Borrar usuarios que no están en la lista
  const usuarios = await prisma.usuario.deleteMany({
    where: {
      email: { notIn: EMAILS_A_CONSERVAR },
    },
  });
  console.log(`Usuarios eliminados: ${usuarios.count}`);

  // 8. Verificar usuarios conservados
  const conservados = await prisma.usuario.findMany({
    select: { id: true, nombre: true, email: true, rol: true },
  });
  console.log('\nUsuarios conservados:');
  conservados.forEach((u) => console.log(`  - ${u.nombre} (${u.email}) [${u.rol}]`));

  console.log('\nLimpieza completada.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ejecutar el script**

```bash
cd backend
node scripts/reset-db.js
```

Salida esperada:
```
Iniciando limpieza de base de datos...
Logs eliminados: X
Pagos eliminados: X
Etapas eliminadas: X
Prendas eliminadas: X
Pedidos eliminados: X
Tokens eliminados: X
Usuarios eliminados: X

Usuarios conservados:
  - [nombre] (mduranclem@gmail.com) [GERENTE]
  - ...

Limpieza completada.
```

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/reset-db.js
git commit -m "chore: script one-shot de limpieza de DB para producción"
```
