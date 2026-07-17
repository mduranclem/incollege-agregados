const express = require('express');
const ExcelJS = require('exceljs');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

const ADMIN_PRINCIPAL_EMAIL = 'valeriaclementi3@gmail.com';

router.use(authenticate, (req, res, next) => {
  if (req.user.email !== ADMIN_PRINCIPAL_EMAIL) {
    return res.status(403).json({ error: 'Sin permisos para esta acción' });
  }
  next();
});

function buildWhere(query) {
  const { desde, hasta, local, estado } = query;
  const where = {};
  if (desde || hasta) {
    where.fechaEntregaComprometida = {};
    if (desde) where.fechaEntregaComprometida.gte = new Date(desde);
    if (hasta) {
      const h = new Date(hasta);
      h.setHours(23, 59, 59, 999);
      where.fechaEntregaComprometida.lte = h;
    }
  }
  if (local) where.localTomoPedido = local;
  if (estado) where.estado = estado;
  return where;
}

// GET /api/reportes
router.get('/', async (req, res) => {
  const where = buildWhere(req.query);
  const pedidos = await prisma.pedido.findMany({
    where,
    include: {
      creador: { select: { nombre: true, localPrincipal: true } },
      prendas: { include: { etapas: { orderBy: { orden: 'asc' } } } },
    },
    orderBy: { fechaIngreso: 'desc' },
  });
  res.json(pedidos);
});

// GET /api/reportes/excel
router.get('/excel', async (req, res) => {
  const where = buildWhere(req.query);
  const pedidos = await prisma.pedido.findMany({
    where,
    include: {
      creador: { select: { nombre: true } },
      prendas: true,
    },
    orderBy: { fechaIngreso: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pedidos');

  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Nombre', key: 'nombre', width: 20 },
    { header: 'Apellido', key: 'apellido', width: 20 },
    { header: 'Apodo', key: 'apodo', width: 15 },
    { header: 'Colegio', key: 'colegio', width: 25 },
    { header: 'Contrato', key: 'numeroContrato', width: 18 },
    { header: 'Local', key: 'localTomoPedido', width: 15 },
    { header: 'Estado', key: 'estado', width: 22 },
    { header: 'Costo Total', key: 'costoTotal', width: 14 },
    { header: 'Seña', key: 'sena', width: 14 },
    { header: 'Saldo', key: 'saldo', width: 14 },
    { header: 'Fecha Ingreso', key: 'fechaIngreso', width: 16 },
    { header: 'Entrega Comprometida', key: 'fechaEntrega', width: 20 },
    { header: 'Prendas', key: 'prendas', width: 30 },
    { header: 'Vendedor', key: 'vendedor', width: 20 },
  ];

  ws.getRow(1).font = { bold: true };

  pedidos.forEach((p) => {
    ws.addRow({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      apodo: p.apodo || '',
      colegio: p.colegio,
      numeroContrato: p.numeroContrato,
      localTomoPedido: p.localTomoPedido,
      estado: p.estado,
      costoTotal: p.costoTotal,
      sena: p.sena,
      saldo: p.costoTotal - p.sena,
      fechaIngreso: p.fechaIngreso.toLocaleDateString('es-AR'),
      fechaEntrega: p.fechaEntregaComprometida.toLocaleDateString('es-AR'),
      prendas: p.prendas.map((pr) => `${pr.tipo} T:${pr.talle}`).join(' | '),
      vendedor: p.creador.nombre,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte-pedidos.xlsx');

  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
