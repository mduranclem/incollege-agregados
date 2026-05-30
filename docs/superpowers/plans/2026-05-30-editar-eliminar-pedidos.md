# Editar / Eliminar Pedidos y Deshacer Etapas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar y eliminar pedidos (VENDEDOR/ADMINISTRADOR) y deshacer etapas de producción avanzadas por error (ADMINISTRADOR/PRODUCCION).

**Architecture:** Tres endpoints nuevos en el backend (PUT pedido, DELETE pedido, PUT revertir-etapa), una página nueva en el frontend (EditarPedido), y modificaciones a DetallePedido para exponer los botones de editar, eliminar y deshacer etapa.

**Tech Stack:** Node.js + Express + Prisma (backend), React + React Query + React Router (frontend).

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/routes/pedidos.js` | Agregar `PUT /:id` y `DELETE /:id` |
| `backend/src/routes/prendas.js` | Agregar `PUT /:id/etapas/:etapaNombre/revertir` |
| `frontend/src/pages/EditarPedido.jsx` | Crear — formulario pre-poblado para editar |
| `frontend/src/pages/DetallePedido.jsx` | Modificar — botones editar/eliminar y deshacer etapa |
| `frontend/src/App.jsx` | Agregar ruta `/pedidos/:id/editar` |

---

## Task 1: Backend — PUT /api/pedidos/:id

**Files:**
- Modify: `backend/src/routes/pedidos.js`

- [ ] **Step 1: Agregar el endpoint PUT /:id en pedidos.js, antes de `module.exports`**

```javascript
// PUT /api/pedidos/:id
router.put('/:id', requireRol('VENDEDOR', 'ADMINISTRADOR'), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, apellido, apodo, colegio, numeroContrato, costoTotal, sena, fechaEntregaComprometida, localTomoPedido, prendas } = req.body;

  if (!nombre || !apellido || !colegio || !numeroContrato || !costoTotal || !sena || !fechaEntregaComprometida || !localTomoPedido) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const pedidoActual = await prisma.pedido.findUnique({
    where: { id },
    include: { prendas: { include: { etapas: true } } },
  });

  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedidoActual.estado === 'ENTREGADO') return res.status(400).json({ error: 'No se puede editar un pedido entregado' });

  const hayEtapasCompletadas = pedidoActual.prendas.some((p) => p.etapas.some((e) => e.completada));

  const datosBasicos = {
    nombre,
    apellido,
    apodo: apodo || null,
    colegio,
    numeroContrato,
    costoTotal: Number(costoTotal),
    sena: Number(sena),
    fechaEntregaComprometida: new Date(fechaEntregaComprometida),
    localTomoPedido,
  };

  let pedido;

  if (!hayEtapasCompletadas && prendas?.length) {
    await prisma.prenda.deleteMany({ where: { pedidoId: id } });
    pedido = await prisma.pedido.update({
      where: { id },
      data: {
        ...datosBasicos,
        prendas: {
          create: prendas.map((p) => {
            const tieneBordado = !!p.tieneBordado;
            const tieneEstampado = !!p.tieneEstampado;
            return {
              tipo: p.tipo,
              talle: p.talle,
              tieneBordado,
              tieneEstampado,
              etapas: { create: buildEtapas(tieneBordado, tieneEstampado) },
            };
          }),
        },
      },
      include: INCLUDE_PEDIDO,
    });
  } else {
    pedido = await prisma.pedido.update({
      where: { id },
      data: datosBasicos,
      include: INCLUDE_PEDIDO,
    });
  }

  await log({ usuarioId: req.user.id, accion: 'EDITAR_PEDIDO', entidad: 'Pedido', entidadId: id, pedidoId: id });
  res.json(pedido);
});
```

- [ ] **Step 2: Verificar manualmente con curl que el endpoint responde**

```bash
# Desde la raíz del proyecto, con el backend corriendo (npm run dev en /backend)
curl -s -X PUT http://localhost:3001/api/pedidos/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"nombre":"Test"}' | jq .
# Debe retornar error 400 "Faltan campos requeridos" (no 404 de ruta)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/pedidos.js
git commit -m "feat: endpoint PUT /api/pedidos/:id para editar pedido"
```

---

## Task 2: Backend — DELETE /api/pedidos/:id

**Files:**
- Modify: `backend/src/routes/pedidos.js`

- [ ] **Step 1: Agregar el endpoint DELETE /:id en pedidos.js, antes de `module.exports`**

```javascript
// DELETE /api/pedidos/:id
router.delete('/:id', requireRol('VENDEDOR', 'ADMINISTRADOR'), async (req, res) => {
  const id = Number(req.params.id);

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedido.estado === 'ENTREGADO') return res.status(400).json({ error: 'No se puede eliminar un pedido entregado' });

  await prisma.log.deleteMany({ where: { pedidoId: id } });
  await prisma.pedido.delete({ where: { id } });

  res.json({ ok: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/pedidos.js
git commit -m "feat: endpoint DELETE /api/pedidos/:id para eliminar pedido"
```

---

## Task 3: Backend — PUT /api/prendas/:id/etapas/:etapaNombre/revertir

**Files:**
- Modify: `backend/src/routes/prendas.js`

- [ ] **Step 1: Agregar el endpoint de revertir en prendas.js, antes de `module.exports`**

```javascript
// PUT /api/prendas/:id/etapas/:etapaNombre/revertir
router.put('/:id/etapas/:etapaNombre/revertir', requireRol('PRODUCCION', 'ADMINISTRADOR'), async (req, res) => {
  const prendaId = Number(req.params.id);
  const etapaNombre = req.params.etapaNombre;

  const prenda = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: {
      etapas: { orderBy: { orden: 'asc' } },
      pedido: true,
    },
  });

  if (!prenda) return res.status(404).json({ error: 'Prenda no encontrada' });
  if (prenda.pedido.estado !== 'EN_PRODUCCION') return res.status(400).json({ error: 'El pedido no está en producción' });

  const etapa = prenda.etapas.find((e) => e.nombre === etapaNombre);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada' });
  if (!etapa.completada) return res.status(400).json({ error: 'Esta etapa no está completada' });

  const etapasARevertir = prenda.etapas.filter((e) => e.orden >= etapa.orden);

  await prisma.etapaProduccion.updateMany({
    where: { id: { in: etapasARevertir.map((e) => e.id) } },
    data: { completada: false, fechaInicio: null, fechaFin: null, usuarioId: null },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'REVERTIR_ETAPA',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre} (y posteriores)`,
  });

  const prendaActualizada = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: {
      etapas: {
        orderBy: { orden: 'asc' },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
    },
  });

  res.json(prendaActualizada);
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/prendas.js
git commit -m "feat: endpoint PUT /api/prendas/:id/etapas/:nombre/revertir"
```

---

## Task 4: Frontend — Página EditarPedido.jsx

**Files:**
- Create: `frontend/src/pages/EditarPedido.jsx`

- [ ] **Step 1: Crear el archivo `frontend/src/pages/EditarPedido.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const LOCALES = ['PELLEGRINI', 'SUR', 'NORTE', 'FISHERTON', 'SANTA_FE', 'SAN_NICOLAS', 'FABRICA'];
const LOCAL_LABEL = { PELLEGRINI: 'Pellegrini', SUR: 'Sur', NORTE: 'Norte', FISHERTON: 'Fisherton', SANTA_FE: 'Santa Fe', SAN_NICOLAS: 'San Nicolás', FABRICA: 'Fábrica' };

const PRENDAS_TIPOS = [
  { key: 'remera', tipo: 'REMERA', label: 'Remera' },
  { key: 'chomba', tipo: 'CHOMBA', label: 'Chomba' },
  { key: 'campera', tipo: 'CAMPERA', label: 'Campera' },
  { key: 'buzo', tipo: 'BUZO', label: 'Buzo' },
];

const INIT_PRENDAS = {
  tieneRemera: false, talleRemera: '', bordadoRemera: false, sublimadoRemera: false,
  tieneChomba: false, talleChomba: '', bordadoChomba: false, sublimadoChomba: false,
  tieneCampera: false, talleCampera: '', bordadoCampera: false, sublimadoCampera: false,
  tieneBuzo: false, talleBuzo: '', bordadoBuzo: false, sublimadoBuzo: false,
};

function prendasToForm(prendas) {
  const result = { ...INIT_PRENDAS };
  for (const p of prendas) {
    const key = p.tipo.toLowerCase();
    const K = key.charAt(0).toUpperCase() + key.slice(1);
    result[`tiene${K}`] = true;
    result[`talle${K}`] = p.talle;
    result[`bordado${K}`] = p.tieneBordado;
    result[`sublimado${K}`] = p.tieneEstampado;
  }
  return result;
}

export default function EditarPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    if (!pedido) return;
    const hayEtapasCompletadas = pedido.prendas.some((p) => p.etapas.some((e) => e.completada));
    const fechaEntrega = pedido.fechaEntregaComprometida
      ? new Date(pedido.fechaEntregaComprometida).toISOString().split('T')[0]
      : '';
    setForm({
      nombre: pedido.nombre,
      apellido: pedido.apellido,
      apodo: pedido.apodo || '',
      colegio: pedido.colegio,
      numeroContrato: pedido.numeroContrato,
      costoTotal: pedido.costoTotal,
      sena: pedido.sena,
      fechaEntregaComprometida: fechaEntrega,
      localTomoPedido: pedido.localTomoPedido,
      hayEtapasCompletadas,
      ...(hayEtapasCompletadas ? {} : prendasToForm(pedido.prendas)),
    });
  }, [pedido]);

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/pedidos/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      navigate(`/pedidos/${id}`);
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      nombre: form.nombre,
      apellido: form.apellido,
      apodo: form.apodo || undefined,
      colegio: form.colegio,
      numeroContrato: form.numeroContrato,
      costoTotal: Number(form.costoTotal),
      sena: Number(form.sena),
      fechaEntregaComprometida: form.fechaEntregaComprometida,
      localTomoPedido: form.localTomoPedido,
    };

    if (!form.hayEtapasCompletadas) {
      const prendas = [];
      if (form.tieneRemera) prendas.push({ tipo: 'REMERA', talle: form.talleRemera, tieneBordado: form.bordadoRemera, tieneEstampado: form.sublimadoRemera });
      if (form.tieneChomba) prendas.push({ tipo: 'CHOMBA', talle: form.talleChomba, tieneBordado: form.bordadoChomba, tieneEstampado: form.sublimadoChomba });
      if (form.tieneCampera) prendas.push({ tipo: 'CAMPERA', talle: form.talleCampera, tieneBordado: form.bordadoCampera, tieneEstampado: form.sublimadoCampera });
      if (form.tieneBuzo) prendas.push({ tipo: 'BUZO', talle: form.talleBuzo, tieneBordado: form.bordadoBuzo, tieneEstampado: form.sublimadoBuzo });
      if (!prendas.length) return setError('Debe seleccionar al menos una prenda');
      payload.prendas = prendas;
    }

    mutation.mutate(payload);
  }

  if (isLoading || !form) return <div className="flex justify-center mt-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-4 block">← Volver</button>
      <h1 className="text-2xl font-bold text-white mb-6">Editar Pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos del cliente */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Datos del cliente</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input className="input" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Apodo (opcional)</label>
            <input className="input" value={form.apodo} onChange={(e) => set('apodo', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Colegio *</label>
              <input className="input" value={form.colegio} onChange={(e) => set('colegio', e.target.value)} required />
            </div>
            <div>
              <label className="label">N° de contrato *</label>
              <input className="input" value={form.numeroContrato} onChange={(e) => set('numeroContrato', e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Prendas */}
        {form.hayEtapasCompletadas ? (
          <div className="card">
            <h2 className="text-sm font-semibold text-brand uppercase tracking-wide mb-3">Prendas</h2>
            <p className="text-sm text-yellow-400">Las prendas no se pueden modificar porque ya hay etapas de producción completadas.</p>
            <div className="mt-3 space-y-1">
              {pedido.prendas.map((p) => (
                <p key={p.id} className="text-sm text-gray-300">{p.tipo} · Talle {p.talle}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Prendas</h2>
            <div className="space-y-3">
              {PRENDAS_TIPOS.map(({ key, label }) => {
                const K = key.charAt(0).toUpperCase() + key.slice(1);
                const tieneKey = `tiene${K}`;
                const talleKey = `talle${K}`;
                const bordadoKey = `bordado${K}`;
                const sublimadoKey = `sublimado${K}`;
                return (
                  <div key={key}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form[tieneKey]} onChange={(e) => set(tieneKey, e.target.checked)} className="w-4 h-4 accent-brand" />
                      <span className="text-gray-300">{label}</span>
                    </label>
                    {form[tieneKey] && (
                      <div className="ml-7 mt-2 space-y-3">
                        <div>
                          <label className="label">Talle *</label>
                          <input className="input max-w-xs" placeholder="Ej: M, XL, 42..." value={form[talleKey]} onChange={(e) => set(talleKey, e.target.value)} required />
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-brand" checked={form[bordadoKey]} onChange={(e) => set(bordadoKey, e.target.checked)} />
                            <span className="text-sm text-gray-300">Bordado</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-brand" checked={form[sublimadoKey]} onChange={(e) => set(sublimadoKey, e.target.checked)} />
                            <span className="text-sm text-gray-300">Sublimado</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Datos económicos */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Datos económicos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costo total *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.costoTotal} onChange={(e) => set('costoTotal', e.target.value)} required />
            </div>
            <div>
              <label className="label">Seña abonada *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.sena} onChange={(e) => set('sena', e.target.value)} required />
            </div>
          </div>
          {form.costoTotal && form.sena && (
            <p className="text-sm text-gray-400">
              Saldo restante: <span className="text-white font-semibold">${(Number(form.costoTotal) - Number(form.sena)).toLocaleString('es-AR')}</span>
            </p>
          )}
        </div>

        {/* Logística */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Logística</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Local donde se toma *</label>
              <select className="input" value={form.localTomoPedido} onChange={(e) => set('localTomoPedido', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha de entrega comprometida *</label>
              <input className="input" type="date" value={form.fechaEntregaComprometida} onChange={(e) => set('fechaEntregaComprometida', e.target.value)} required />
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EditarPedido.jsx
git commit -m "feat: página EditarPedido con edición completa o parcial según estado"
```

---

## Task 5: Frontend — Agregar ruta en App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Importar EditarPedido y agregar la ruta**

En `frontend/src/App.jsx`, agregar el import:
```jsx
import EditarPedido from './pages/EditarPedido';
```

Y dentro de `<Route path="/" element={...}>`, agregar después de la ruta de `pedidos/:id`:
```jsx
<Route path="pedidos/:id/editar" element={<PrivateRoute roles={['VENDEDOR', 'ADMINISTRADOR']}><EditarPedido /></PrivateRoute>} />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: ruta /pedidos/:id/editar"
```

---

## Task 6: Frontend — Botones Editar y Eliminar en DetallePedido

**Files:**
- Modify: `frontend/src/pages/DetallePedido.jsx`

- [ ] **Step 1: Agregar estado para modal de eliminación y mutation de eliminar**

Dentro de `DetallePedido()`, agregar junto a los otros estados:
```jsx
const [modalEliminar, setModalEliminar] = useState(false);
```

Agregar la mutation de eliminar junto a las otras mutations:
```jsx
const eliminar = useMutation({
  mutationFn: () => api.delete(`/pedidos/${id}`).then((r) => r.data),
  onSuccess: () => navigate('/historial'),
});
```

- [ ] **Step 2: Agregar botones Editar y Eliminar en el header del pedido**

En el header, dentro del `div` que contiene `<EstadoBadge>` y el botón de recibo, agregar:
```jsx
{(usuario?.rol === 'VENDEDOR' || usuario?.rol === 'ADMINISTRADOR') && pedido.estado !== 'ENTREGADO' && (
  <>
    <button onClick={() => navigate(`/pedidos/${id}/editar`)} className="btn-secondary text-sm py-1.5">✏️ Editar</button>
    <button onClick={() => setModalEliminar(true)} className="btn-danger text-sm py-1.5">🗑️ Eliminar</button>
  </>
)}
```

- [ ] **Step 3: Agregar modal de confirmación de eliminación**

Al final del JSX, antes del último `</div>` de cierre, agregar:
```jsx
{/* Modal Eliminar */}
<Modal open={modalEliminar} onClose={() => setModalEliminar(false)} title="Eliminar pedido" size="md">
  <p className="text-gray-400 text-sm mb-4">
    ¿Confirmás que querés eliminar el pedido de <span className="text-white font-semibold">{pedido.nombre} {pedido.apellido}</span>? Esta acción no se puede deshacer.
  </p>
  <div className="flex gap-3">
    <button onClick={() => eliminar.mutate()} disabled={eliminar.isPending} className="btn-danger">
      {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
    </button>
    <button onClick={() => setModalEliminar(false)} className="btn-secondary">Cancelar</button>
  </div>
  {eliminar.isError && <p className="text-red-400 text-sm mt-2">{eliminar.error?.response?.data?.error}</p>}
</Modal>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DetallePedido.jsx
git commit -m "feat: botones editar y eliminar pedido en DetallePedido"
```

---

## Task 7: Frontend — Botón Deshacer Etapa en DetallePedido

**Files:**
- Modify: `frontend/src/pages/DetallePedido.jsx`

- [ ] **Step 1: Agregar mutation de revertir etapa**

Junto a las otras mutations en `DetallePedido()`:
```jsx
const revertirEtapa = useMutation({
  mutationFn: ({ prendaId, etapa }) => api.put(`/prendas/${prendaId}/etapas/${etapa}/revertir`).then((r) => r.data),
  onSuccess: invalidate,
});
```

- [ ] **Step 2: Agregar botón Deshacer en etapas completadas**

En el mapa de etapas (`prenda.etapas.map`), el bloque completo de cada etapa queda así:

```jsx
{prenda.etapas.map((etapa, i) => {
  const esLaSiguiente = !etapa.completada && (i === 0 || prenda.etapas[i - 1]?.completada);
  const puedeDeshacer = etapa.completada && pedido.estado === 'EN_PRODUCCION' &&
    (usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'PRODUCCION');
  return (
    <div key={etapa.id} className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${etapa.completada ? 'bg-brand text-white' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
        {etapa.completada ? '✓' : ''}
      </div>
      <div className="flex-1">
        <span className={`text-sm ${etapa.completada ? 'text-gray-300' : 'text-gray-500'}`}>
          {ETAPA_LABEL[etapa.nombre]}
        </span>
        {etapa.completada && etapa.fechaFin && (
          <span className="text-xs text-gray-500 ml-2">
            {format(new Date(etapa.fechaFin), 'dd/MM/yyyy HH:mm')}
            {etapa.usuario && ` · ${etapa.usuario.nombre}`}
          </span>
        )}
      </div>
      {esLaSiguiente && esProduccion && pedido.estado === 'EN_PRODUCCION' && (
        <button
          onClick={() => avanzarEtapa.mutate({ prendaId: prenda.id, etapa: etapa.nombre })}
          disabled={avanzarEtapa.isPending}
          className="text-xs btn-primary py-1 px-2"
        >
          Completar
        </button>
      )}
      {puedeDeshacer && (
        <button
          onClick={() => revertirEtapa.mutate({ prendaId: prenda.id, etapa: etapa.nombre })}
          disabled={revertirEtapa.isPending}
          className="text-xs btn-secondary py-1 px-2"
        >
          Deshacer
        </button>
      )}
    </div>
  );
})}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DetallePedido.jsx
git commit -m "feat: botón deshacer etapa en DetallePedido para ADMIN y PRODUCCION"
```

---

## Task 8: Verificación manual completa

- [ ] Levantar backend (`cd backend && npm run dev`) y frontend (`cd frontend && npm run dev`)
- [ ] Ingresar como ADMINISTRADOR y abrir un pedido sin etapas completadas → verificar que aparecen botones Editar y Eliminar
- [ ] Editar ese pedido cambiando nombre y prendas → verificar que los cambios se guardan y redirige al detalle
- [ ] Crear un pedido, marcar una etapa como completada, luego ir a editar → verificar que la sección de prendas aparece en modo solo lectura
- [ ] Eliminar un pedido → verificar modal de confirmación y redirección a historial
- [ ] Ingresar como PRODUCCION y marcar una etapa como completada → verificar que aparece el botón Deshacer
- [ ] Deshacer esa etapa → verificar que esa etapa y las posteriores vuelven a pendiente
- [ ] Ingresar como VENDEDOR → verificar que NO aparece el botón Deshacer en las etapas
- [ ] Verificar que en pedidos ENTREGADOS no aparecen los botones Editar ni Eliminar
