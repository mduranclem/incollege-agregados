const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRol } = require('../middleware/auth');
const { log } = require('../services/logger');
const { notificarNuevoPedido } = require('../services/email');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

const INCLUDE_PEDIDO = {
  creador: { select: { id: true, nombre: true, email: true, rol: true } },
  prendas: {
    include: {
      etapas: {
        orderBy: { orden: 'asc' },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
    },
  },
  logs: {
    orderBy: { createdAt: 'desc' },
    include: { usuario: { select: { id: true, nombre: true, rol: true } } },
  },
};

function buildEtapas(tieneBordado, tieneEstampado) {
  const etapas = ['CORTE', 'UNION'];
  if (tieneBordado) etapas.push('BORDADO');
  if (tieneEstampado) etapas.push('ESTAMPADO');
  etapas.push('CONFECCION', 'TERMINADO', 'ENTREGA_A_LOCAL');
  return etapas.map((nombre, i) => ({ nombre, orden: i + 1 }));
}

// GET /api/pedidos/dashboard
router.get('/dashboard', async (req, res) => {
  const [tomados, enProduccion, terminados, entregados, proximos] = await Promise.all([
    prisma.pedido.count(),
    prisma.pedido.count({ where: { estado: 'EN_PRODUCCION' } }),
    prisma.pedido.count({ where: { estado: { in: ['TERMINADO', 'RECIBIDO_EN_LOCAL'] } } }),
    prisma.pedido.count({ where: { estado: 'ENTREGADO' } }),
    prisma.pedido.findMany({
      where: {
        estado: { in: ['PENDIENTE_APROBACION', 'EN_PRODUCCION'] },
        fechaEntregaComprometida: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { fechaEntregaComprometida: 'asc' },
      take: 10,
      select: { id: true, nombre: true, apellido: true, colegio: true, fechaEntregaComprometida: true, estado: true, localTomoPedido: true },
    }),
  ]);

  // Pedidos por mes (últimos 12 meses) — raw para agrupar por mes/año
  const pedidosPorMes = await prisma.$queryRaw`
    SELECT TO_CHAR("fechaIngreso", 'YYYY-MM') AS mes, COUNT(*)::int AS total
    FROM "Pedido"
    WHERE "fechaIngreso" >= NOW() - INTERVAL '12 months'
    GROUP BY mes
    ORDER BY mes ASC
  `;

  res.json({ tomados, enProduccion, terminados, entregados, proximos, pedidosPorMes });
});

// GET /api/pedidos
router.get('/', async (req, res) => {
  const { estado, local, colegio, busqueda, page = 1, limit = 50 } = req.query;
  const where = {};

  if (estado) {
    const estados = estado.split(',');
    where.estado = { in: estados };
  }
  if (local) where.localTomoPedido = local;
  if (colegio) where.colegio = { contains: colegio, mode: 'insensitive' };
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { apellido: { contains: busqueda, mode: 'insensitive' } },
      { apodo: { contains: busqueda, mode: 'insensitive' } },
      { numeroContrato: { contains: busqueda, mode: 'insensitive' } },
    ];
  }

  const [pedidos, total] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: {
        creador: { select: { id: true, nombre: true } },
        prendas: { include: { etapas: { orderBy: { orden: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.pedido.count({ where }),
  ]);

  res.json({ pedidos, total, page: Number(page), limit: Number(limit) });
});

// GET /api/pedidos/:id
router.get('/:id', async (req, res) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id: Number(req.params.id) },
    include: INCLUDE_PEDIDO,
  });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
});

