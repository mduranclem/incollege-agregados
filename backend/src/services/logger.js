const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function log({ usuarioId, accion, entidad, entidadId, detalle, pedidoId }) {
  await prisma.log.create({
    data: { usuarioId, accion, entidad, entidadId: Number(entidadId), detalle, pedidoId },
  });
}

module.exports = { log };
