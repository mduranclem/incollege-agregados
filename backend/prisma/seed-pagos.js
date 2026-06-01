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
