# Cuenta Corriente + DTF/ESTAMPADO + Validación Bordado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar cuenta corriente de pagos por pedido con recibos individuales, renombrar "Sublimado" a "DTF/ESTAMPADO", y hacer obligatoria la selección de Bordado o DTF/ESTAMPADO al cargar una prenda.

**Architecture:** Se agrega un modelo `Pago` en Prisma ligado a `Pedido`. La seña existente se migra como primer pago con script one-shot. El backend expone 3 endpoints nuevos bajo `/api/pedidos/:id/pagos`. El frontend agrega una sección `CuentaCorriente` en `DetallePedido` con tabla de pagos, modal para registrar, y recibo imprimible por pago.

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (backend) · React + Vite + React Query + Tailwind (frontend)

---

## Archivos a crear o modificar

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Modify | `backend/prisma/schema.prisma` | Agregar modelo `Pago` |
| Create | `backend/prisma/seed-pagos.js` | Script one-shot: migrar `sena` como primer `Pago` |
| Modify | `backend/src/routes/pedidos.js` | Endpoints GET/POST/DELETE pagos + crear pago al crear pedido |
| Create | `frontend/src/components/ReciboPago.jsx` | Recibo imprimible para un pago individual |
| Create | `frontend/src/components/CuentaCorriente.jsx` | Sección completa de pagos (tabla + modal + resumen) |
| Modify | `frontend/src/pages/DetallePedido.jsx` | Integrar CuentaCorriente, actualizar badge "Sublimado" |
| Modify | `frontend/src/pages/NuevoPedido.jsx` | Renombrar "Sublimado" → "DTF/ESTAMPADO" + validación obligatoria |
| Modify | `frontend/src/pages/EditarPedido.jsx` | Renombrar "Sublimado" → "DTF/ESTAMPADO" + validación obligatoria |

---

### Task 1: Agregar modelo Pago al schema de Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Agregar relación `pagos` al modelo `Pedido` y `pagosRegistrados` a `Usuario`**

En `backend/prisma/schema.prisma`, agregar dentro del modelo `Pedido` (después de `logs Log[]`):
```prisma
  pagos  Pago[]
```

Agregar dentro del modelo `Usuario` (después de `logs Log[]`):
```prisma
  pagosRegistrados Pago[]
```

- [ ] **Step 2: Agregar el modelo `Pago` al final del archivo (antes del cierre)**

```prisma
model Pago {
  id          Int      @id @default(autoincrement())
  pedidoId    Int
  pedido      Pedido   @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  monto       Float
  fecha       DateTime @default(now())
  notas       String?
  creadoPorId Int
  creadoPor   Usuario  @relation(fields: [creadoPorId], references: [id])
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 3: Correr la migración de Prisma**

```bash
cd backend
npx prisma migrate dev --name add_pago_model
```

Expected: migración exitosa, tabla `Pago` creada en la base de datos.

- [ ] **Step 4: Regenerar el cliente de Prisma**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: agregar modelo Pago al schema de Prisma"
```

---

### Task 2: Script de migración de datos (seña → primer Pago)

**Files:**
- Create: `backend/prisma/seed-pagos.js`

- [ ] **Step 1: Crear el script**

