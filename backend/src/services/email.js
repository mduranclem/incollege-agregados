const nodemailer = require('nodemailer');
const prisma = require('../lib/prisma');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

const LOCAL_LABELS = {
  PELLEGRINI: 'Pellegrini',
  SUR: 'Sur',
  NORTE: 'Norte',
  FISHERTON: 'Fisherton',
  SANTA_FE: 'Santa Fe',
  SAN_NICOLAS: 'San Nicolás',
  FABRICA: 'Fábrica',
};

async function notificarNuevoPedido(pedido) {
  console.log('[EMAIL] SMTP_USER:', process.env.SMTP_USER);
  console.log('[EMAIL] SMTP_PASS definido:', !!process.env.SMTP_PASS);
  if (!process.env.SMTP_USER) {
    console.log('[EMAIL] Sin SMTP_USER, saliendo');
    return;
  }

  const admins = await prisma.usuario.findMany({
    where: { rol: 'ADMINISTRADOR', activo: true },
    select: { email: true },
  });

  if (!admins.length) return;

  const prendas = pedido.prendas
    .map((p) => `${p.tipo} talle ${p.talle}`)
    .join(', ');

  const saldo = pedido.costoTotal - pedido.sena;

  const html = `
    <h2>Nuevo pedido agregado - ${pedido.nombre} ${pedido.apellido}</h2>
    ${pedido.apodo ? `<p><b>Apodo:</b> ${pedido.apodo}</p>` : ''}
    <p><b>Colegio:</b> ${pedido.colegio}</p>
    <p><b>Contrato:</b> ${pedido.numeroContrato}</p>
    <p><b>Local:</b> ${LOCAL_LABELS[pedido.localTomoPedido]}</p>
    <p><b>Prendas:</b> ${prendas}</p>
    <p><b>Costo total:</b> $${pedido.costoTotal.toLocaleString('es-AR')}</p>
    <p><b>Seña:</b> $${pedido.sena.toLocaleString('es-AR')}</p>
    <p><b>Saldo:</b> $${saldo.toLocaleString('es-AR')}</p>
    <p><b>Entrega comprometida:</b> ${new Date(pedido.fechaEntregaComprometida).toLocaleDateString('es-AR')}</p>
    <hr/>
    <p>Ingresá al sistema para aprobar o rechazar el pedido.</p>
  `;

  const transporter = createTransport();
  const destinatarios = admins.map((a) => a.email).join(',');
  console.log('[EMAIL] Enviando a:', destinatarios);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: destinatarios,
    subject: `[InCollege] Nuevo pedido: ${pedido.nombre} ${pedido.apellido} - ${pedido.colegio}`,
    html,
  });
  console.log('[EMAIL] Enviado OK');
}

module.exports = { notificarNuevoPedido };
