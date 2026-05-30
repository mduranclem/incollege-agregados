# Diseño: Editar, Eliminar Pedidos y Deshacer Etapas

## Resumen

Agregar la capacidad de editar y eliminar pedidos, y de deshacer etapas de producción avanzadas por error.

---

## Permisos

| Acción | VENDEDOR | ADMINISTRADOR | PRODUCCION | GERENTE |
|---|---|---|---|---|
| Editar pedido | ✅ | ✅ | ❌ | ❌ |
| Eliminar pedido | ✅ | ✅ | ❌ | ❌ |
| Deshacer etapa | ❌ | ✅ | ✅ | ❌ |

---

## 1. Editar pedido

### Condición de habilitación
Disponible en cualquier estado excepto `ENTREGADO`.

### Modo edición completa (ninguna etapa completada)
Se editan todos los campos:
- Datos del cliente: nombre, apellido, apodo, colegio, numeroContrato
- Económicos: costoTotal, sena
- Logística: fechaEntregaComprometida, localTomoPedido
- Prendas: se borran todas las prendas/etapas existentes y se recrean desde cero

### Modo edición parcial (hay al menos una etapa completada)
Solo se editan los datos básicos:
- nombre, apellido, apodo, colegio, numeroContrato, costoTotal, sena, fechaEntregaComprometida, localTomoPedido
- Las prendas y etapas no se modifican

### Backend
- `PUT /api/pedidos/:id` — nuevo endpoint
  - Verifica estado != ENTREGADO
  - Verifica rol VENDEDOR o ADMINISTRADOR
  - Si ninguna etapa completada: actualiza campos + borra prendas/etapas y las recrea
  - Si hay etapas completadas: actualiza solo campos básicos
  - Registra log `EDITAR_PEDIDO`

### Frontend
- Nueva página `EditarPedido.jsx` — reutiliza la estructura visual de `NuevoPedido.jsx`
  - Se carga pre-poblada con los datos actuales del pedido
  - Si hay etapas completadas: muestra sección de prendas en modo solo lectura con aviso
- Botón "Editar" en `DetallePedido.jsx` visible para VENDEDOR y ADMINISTRADOR cuando estado != ENTREGADO
- Ruta: `/pedidos/:id/editar`

---

## 2. Eliminar pedido

### Condición de habilitación
Disponible en cualquier estado excepto `ENTREGADO`.

### Comportamiento
- Confirmación obligatoria via modal antes de eliminar
- Elimina en orden: Logs del pedido → EtapaProduccion → Prenda → Pedido
- Redirige a la lista de pedidos tras eliminar

### Backend
- `DELETE /api/pedidos/:id` — nuevo endpoint
  - Verifica estado != ENTREGADO
  - Verifica rol VENDEDOR o ADMINISTRADOR
  - Ejecuta eliminación en cascada

### Frontend
- Botón "Eliminar" en `DetallePedido.jsx` (con estilo danger)
- Modal de confirmación con nombre del cliente antes de ejecutar

---

## 3. Deshacer etapa de producción

### Condición de habilitación
Solo cuando el pedido está en estado `EN_PRODUCCION`.

### Comportamiento
- En el detalle de cada prenda, las etapas completadas muestran un botón "Deshacer"
- Al deshacer: esa etapa y todas las posteriores de esa prenda vuelven a pendiente (completada=false, fechaInicio=null, fechaFin=null, usuarioId=null)
- Es por prenda individual, no afecta otras prendas del mismo pedido

### Backend
- `PUT /api/prendas/:prendaId/etapas/:nombre/revertir` — nuevo endpoint en `prendas.js`
  - Verifica que el pedido de la prenda esté EN_PRODUCCION
  - Verifica rol ADMINISTRADOR o PRODUCCION
  - Busca la etapa por nombre, obtiene su orden
  - Resetea esa etapa y todas con orden >= al de esa etapa en la misma prenda
  - Registra log `REVERTIR_ETAPA`

### Frontend
- En `DetallePedido.jsx`, en la lista de etapas, las etapas completadas muestran botón "Deshacer" para ADMINISTRADOR y PRODUCCION
- Solo visible cuando pedido.estado === 'EN_PRODUCCION'