Crear `backend/prisma/seed-pagos.js`:

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pedidos = await prisma.pedido.findMany({
    select: { id: true, sena: true, fechaIngreso: true, creadorId: true },
  });

  let creados = 0;
  for (const pedido of pedidos) {
    const existente = await prisma.pago.findFirst({
      where: { pedidoId: pedido.id, notas: 'Seña inicial' },
    });
    if (!existente && pedido.sena > 0) {
      await prisma.pago.create({
        data: {
          pedidoId: pedido.id,
          monto: pedido.sena,
          fecha: pedido.fechaIngreso,
          notas: 'Seña inicial',
          creadoPorId: pedido.creadorId,
        },
      });
      creados++;
    }
  }
  console.log(`Migrados ${creados} pagos de seña de ${pedidos.length} pedidos.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ejecutar el script**

```bash
cd backend
node prisma/seed-pagos.js
```

Expected: `Migrados N pagos de seña de N pedidos.`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed-pagos.js
git commit -m "feat: script de migración de seña a primer Pago"
```

---

### Task 3: Endpoints de pagos en el backend

**Files:**
- Modify: `backend/src/routes/pedidos.js`

- [ ] **Step 1: Agregar el pago de seña al crear un pedido**

En `backend/src/routes/pedidos.js`, dentro del `router.post('/', ...)`, después de que se crea el pedido (la línea `const pedido = await prisma.pedido.create(...)`) y antes del `await log(...)`, agregar:

```js
  await prisma.pago.create({
    data: {
      pedidoId: pedido.id,
      monto: Number(sena),
      notas: 'Seña inicial',
      creadoPorId: req.user.id,
    },
  });
```

- [ ] **Step 2: Agregar endpoint GET /api/pedidos/:id/pagos**

Agregar antes de `// DELETE /api/pedidos/:id` en `backend/src/routes/pedidos.js`:

```js
// GET /api/pedidos/:id/pagos
router.get('/:id/pagos', async (req, res) => {
  const id = Number(req.params.id);
  const pedido = await prisma.pedido.findUnique({ where: { id }, select: { costoTotal: true } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  const pagos = await prisma.pago.findMany({
    where: { pedidoId: id },
    orderBy: { fecha: 'asc' },
    include: { creadoPor: { select: { id: true, nombre: true } } },
  });

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);
  const deudaRestante = pedido.costoTotal - totalPagado;

  res.json({ pagos, costoTotal: pedido.costoTotal, totalPagado, deudaRestante, saldado: deudaRestante <= 0 });
});
```

- [ ] **Step 3: Agregar endpoint POST /api/pedidos/:id/pagos**

Agregar después del GET de pagos:

```js
// POST /api/pedidos/:id/pagos
router.post('/:id/pagos', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);
  const { monto, fecha, notas } = req.body;

  if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'Monto inválido' });

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  const pago = await prisma.pago.create({
    data: {
      pedidoId: id,
      monto: Number(monto),
      fecha: fecha ? new Date(fecha) : new Date(),
      notas: notas || null,
      creadoPorId: req.user.id,
    },
    include: { creadoPor: { select: { id: true, nombre: true } } },
  });

  await log({ usuarioId: req.user.id, accion: 'REGISTRAR_PAGO', entidad: 'Pago', entidadId: pago.id, pedidoId: id, detalle: `$${monto}` });
  res.status(201).json(pago);
});
```

- [ ] **Step 4: Agregar endpoint DELETE /api/pedidos/:id/pagos/:pagoId**

Agregar después del POST de pagos:

```js
// DELETE /api/pedidos/:id/pagos/:pagoId
router.delete('/:id/pagos/:pagoId', requireRol('ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const pagoId = Number(req.params.pagoId);
  const pedidoId = Number(req.params.id);

  const pago = await prisma.pago.findUnique({ where: { id: pagoId } });
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

  await prisma.pago.delete({ where: { id: pagoId } });
  await log({ usuarioId: req.user.id, accion: 'ELIMINAR_PAGO', entidad: 'Pago', entidadId: pagoId, pedidoId, detalle: `$${pago.monto}` });
  res.json({ ok: true });
});
```

- [ ] **Step 5: Verificar manualmente que los endpoints responden**

Levantar el backend: `cd backend && npm run dev`

Probar con curl o el navegador:
- `GET /api/pedidos/1/pagos` → debe retornar `{ pagos: [...], costoTotal, totalPagado, deudaRestante, saldado }`
- `POST /api/pedidos/1/pagos` con body `{ "monto": 1000 }` → debe crear un pago
- `DELETE /api/pedidos/1/pagos/1` → debe eliminar el pago

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/pedidos.js
git commit -m "feat: endpoints GET/POST/DELETE de pagos por pedido"
```

---

### Task 4: Componente ReciboPago (recibo por pago individual)

**Files:**
- Create: `frontend/src/components/ReciboPago.jsx`

- [ ] **Step 1: Crear el componente**

Crear `frontend/src/components/ReciboPago.jsx`:

```jsx
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };

