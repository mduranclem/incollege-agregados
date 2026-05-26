const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ETAPAS_BASE = ['CORTE', 'UNION', 'CONFECCION', 'TERMINADO', 'ENTREGA_A_LOCAL'];

function buildEtapas(tieneBordado, tieneEstampado) {
  const etapas = ['CORTE', 'UNION'];
  if (tieneBordado) etapas.push('BORDADO');
  if (tieneEstampado) etapas.push('ESTAMPADO');
  etapas.push('CONFECCION', 'TERMINADO', 'ENTREGA_A_LOCAL');
  return etapas.map((nombre, i) => ({ nombre, orden: i + 1 }));
}

async function main() {
  await prisma.log.deleteMany();
  await prisma.etapaProduccion.deleteMany();
  await prisma.prenda.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();

  const hash = (pwd) => bcrypt.hashSync(pwd, 10);

  const admin = await prisma.usuario.create({
    data: {
      nombre: 'Admin Principal',
      email: 'admin@incollege.com',
      password: hash('admin123'),
      rol: 'ADMINISTRADOR',
      localPrincipal: 'PELLEGRINI',
    },
  });

  const admin2 = await prisma.usuario.create({
    data: {
      nombre: 'Maria Gonzalez',
      email: 'maria@incollege.com',
      password: hash('admin123'),
      rol: 'ADMINISTRADOR',
      localPrincipal: 'SUR',
    },
  });

  const vendedor1 = await prisma.usuario.create({
    data: {
      nombre: 'Carlos Lopez',
      email: 'carlos@incollege.com',
      password: hash('vendedor123'),
      rol: 'VENDEDOR',
      localPrincipal: 'NORTE',
    },
  });

  const vendedor2 = await prisma.usuario.create({
    data: {
      nombre: 'Ana Torres',
      email: 'ana@incollege.com',
      password: hash('vendedor123'),
      rol: 'VENDEDOR',
      localPrincipal: 'FISHERTON',
    },
  });

  const produccion = await prisma.usuario.create({
    data: {
      nombre: 'Juan Fabricante',
      email: 'fabricacion@incollege.com',
      password: hash('produccion123'),
      rol: 'PRODUCCION',
      localPrincipal: 'FABRICA',
    },
  });

  // Pedido 1: EN_PRODUCCION con prendas en distintas etapas
  const pedido1 = await prisma.pedido.create({
    data: {
      nombre: 'Lucas',
      apellido: 'Ramirez',
      apodo: 'Luki',
      colegio: 'Colegio San Martin',
      numeroContrato: 'CSM-2024-001',
      costoTotal: 45000,
      sena: 15000,
      fechaEntregaComprometida: new Date('2024-11-30'),
      localTomoPedido: 'PELLEGRINI',
      estado: 'EN_PRODUCCION',
      creadorId: vendedor1.id,
      prendas: {
        create: [
          {
            tipo: 'REMERA',
            talle: 'M',
            tieneBordado: true,
            tieneEstampado: false,
            etapas: {
              create: buildEtapas(true, false).map((e, i) => ({
                ...e,
                completada: i < 2,
                fechaInicio: i < 2 ? new Date('2024-10-01') : null,
                fechaFin: i < 2 ? new Date('2024-10-05') : null,
                usuarioId: i < 2 ? produccion.id : null,
              })),
            },
          },
          {
            tipo: 'CAMPERA',
            talle: 'L',
            tieneBordado: true,
            tieneEstampado: true,
            etapas: {
              create: buildEtapas(true, true).map((e, i) => ({
                ...e,
                completada: i < 1,
                fechaInicio: i < 1 ? new Date('2024-10-01') : null,
                fechaFin: i < 1 ? new Date('2024-10-03') : null,
                usuarioId: i < 1 ? produccion.id : null,
              })),
            },
          },
        ],
      },
    },
  });

  // Pedido 2: PENDIENTE_APROBACION
  await prisma.pedido.create({
    data: {
      nombre: 'Sofia',
      apellido: 'Medina',
      colegio: 'Instituto Nacional',
      numeroContrato: 'IN-2024-042',
      costoTotal: 38000,
      sena: 10000,
      fechaEntregaComprometida: new Date('2024-12-15'),
      localTomoPedido: 'FISHERTON',
      estado: 'PENDIENTE_APROBACION',
      creadorId: vendedor2.id,
      prendas: {
        create: [
          {
            tipo: 'CAMPERA',
            talle: 'S',
            tieneBordado: false,
            tieneEstampado: false,
            etapas: { create: [] },
          },
        ],
      },
    },
  });

  // Pedido 3: TERMINADO con local asignado
  const pedido3 = await prisma.pedido.create({
    data: {
      nombre: 'Mateo',
      apellido: 'Fernandez',
      apodo: 'Mateo F',
      colegio: 'Colegio Del Sur',
      numeroContrato: 'CDS-2024-017',
      costoTotal: 52000,
      sena: 20000,
      fechaEntregaComprometida: new Date('2024-10-20'),
      localTomoPedido: 'SUR',
      localEntregaAsignado: 'SUR',
      estado: 'TERMINADO',
      creadorId: vendedor1.id,
      prendas: {
        create: [
          {
            tipo: 'REMERA',
            talle: 'XL',
            tieneBordado: false,
            tieneEstampado: true,
            etapas: {
              create: buildEtapas(false, true).map((e, i) => ({
                ...e,
                completada: true,
                fechaInicio: new Date('2024-09-01'),
                fechaFin: new Date('2024-09-15'),
                usuarioId: produccion.id,
              })),
            },
          },
        ],
      },
    },
  });

  // Pedido 4: ENTREGADO (historial)
  await prisma.pedido.create({
    data: {
      nombre: 'Valentina',
      apellido: 'Cruz',
      colegio: 'Escuela Belgrano',
      numeroContrato: 'EB-2024-005',
      costoTotal: 41000,
      sena: 41000,
      fechaEntregaComprometida: new Date('2024-09-01'),
      localTomoPedido: 'NORTE',
      localEntregaAsignado: 'NORTE',
      estado: 'ENTREGADO',
      creadorId: vendedor1.id,
      prendas: {
        create: [
          {
            tipo: 'CAMPERA',
            talle: 'M',
            tieneBordado: true,
            tieneEstampado: false,
            etapas: {
              create: buildEtapas(true, false).map((e) => ({
                ...e,
                completada: true,
                fechaInicio: new Date('2024-07-01'),
                fechaFin: new Date('2024-08-15'),
                usuarioId: produccion.id,
              })),
            },
          },
        ],
      },
    },
  });

  // Pedido 5: RECHAZADO
  await prisma.pedido.create({
    data: {
      nombre: 'Diego',
      apellido: 'Moreno',
      colegio: 'Colegio Pio XII',
      numeroContrato: 'CP-2024-099',
      costoTotal: 35000,
      sena: 5000,
      fechaEntregaComprometida: new Date('2024-11-01'),
      localTomoPedido: 'SANTA_FE',
      estado: 'RECHAZADO',
      motivoRechazo: 'Datos de contrato incorrectos, cliente debe volver a firmar.',
      creadorId: vendedor2.id,
      prendas: {
        create: [
          {
            tipo: 'REMERA',
            talle: 'L',
            etapas: { create: [] },
          },
        ],
      },
    },
  });

  console.log('✅ Seed completado');
  console.log('Usuarios creados:');
  console.log('  admin@incollege.com / admin123 (ADMINISTRADOR)');
  console.log('  maria@incollege.com / admin123 (ADMINISTRADOR)');
  console.log('  carlos@incollege.com / vendedor123 (VENDEDOR)');
  console.log('  ana@incollege.com / vendedor123 (VENDEDOR)');
  console.log('  fabricacion@incollege.com / produccion123 (PRODUCCION)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
