const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const usuario = await prisma.usuario.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  console.log('[LOGIN DEBUG]', {
    emailRecibido: JSON.stringify(email),
    largoEmailRecibido: email.length,
    encontrado: !!usuario,
    emailEnDB: usuario ? JSON.stringify(usuario.email) : null,
    activo: usuario?.activo,
    eliminado: usuario?.eliminado,
  });
  if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, usuario.password);
  console.log('[LOGIN DEBUG] passwordMatch:', ok);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, localPrincipal: usuario.localPrincipal };

  const accessToken = signAccess(payload);
  const refreshToken = signRefresh({ id: usuario.id });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      usuarioId: usuario.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({ accessToken, refreshToken, usuario: payload });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido' });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Refresh token expirado o inválido' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
  if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Usuario inactivo' });

  const newPayload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, localPrincipal: usuario.localPrincipal };
  const accessToken = signAccess(newPayload);

  res.json({ accessToken, usuario: newPayload });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ ok: true });
});

// PUT /api/auth/cambiar-password
router.put('/cambiar-password', authenticate, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  if (passwordNueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(passwordActual, usuario.password);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hashed = bcrypt.hashSync(passwordNueva, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { password: hashed } });

  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user.id },
    select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true },
  });
  res.json(usuario);
});

module.exports = router;