export default function ReciboPago({ pedido, pago, resumen }) {
  const prendas = pedido.prendas || [];

  return (
    <div className="print-only bg-white text-black p-8 rounded-xl border border-gray-200 font-sans max-w-md mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
        <img src="https://i.imgur.com/M4GONM5.png" alt="InCollege" width="48" height="48" style={{ borderRadius: '10px', objectFit: 'contain' }} />
        <div>
          <p className="text-xl font-bold text-gray-900">InCollege</p>
          <p className="text-sm text-gray-500">Local {LOCAL_LABEL[pedido.localTomoPedido]}</p>
        </div>
      </div>

      <h2 className="text-base font-bold text-gray-700 mb-4 uppercase tracking-wide">Comprobante de pago</h2>

      <table className="w-full text-sm mb-4">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500 w-1/2">Nombre</td>
            <td className="py-1.5 font-medium">{pedido.nombre} {pedido.apellido}</td>
          </tr>
          {pedido.apodo && (
            <tr className="border-b border-gray-100">
              <td className="py-1.5 text-gray-500">Apodo</td>
              <td className="py-1.5 font-medium">"{pedido.apodo}"</td>
            </tr>
          )}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Colegio</td>
            <td className="py-1.5 font-medium">{pedido.colegio}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">N° Contrato</td>
            <td className="py-1.5 font-medium">{pedido.numeroContrato}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Prendas</td>
            <td className="py-1.5 font-medium">
              {prendas.map((p) => `${p.tipo} T:${p.talle}`).join(' · ')}
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Fecha de pago</td>
            <td className="py-1.5 font-medium">
              {format(new Date(pago.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </td>
          </tr>
          {pago.notas && (
            <tr className="border-b border-gray-100">
              <td className="py-1.5 text-gray-500">Notas</td>
              <td className="py-1.5 font-medium">{pago.notas}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Costo total</span>
          <span className="font-semibold">${resumen.costoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
          <span className="text-gray-500 font-bold">Monto abonado este pago</span>
          <span className="font-bold text-green-700">+${pago.monto.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total pagado hasta ahora</span>
          <span className="font-semibold">${resumen.totalPagado.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-base border-t border-gray-200 pt-2 mt-2">
          <span className="font-bold">{resumen.saldado ? 'PAGADO EN SU TOTALIDAD' : 'Saldo restante'}</span>
          <span className={`font-bold ${resumen.saldado ? 'text-green-700' : 'text-gray-900'}`}>
            {resumen.saldado ? '✓' : `$${resumen.deudaRestante.toLocaleString('es-AR')}`}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
        Este comprobante no tiene validez fiscal · Conservarlo hasta retirar el pedido
      </p>
      <p className="text-xs text-gray-300 text-center mt-1">
        Emitido: {format(new Date(), "dd/MM/yyyy HH:mm")}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ReciboPago.jsx
git commit -m "feat: componente ReciboPago para recibos de pagos individuales"
```

---

### Task 5: Componente CuentaCorriente

**Files:**
- Create: `frontend/src/components/CuentaCorriente.jsx`

- [ ] **Step 1: Crear el componente**

Crear `frontend/src/components/CuentaCorriente.jsx`:

```jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import ReciboPago from './ReciboPago';

export default function CuentaCorriente({ pedido }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [modalPago, setModalPago] = useState(false);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [errorPago, setErrorPago] = useState('');
  const [reciboVisible, setReciboVisible] = useState(null); // pagoId

  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'GERENTE';
  const puedeRegistrar = ['VENDEDOR', 'ADMINISTRADOR', 'GERENTE'].includes(usuario?.rol);

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['pagos', pedido.id],
    queryFn: () => api.get(`/pedidos/${pedido.id}/pagos`).then((r) => r.data),
  });

  const registrarPago = useMutation({
    mutationFn: (data) => api.post(`/pedidos/${pedido.id}/pagos`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagos', pedido.id] });
      setModalPago(false);
      setMonto('');
      setFecha(new Date().toISOString().split('T')[0]);
      setNotas('');
      setErrorPago('');
    },
    onError: (err) => setErrorPago(err.response?.data?.error || 'Error al registrar pago'),
  });

  const eliminarPago = useMutation({
    mutationFn: (pagoId) => api.delete(`/pedidos/${pedido.id}/pagos/${pagoId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagos', pedido.id] }),
  });

  function handleRegistrar(e) {
    e.preventDefault();
    setErrorPago('');
    if (!monto || Number(monto) <= 0) return setErrorPago('El monto debe ser mayor a cero');
    registrarPago.mutate({ monto: Number(monto), fecha, notas: notas || undefined });
  }

  if (isLoading) return null;

  const pagoConRecibo = reciboVisible ? resumen.pagos.find((p) => p.id === reciboVisible) : null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Cuenta corriente</h2>
        {puedeRegistrar && (
          <button onClick={() => setModalPago(true)} className="btn-primary text-xs py-1.5 px-3">
            + Registrar pago
          </button>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Costo total</span>
          <span className="text-white font-medium">${resumen.costoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total pagado</span>
          <span className="text-green-400 font-medium">${resumen.totalPagado.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-base border-t border-gray-700 pt-2 mt-1">
          <span className="font-bold text-white">
            {resumen.saldado ? 'Estado' : 'Saldo restante'}
          </span>
          {resumen.saldado ? (
            <span className="font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-sm">
              ✓ Pagado en su totalidad
            </span>
          ) : (
            <span className="font-bold text-yellow-400">${resumen.deudaRestante.toLocaleString('es-AR')}</span>
          )}
        </div>
      </div>

      {/* Tabla de pagos */}
      {resumen.pagos.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin pagos registrados</p>
      ) : (
        <div className="space-y-2">
          {resumen.pagos.map((pago) => (
            <div key={pago.id} className="flex items-center gap-3 text-sm border-b border-gray-800 pb-2 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">${pago.monto.toLocaleString('es-AR')}</span>
                  {pago.notas && <span className="text-gray-500">· {pago.notas}</span>}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {format(new Date(pago.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  {pago.creadoPor && ` · ${pago.creadoPor.nombre}`}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setReciboVisible(pago.id)}
                  className="text-xs btn-secondary py-1 px-2"
                >
                  🖨️ Recibo
                </button>
                {esAdmin && (
                  <button
                    onClick={() => eliminarPago.mutate(pago.id)}
                    disabled={eliminarPago.isPending}
                    className="text-xs btn-danger py-1 px-2"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal registrar pago */}
      <Modal open={modalPago} onClose={() => { setModalPago(false); setErrorPago(''); }} title="Registrar pago">
        <form onSubmit={handleRegistrar} className="space-y-4">
          <div>
            <label className="label">Monto *</label>
            <input
              className="input"
              type="number"
              min="1"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input
              className="input"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Pago parcial, transferencia..."
            />
          </div>
          {errorPago && <p className="text-red-400 text-sm">{errorPago}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={registrarPago.isPending}>
              {registrarPago.isPending ? 'Guardando...' : 'Registrar'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setModalPago(false); setErrorPago(''); }}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Recibo de pago individual */}
      {pagoConRecibo && (
        <Modal open={true} onClose={() => setReciboVisible(null)} title="Recibo de pago" size="lg">
          <ReciboPago pedido={pedido} pago={pagoConRecibo} resumen={resumen} />
          <button onClick={() => window.print()} className="btn-primary mt-3 no-print">Imprimir</button>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CuentaCorriente.jsx
git commit -m "feat: componente CuentaCorriente con historial de pagos y modal"
```

---

### Task 6: Integrar CuentaCorriente en DetallePedido + actualizar badge Sublimado

**Files:**
- Modify: `frontend/src/pages/DetallePedido.jsx`

- [ ] **Step 1: Importar CuentaCorriente**

En `frontend/src/pages/DetallePedido.jsx`, agregar el import después de `import Recibo from '../components/Recibo';`:

```jsx
import CuentaCorriente from '../components/CuentaCorriente';
```

- [ ] **Step 2: Insertar la sección CuentaCorriente después de la sección de datos (la card del grid)**

Después del bloque `{/* Prendas + Etapas */}` y antes de `{/* Acciones */}`, agregar:

```jsx
      {/* Cuenta corriente */}
      <CuentaCorriente pedido={pedido} />
```

- [ ] **Step 3: Cambiar badge "Sublimado" por "DTF/ESTAMPADO"**

En `DetallePedido.jsx`, cambiar la línea:
```jsx
              {prenda.tieneEstampado && <span className="ml-2 text-xs badge bg-orange-500/15 text-orange-400">Sublimado</span>}
```
por:
```jsx
              {prenda.tieneEstampado && <span className="ml-2 text-xs badge bg-orange-500/15 text-orange-400">DTF/ESTAMPADO</span>}
```

- [ ] **Step 4: Cambiar badge "Sublimado" en el modal de aprobación**

En el mismo archivo, en el modal de aprobación, cambiar:
```jsx
              {p.tieneEstampado && <span className="badge bg-orange-500/15 text-orange-400">Sublimado</span>}
```
por:
```jsx
              {p.tieneEstampado && <span className="badge bg-orange-500/15 text-orange-400">DTF/ESTAMPADO</span>}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DetallePedido.jsx
git commit -m "feat: integrar CuentaCorriente en DetallePedido + renombrar Sublimado a DTF/ESTAMPADO"
```

---

### Task 7: Renombrar "Sublimado" → "DTF/ESTAMPADO" y validación obligatoria en NuevoPedido

**Files:**
- Modify: `frontend/src/pages/NuevoPedido.jsx`

- [ ] **Step 1: Cambiar el label "Sublimado" → "DTF/ESTAMPADO"**

En `frontend/src/pages/NuevoPedido.jsx`, cambiar la línea (línea 153):
```jsx
                          <span className="text-sm text-gray-300">Sublimado</span>
```
por:
```jsx
                          <span className="text-sm text-gray-300">DTF/ESTAMPADO</span>
```

- [ ] **Step 2: Agregar validación obligatoria de bordado o DTF/ESTAMPADO**

En `handleSubmit`, después del bloque que construye el array `prendas` y antes del `if (!prendas.length)`, agregar:

```js
    const prendaSinTecnica = prendas.find((p) => !p.tieneBordado && !p.tieneEstampado);
    if (prendaSinTecnica) {
      return setError(`La prenda ${prendaSinTecnica.tipo} debe tener Bordado o DTF/ESTAMPADO seleccionado`);
    }
```

El bloque `handleSubmit` completo queda así:
```js
  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const prendas = [];
    if (form.tieneRemera) prendas.push({ tipo: 'REMERA', talle: form.talleRemera, tieneBordado: form.bordadoRemera, tieneEstampado: form.sublimadoRemera });
    if (form.tieneChomba) prendas.push({ tipo: 'CHOMBA', talle: form.talleChomba, tieneBordado: form.bordadoChomba, tieneEstampado: form.sublimadoChomba });
    if (form.tieneCampera) prendas.push({ tipo: 'CAMPERA', talle: form.talleCampera, tieneBordado: form.bordadoCampera, tieneEstampado: form.sublimadoCampera });
    if (form.tieneBuzo) prendas.push({ tipo: 'BUZO', talle: form.talleBuzo, tieneBordado: form.bordadoBuzo, tieneEstampado: form.sublimadoBuzo });
    if (!prendas.length) {
      return setError('Debe seleccionar al menos una prenda');
    }
    const prendaSinTecnica = prendas.find((p) => !p.tieneBordado && !p.tieneEstampado);
    if (prendaSinTecnica) {
      return setError(`La prenda ${prendaSinTecnica.tipo} debe tener Bordado o DTF/ESTAMPADO seleccionado`);
    }
    mutation.mutate({
      nombre: form.nombre,
      apellido: form.apellido,
      apodo: form.apodo || undefined,
      colegio: form.colegio,
      numeroContrato: form.numeroContrato,
      costoTotal: Number(form.costoTotal),
      sena: Number(form.sena),
      fechaEntregaComprometida: form.fechaEntregaComprometida,
      localTomoPedido: form.localTomoPedido,
      prendas,
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/NuevoPedido.jsx
git commit -m "feat: renombrar Sublimado a DTF/ESTAMPADO y validación obligatoria en NuevoPedido"
```

---

### Task 8: Renombrar "Sublimado" → "DTF/ESTAMPADO" y validación obligatoria en EditarPedido

**Files:**
- Modify: `frontend/src/pages/EditarPedido.jsx`

- [ ] **Step 1: Buscar y cambiar el label "Sublimado" → "DTF/ESTAMPADO"**

En `frontend/src/pages/EditarPedido.jsx`, buscar la línea que dice `Sublimado` y cambiarla por `DTF/ESTAMPADO`. La línea debería verse así antes del cambio:
```jsx
                          <span className="text-sm text-gray-300">Sublimado</span>
```
Cambiar por:
```jsx
                          <span className="text-sm text-gray-300">DTF/ESTAMPADO</span>
```

- [ ] **Step 2: Agregar validación obligatoria de bordado o DTF/ESTAMPADO**

En `handleSubmit` de `EditarPedido.jsx`, dentro del bloque `if (!form.hayEtapasCompletadas)`, después de `if (!prendas.length) return setError(...)` y antes de `payload.prendas = prendas`, agregar:

```js
      const prendaSinTecnica = prendas.find((p) => !p.tieneBordado && !p.tieneEstampado);
      if (prendaSinTecnica) {
        return setError(`La prenda ${prendaSinTecnica.tipo} debe tener Bordado o DTF/ESTAMPADO seleccionado`);
      }
```

El bloque completo queda:
```js
    if (!form.hayEtapasCompletadas) {
      const prendas = [];
      if (form.tieneRemera) prendas.push({ tipo: 'REMERA', talle: form.talleRemera, tieneBordado: form.bordadoRemera, tieneEstampado: form.sublimadoRemera });
      if (form.tieneChomba) prendas.push({ tipo: 'CHOMBA', talle: form.talleChomba, tieneBordado: form.bordadoChomba, tieneEstampado: form.sublimadoChomba });
      if (form.tieneCampera) prendas.push({ tipo: 'CAMPERA', talle: form.talleCampera, tieneBordado: form.bordadoCampera, tieneEstampado: form.sublimadoCampera });
      if (form.tieneBuzo) prendas.push({ tipo: 'BUZO', talle: form.talleBuzo, tieneBordado: form.bordadoBuzo, tieneEstampado: form.sublimadoBuzo });
      if (!prendas.length) return setError('Debe seleccionar al menos una prenda');
      const prendaSinTecnica = prendas.find((p) => !p.tieneBordado && !p.tieneEstampado);
      if (prendaSinTecnica) {
        return setError(`La prenda ${prendaSinTecnica.tipo} debe tener Bordado o DTF/ESTAMPADO seleccionado`);
      }
      payload.prendas = prendas;
    }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/EditarPedido.jsx
git commit -m "feat: renombrar Sublimado a DTF/ESTAMPADO y validación obligatoria en EditarPedido"
```

---

## Orden de ejecución

1. Task 1 → Task 2 → Task 3 (backend primero, en orden)
2. Task 4 → Task 5 (componentes frontend, pueden hacerse en paralelo)
3. Task 6 → Task 7 → Task 8 (integración y cambios en páginas)
