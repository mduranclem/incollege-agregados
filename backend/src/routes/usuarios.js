const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRol } = require('../middleware/auth');
const { log } = require('../services/logger');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate, requireRol('GERENTE'));

// GET /api/usuarios
router.get('/', async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { eliminado: false },
    select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true, createdAt: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(usuarios);
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  const { nombre, email, password, rol, localPrincipal } = req.body;
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

  const usuario = await prisma.usuario.create({
    data: { nombre, email, password: bcrypt.hashSync(password, 10), rol, localPrincipal: localPrincipal || null },
    select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true },
  });

  await log({ usuarioId: req.user.id, accion: 'CREAR_USUARIO', entidad: 'Usuario', entidadId: usuario.id, detalle: `${nombre} (${rol})` });
  res.status(201).json(usuario);
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, email, password, rol, localPrincipal, activo } = req.body;

  const data = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (email !== undefined) data.email = email;
  if (password) data.password = bcrypt.hashSync(password, 10);
  if (rol !== undefined) data.rol = rol;
  if (localPrincipal !== undefined) data.localPrincipal = localPrincipal || null;
  if (activo !== undefined) data.activo = activo;

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, localPrincipal: true, activo: true },
    });
    await log({ usuarioId: req.user.id, accion: 'EDITAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: JSON.stringify(data) });
    res.json(usuario);
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

// DELETE /api/usuarios/:id (desactivar — soft disable)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: { id: true, nombre: true },
  });
  await log({ usuarioId: req.user.id, accion: 'DESACTIVAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: usuario.nombre });
  res.json({ ok: true });
});

// DELETE /api/usuarios/:id/eliminar (tombstone — eliminación permanente)
router.delete('/:id/eliminar', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { nombre: true, eliminado: true } });
    if (!usuario || usuario.eliminado) return res.status(404).json({ error: 'Usuario no encontrado' });

    const nombreOriginal = usuario.nombre;

    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { usuarioId: id } }),
      prisma.usuario.update({
        where: { id },
        data: {
          email: `eliminado_${id}@deleted.local`,
          password: bcrypt.hashSync(crypto.randomUUID(), 10),
          activo: false,
          eliminado: true,
        },
      }),
    ]);

    await log({ usuarioId: req.user.id, accion: 'ELIMINAR_USUARIO', entidad: 'Usuario', entidadId: id, detalle: nombreOriginal });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

module.exports = router;
