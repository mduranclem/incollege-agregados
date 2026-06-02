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
