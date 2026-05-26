# Deploy en EasyPanel - Guía paso a paso

## Parte 1: Instalar EasyPanel en el VPS (solo la primera vez)

Conectarse al VPS por SSH y ejecutar:

```bash
curl -sSL https://get.easypanel.io | sh
```

Luego entrar al panel desde el navegador: `http://IP_DEL_VPS:3000`
Crear usuario administrador cuando lo pida.

---

## Parte 2: Subir el código a GitHub

1. Crear cuenta en github.com (si no tenés)
2. Crear repo nuevo → nombre: `incollege-agregados` → **Privado**
3. Copiar la URL del repo (ej: `https://github.com/tuusuario/incollege-agregados.git`)
4. En la terminal de tu PC, desde la carpeta del proyecto:

```bash
git remote add origin https://github.com/tuusuario/incollege-agregados.git
git push -u origin master
```

---

## Parte 3: Conectar GitHub a EasyPanel

En EasyPanel → Settings → GitHub → conectar tu cuenta de GitHub.

---

## Parte 4: Crear la base de datos PostgreSQL

En EasyPanel → tu proyecto → **Add Service** → **PostgreSQL**

- Nombre: `incollege-db`
- EasyPanel te da automáticamente la `DATABASE_URL` — copiarla.

---

## Parte 5: Crear el servicio Backend

En EasyPanel → **Add Service** → **App**

- **Nombre:** `incollege-backend`
- **Source:** GitHub → repo `incollege-agregados` → Branch: `master`
- **Build context (subdirectory):** `backend`
- **Dockerfile path:** `backend/Dockerfile`

### Variables de entorno del backend:

```
DATABASE_URL=postgresql://...  (la que dio EasyPanel al crear PostgreSQL)
JWT_SECRET=genera_una_cadena_larga_aleatoria_aqui
JWT_REFRESH_SECRET=genera_otra_cadena_diferente_aqui
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
FRONTEND_URL=https://incollege.TU_DOMINIO.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=tu_app_password_de_gmail
SMTP_FROM=InCollege <tu@gmail.com>
```

### Dominio del backend:
Asignar dominio: `api.TU_DOMINIO.com` (o el subdominio que quieras)

---

## Parte 6: Poblar la base de datos (seed - solo una vez)

Una vez que el backend esté corriendo, desde EasyPanel abrir la consola del servicio backend y ejecutar:

```bash
node prisma/seed.js
```

Esto crea los usuarios de prueba.

---

## Parte 7: Crear el servicio Frontend

En EasyPanel → **Add Service** → **App**

- **Nombre:** `incollege-frontend`
- **Source:** GitHub → repo `incollege-agregados` → Branch: `master`
- **Build context (subdirectory):** `frontend`
- **Dockerfile path:** `frontend/Dockerfile`

### Build arguments del frontend:

```
VITE_API_URL=https://api.TU_DOMINIO.com
```

### Dominio del frontend:
Asignar dominio: `incollege.TU_DOMINIO.com`

---

## Resultado final

| URL | Qué es |
|---|---|
| `https://incollege.TU_DOMINIO.com` | El sistema (lo usan todos los locales) |
| `https://api.TU_DOMINIO.com` | La API (solo la usa el sistema internamente) |

## Usuarios iniciales (después del seed)

| Email | Contraseña | Rol |
|---|---|---|
| admin@incollege.com | admin123 | Administrador |
| carlos@incollege.com | vendedor123 | Vendedor |
| fabricacion@incollege.com | produccion123 | Producción |

**Importante:** Cambiar las contraseñas desde Gestión de Usuarios después del primer login.

## Actualizaciones futuras

Cada vez que se haga un cambio al sistema y se haga `git push`, EasyPanel detecta el cambio y redeploya automáticamente (si se activa el webhook en EasyPanel → Settings del servicio → Deploy Triggers).
