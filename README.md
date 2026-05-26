# InCollege - Sistema de Agregados

Sistema de gestión de pedidos "agregados" (personas que se suman tarde a pedidos grupales de indumentaria de egresados) para 7 locales InCollege.

## Stack técnico

- **Frontend:** React 18 + Vite + TailwindCSS v3 + React Query
- **Backend:** Node.js + Express + Prisma ORM
- **Base de datos:** PostgreSQL
- **Auth:** JWT (access 15min) + Refresh tokens (7 días)
- **Extras:** Nodemailer (mails), ExcelJS (exportación)

## Levantar localmente

### Requisitos

- Node.js 18+
- PostgreSQL 14+ corriendo localmente (o usar Railway/Supabase)

### 1. Clonar y configurar variables

```bash
# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con tu DATABASE_URL y secretos JWT
```

### 2. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Crear la base de datos y ejecutar migraciones

```bash
cd backend
npx prisma migrate dev --name init
```

### 4. Poblar con datos de prueba

```bash
cd backend
npm run db:seed
```

Usuarios creados:
| Email | Contraseña | Rol |
|---|---|---|
| admin@incollege.com | admin123 | ADMINISTRADOR |
| maria@incollege.com | admin123 | ADMINISTRADOR |
| carlos@incollege.com | vendedor123 | VENDEDOR |
| ana@incollege.com | vendedor123 | VENDEDOR |
| fabricacion@incollege.com | produccion123 | PRODUCCION |

### 5. Levantar los servidores

**Terminal 1 – Backend:**
```bash
cd backend
npm run dev
# Corre en http://localhost:3001
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm run dev
# Corre en http://localhost:5173
```

---

## Deploy en Railway

### Backend

1. Crear nuevo proyecto en [Railway](https://railway.app)
2. Agregar servicio PostgreSQL → copiar la `DATABASE_URL`
3. Agregar servicio desde GitHub (carpeta `/backend`)
4. Variables de entorno requeridas:

```
DATABASE_URL=postgresql://...
JWT_SECRET=secreto_largo_aleatorio_1
JWT_REFRESH_SECRET=secreto_largo_aleatorio_2
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
FRONTEND_URL=https://tu-frontend.railway.app

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=app_password_gmail
SMTP_FROM=InCollege <tu@gmail.com>
```

5. En el Build Command del servicio: `npx prisma generate && npx prisma migrate deploy`
6. Start Command: `node src/index.js`
7. Correr seed manualmente desde Railway CLI o consola:
   ```bash
   railway run node prisma/seed.js
   ```

### Frontend

1. Agregar servicio desde GitHub (carpeta `/frontend`)
2. Variables de entorno:
```
VITE_API_URL=https://tu-backend.railway.app
```
3. Actualizar `frontend/vite.config.js` para producción o usar la variable de entorno en `api/client.js`
4. Build Command: `npm run build`
5. Start Command: `npx serve dist -p 3000`

---

## Variables de entorno (backend/.env.example)

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/incollege"
JWT_SECRET="secreto_muy_largo_y_aleatorio"
JWT_REFRESH_SECRET="otro_secreto_diferente"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
FRONTEND_URL="http://localhost:5173"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="tu@gmail.com"
SMTP_PASS="tu_app_password"
SMTP_FROM="InCollege <tu@gmail.com>"
```

## Roles y permisos

| Acción | VENDEDOR | PRODUCCION | ADMINISTRADOR |
|---|:---:|:---:|:---:|
| Ver todos los pedidos | ✓ | ✓ | ✓ |
| Crear pedido | ✓ | | ✓ |
| Aprobar/rechazar pedido | | | ✓ |
| Avanzar etapas de producción | | ✓ | ✓ |
| Asignar local de entrega | | | ✓ |
| Marcar recibido en local | ✓ | | ✓ |
| Marcar entregado al cliente | ✓ | | ✓ |
| Gestionar usuarios | | | ✓ |
| Ver reportes y exportar | | | ✓ |