// POST /api/pedidos
router.post('/', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const { nombre, apellido, apodo, colegio, numeroContrato, costoTotal, sena, fechaEntregaComprometida, localTomoPedido, prendas } = req.body;

  if (!nombre || !apellido || !colegio || !numeroContrato || !costoTotal || !sena || !fechaEntregaComprometida || !localTomoPedido || !prendas?.length) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const pedido = await prisma.pedido.create({
    data: {
      nombre,
      apellido,
      apodo: apodo || null,
      colegio,
      numeroContrato,
      costoTotal: Number(costoTotal),
      sena: Number(sena),
      fechaEntregaComprometida: new Date(fechaEntregaComprometida),
      localTomoPedido,
      estado: 'EN_PRODUCCION',
      creadorId: req.user.id,
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

  await prisma.pago.create({
    data: {
      pedidoId: pedido.id,
      monto: Number(sena),
      notas: 'Seña inicial',
      creadoPorId: req.user.id,
    },
  });

  await log({ usuarioId: req.user.id, accion: 'CREAR_PEDIDO', entidad: 'Pedido', entidadId: pedido.id, pedidoId: pedido.id, detalle: `${nombre} ${apellido} - ${colegio}` });

  notificarNuevoPedido(pedido).catch(console.error);

  res.status(201).json(pedido);
});

// PUT /api/pedidos/:id/aprobar
router.put('/:id/aprobar', requireRol('ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);

  const pedidoActual = await prisma.pedido.findUnique({ where: { id } });
  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedidoActual.estado !== 'PENDIENTE_APROBACION') return res.status(400).json({ error: 'Solo se pueden aprobar pedidos pendientes' });

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { estado: 'EN_PRODUCCION' },
    include: INCLUDE_PEDIDO,
  });

  await log({ usuarioId: req.user.id, accion: 'APROBAR_PEDIDO', entidad: 'Pedido', entidadId: id, pedidoId: id });
  res.json(pedido);
});

// PUT /api/pedidos/:id/rechazar
router.put('/:id/rechazar', requireRol('ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);
  const { motivo } = req.body;
  if (!motivo) return res.status(400).json({ error: 'Se requiere un motivo de rechazo' });

  const pedidoActual = await prisma.pedido.findUnique({ where: { id } });
  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedidoActual.estado !== 'PENDIENTE_APROBACION') return res.status(400).json({ error: 'Solo se pueden rechazar pedidos pendientes' });

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { estado: 'RECHAZADO', motivoRechazo: motivo },
    include: INCLUDE_PEDIDO,
  });

  await log({ usuarioId: req.user.id, accion: 'RECHAZAR_PEDIDO', entidad: 'Pedido', entidadId: id, pedidoId: id, detalle: motivo });
  res.json(pedido);
});

// PUT /api/pedidos/:id/asignar-local
router.put('/:id/asignar-local', requireRol('ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);
  const { local } = req.body;
  if (!local) return res.status(400).json({ error: 'Local requerido' });

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { localEntregaAsignado: local },
    include: INCLUDE_PEDIDO,
  });

  await log({ usuarioId: req.user.id, accion: 'ASIGNAR_LOCAL', entidad: 'Pedido', entidadId: id, pedidoId: id, detalle: local });
  res.json(pedido);
});

// PUT /api/pedidos/:id/recibido
router.put('/:id/recibido', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);
  const pedidoActual = await prisma.pedido.findUnique({ where: { id } });
  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedidoActual.estado !== 'TERMINADO') return res.status(400).json({ error: 'Solo pedidos terminados pueden marcarse como recibidos' });

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { estado: 'RECIBIDO_EN_LOCAL' },
    include: INCLUDE_PEDIDO,
  });

  await log({ usuarioId: req.user.id, accion: 'RECIBIDO_EN_LOCAL', entidad: 'Pedido', entidadId: id, pedidoId: id });
  res.json(pedido);
});

// PUT /api/pedidos/:id/entregado
router.put('/:id/entregado', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);
  const pedidoActual = await prisma.pedido.findUnique({ where: { id } });
  if (!pedidoActual) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedidoActual.estado !== 'RECIBIDO_EN_LOCAL') return res.status(400).json({ error: 'El pedido debe estar recibido en local primero' });

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { estado: 'ENTREGADO' },
    include: INCLUDE_PEDIDO,
  });

  await log({ usuarioId: req.user.id, accion: 'ENTREGADO_CLIENTE', entidad: 'Pedido', entidadId: id, pedidoId: id });
  res.json(pedido);
});

// PUT /api/pedidos/:id
router.put('/:id', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
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

// DELETE /api/pedidos/:id
router.delete('/:id', requireRol('VENDEDOR', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const id = Number(req.params.id);

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (pedido.estado === 'ENTREGADO') return res.status(400).json({ error: 'No se puede eliminar un pedido entregado' });

  await prisma.log.deleteMany({ where: { pedidoId: id } });
  await prisma.pedido.delete({ where: { id } });

  res.json({ ok: true });
});

module.exports = router;
