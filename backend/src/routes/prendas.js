const express = require('express');
const { authenticate, requireRol } = require('../middleware/auth');
const { log } = require('../services/logger');
const prisma = require('../lib/prisma');

const router = express.Router();

router.use(authenticate);

// PUT /api/prendas/:id/etapas/:etapaNombre
router.put('/:id/etapas/:etapaNombre', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
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
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada para esta prenda' });
  if (etapa.completada) return res.status(400).json({ error: 'Esta etapa ya fue completada' });

  // Verificar que la etapa anterior esté completada
  const etapasOrdenadas = prenda.etapas.sort((a, b) => a.orden - b.orden);
  const idx = etapasOrdenadas.findIndex((e) => e.nombre === etapaNombre);
  if (idx > 0 && !etapasOrdenadas[idx - 1].completada) {
    return res.status(400).json({ error: 'Debes completar la etapa anterior primero' });
  }

  const { taller } = req.body;

  const now = new Date();
  await prisma.etapaProduccion.update({
    where: { id: etapa.id },
    data: {
      completada: true,
      fechaInicio: etapa.fechaInicio || now,
      fechaFin: now,
      usuarioId: req.user.id,
      taller: taller || null,
    },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'COMPLETAR_ETAPA',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre}${taller ? ` - Taller: ${taller}` : ''}`,
  });

  // Si la etapa es ENTREGA_A_LOCAL, verificar si todas las prendas del pedido la completaron
  if (etapaNombre === 'ENTREGA_A_LOCAL') {
    const todasPrendas = await prisma.prenda.findMany({
      where: { pedidoId: prenda.pedidoId },
      include: { etapas: true },
    });

    const todasCompletas = todasPrendas.every((p) =>
      p.etapas.some((e) => e.nombre === 'ENTREGA_A_LOCAL' && e.completada)
    );

    if (todasCompletas) {
      await prisma.pedido.update({
        where: { id: prenda.pedidoId },
        data: { estado: 'TERMINADO' },
      });
      await log({
        usuarioId: req.user.id,
        accion: 'PEDIDO_TERMINADO_AUTO',
        entidad: 'Pedido',
        entidadId: prenda.pedidoId,
        pedidoId: prenda.pedidoId,
        detalle: 'Todas las prendas completaron ENTREGA_A_LOCAL',
      });
    }
  }

  // Retornar prenda actualizada
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

// PUT /api/prendas/:id/etapas/:etapaNombre/se-va
router.put('/:id/etapas/:etapaNombre/se-va', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const prendaId = Number(req.params.id);
  const etapaNombre = req.params.etapaNombre;
  const { fecha, descripcion } = req.body;

  const prenda = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: { etapas: true, pedido: true },
  });

  if (!prenda) return res.status(404).json({ error: 'Prenda no encontrada' });
  if (prenda.pedido.estado !== 'EN_PRODUCCION') return res.status(400).json({ error: 'El pedido no está en producción' });

  const etapa = prenda.etapas.find((e) => e.nombre === etapaNombre);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada para esta prenda' });

  await prisma.etapaProduccion.update({
    where: { id: etapa.id },
    data: {
      fechaSalida: fecha ? new Date(fecha) : new Date(),
      descripcionSalida: descripcion || null,
    },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'ETAPA_SE_VA',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre}${descripcion ? ` - ${descripcion}` : ''}`,
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

// PUT /api/prendas/:id/etapas/:etapaNombre/llego
router.put('/:id/etapas/:etapaNombre/llego', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const prendaId = Number(req.params.id);
  const etapaNombre = req.params.etapaNombre;
  const { fecha, descripcion } = req.body;

  const prenda = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: { etapas: true, pedido: true },
  });

  if (!prenda) return res.status(404).json({ error: 'Prenda no encontrada' });
  if (prenda.pedido.estado !== 'EN_PRODUCCION') return res.status(400).json({ error: 'El pedido no está en producción' });

  const etapa = prenda.etapas.find((e) => e.nombre === etapaNombre);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada para esta prenda' });
  if (!etapa.fechaSalida) return res.status(400).json({ error: 'Primero debe registrarse la salida de la prenda' });

  await prisma.etapaProduccion.update({
    where: { id: etapa.id },
    data: {
      fechaLlegada: fecha ? new Date(fecha) : new Date(),
      descripcionLlegada: descripcion || null,
    },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'ETAPA_LLEGO',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre}${descripcion ? ` - ${descripcion}` : ''}`,
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

// PUT /api/prendas/:id/etapas/:etapaNombre/cancelar-salida
router.put('/:id/etapas/:etapaNombre/cancelar-salida', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const prendaId = Number(req.params.id);
  const etapaNombre = req.params.etapaNombre;

  const prenda = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: { etapas: true, pedido: true },
  });

  if (!prenda) return res.status(404).json({ error: 'Prenda no encontrada' });
  if (prenda.pedido.estado !== 'EN_PRODUCCION') return res.status(400).json({ error: 'El pedido no está en producción' });

  const etapa = prenda.etapas.find((e) => e.nombre === etapaNombre);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada para esta prenda' });
  if (!etapa.fechaSalida) return res.status(400).json({ error: 'Esta etapa no tiene una salida registrada' });
  if (etapa.fechaLlegada) return res.status(400).json({ error: 'No se puede cancelar la salida: ya se registró la llegada' });

  await prisma.etapaProduccion.update({
    where: { id: etapa.id },
    data: { fechaSalida: null, descripcionSalida: null },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'ETAPA_CANCELAR_SALIDA',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre}`,
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

// PUT /api/prendas/:id/etapas/:etapaNombre/cancelar-llegada
router.put('/:id/etapas/:etapaNombre/cancelar-llegada', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
  const prendaId = Number(req.params.id);
  const etapaNombre = req.params.etapaNombre;

  const prenda = await prisma.prenda.findUnique({
    where: { id: prendaId },
    include: { etapas: true, pedido: true },
  });

  if (!prenda) return res.status(404).json({ error: 'Prenda no encontrada' });
  if (prenda.pedido.estado !== 'EN_PRODUCCION') return res.status(400).json({ error: 'El pedido no está en producción' });

  const etapa = prenda.etapas.find((e) => e.nombre === etapaNombre);
  if (!etapa) return res.status(404).json({ error: 'Etapa no encontrada para esta prenda' });
  if (!etapa.fechaLlegada) return res.status(400).json({ error: 'Esta etapa no tiene una llegada registrada' });

  await prisma.etapaProduccion.update({
    where: { id: etapa.id },
    data: { fechaLlegada: null, descripcionLlegada: null },
  });

  await log({
    usuarioId: req.user.id,
    accion: 'ETAPA_CANCELAR_LLEGADA',
    entidad: 'EtapaProduccion',
    entidadId: etapa.id,
    pedidoId: prenda.pedido.id,
    detalle: `Prenda ${prenda.tipo} - Etapa ${etapaNombre}`,
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

// PUT /api/prendas/:id/etapas/:etapaNombre/revertir
router.put('/:id/etapas/:etapaNombre/revertir', requireRol('PRODUCCION', 'ADMINISTRADOR', 'GERENTE'), async (req, res) => {
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
    data: {
      completada: false, fechaInicio: null, fechaFin: null, usuarioId: null, taller: null,
      fechaSalida: null, descripcionSalida: null, fechaLlegada: null, descripcionLlegada: null,
    },
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

module.exports = router;
