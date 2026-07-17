import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EstadoBadge from '../components/EstadoBadge';
import Modal from '../components/Modal';
import Recibo from '../components/Recibo';
import CuentaCorriente from '../components/CuentaCorriente';

const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const ETAPA_LABEL = { CORTE:'Corte',UNION:'Unión',BORDADO:'Bordado',ESTAMPADO:'Estampado',CONFECCION:'Confección',TERMINADO:'Terminado',ENTREGA_A_LOCAL:'Entrega a local' };

export default function DetallePedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const qc = useQueryClient();

  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [modalLocal, setModalLocal] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [localAsignado, setLocalAsignado] = useState('');
  const [showRecibo, setShowRecibo] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editandoObs, setEditandoObs] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [tallerInputs, setTallerInputs] = useState({});
  const [eventoModal, setEventoModal] = useState(null);
  const [eventoFecha, setEventoFecha] = useState('');
  const [eventoDescripcion, setEventoDescripcion] = useState('');

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`).then((r) => r.data),
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ['pedido', id] }); }

  const aprobar = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/aprobar`).then((r) => r.data),
    onSuccess: () => { invalidate(); setModalAprobar(false); },
  });

  const rechazar = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/rechazar`, { motivo: motivoRechazo }).then((r) => r.data),
    onSuccess: () => { invalidate(); setModalRechazar(false); setMotivoRechazo(''); },
  });

  const asignarLocal = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/asignar-local`, { local: localAsignado }).then((r) => r.data),
    onSuccess: () => { invalidate(); setModalLocal(false); },
  });

  const marcarRecibido = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/recibido`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const marcarEntregado = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/entregado`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const avanzarEtapa = useMutation({
    mutationFn: ({ prendaId, etapa, taller }) => api.put(`/prendas/${prendaId}/etapas/${etapa}`, { taller }).then((r) => r.data),
    onSuccess: (_data, { prendaId, etapa }) => {
      setTallerInputs((prev) => {
        const next = { ...prev };
        delete next[`${prendaId}-${etapa}`];
        return next;
      });
      invalidate();
    },
  });

  const guardarObservaciones = useMutation({
    mutationFn: () => api.put(`/pedidos/${id}/observaciones`, { observaciones }).then((r) => r.data),
    onSuccess: () => { invalidate(); setEditandoObs(false); },
  });

  const registrarEvento = useMutation({
    mutationFn: ({ prendaId, etapa, tipo, fecha, descripcion }) =>
      api.put(`/prendas/${prendaId}/etapas/${etapa}/${tipo}`, { fecha, descripcion }).then((r) => r.data),
    onSuccess: () => { invalidate(); setEventoModal(null); setEventoFecha(''); setEventoDescripcion(''); },
  });

  function abrirEventoModal(prendaId, etapaNombre, tipo) {
    setEventoModal({ prendaId, etapaNombre, tipo });
    setEventoFecha(new Date().toISOString().split('T')[0]);
    setEventoDescripcion('');
  }

  const revertirEtapa = useMutation({
    mutationFn: ({ prendaId, etapa }) => api.put(`/prendas/${prendaId}/etapas/${etapa}/revertir`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/pedidos/${id}`).then((r) => r.data),
    onSuccess: () => navigate('/historial'),
  });

  if (isLoading) return <div className="flex justify-center mt-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (!pedido) return <div className="text-center mt-20 text-gray-400">Pedido no encontrado</div>;

  const saldo = pedido.costoTotal - pedido.sena;
  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'GERENTE';
  const esVendedor = usuario?.rol === 'VENDEDOR' || esAdmin;
  const esProduccion = usuario?.rol === 'PRODUCCION' || esAdmin;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-2 block">← Volver</button>
          <h1 className="text-2xl font-bold text-white">
            {pedido.nombre} {pedido.apellido}
            {pedido.apodo && <span className="text-gray-400 font-normal text-lg ml-2">"{pedido.apodo}"</span>}
          </h1>
          <p className="text-gray-400">{pedido.colegio} · #{pedido.numeroContrato}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EstadoBadge estado={pedido.estado} />
          <button onClick={() => setShowRecibo(!showRecibo)} className="btn-secondary text-sm py-1.5">🖨️ Recibo</button>
          {(usuario?.rol === 'VENDEDOR' || usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'GERENTE') && pedido.estado !== 'ENTREGADO' && (
            <>
              <button onClick={() => navigate(`/pedidos/${id}/editar`)} className="btn-secondary text-sm py-1.5">✏️ Editar</button>
              <button onClick={() => setModalEliminar(true)} className="btn-danger text-sm py-1.5">🗑️ Eliminar</button>
            </>
          )}
        </div>
      </div>

      {showRecibo && (
        <div>
          <Recibo pedido={pedido} />
          <button onClick={() => window.print()} className="btn-primary mt-3 no-print">Imprimir</button>
        </div>
      )}

      {/* Datos */}
      <div className="card grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><p className="text-gray-400">Local</p><p className="text-white font-medium">{LOCAL_LABEL[pedido.localTomoPedido]}</p></div>
        <div><p className="text-gray-400">Ingreso</p><p className="text-white font-medium">{format(new Date(pedido.fechaIngreso), 'dd/MM/yyyy')}</p></div>
        <div><p className="text-gray-400">Entrega (aproximada)</p><p className="text-white font-medium">{format(new Date(pedido.fechaEntregaComprometida), 'dd/MM/yyyy')}</p></div>
        {pedido.telefono && (
          <div><p className="text-gray-400">Teléfono</p><p className="text-white font-medium">{pedido.telefono}</p></div>
        )}
        <div><p className="text-gray-400">Costo total</p><p className="text-white font-medium">${pedido.costoTotal.toLocaleString('es-AR')}</p></div>
        <div><p className="text-gray-400">Seña</p><p className="text-white font-medium">${pedido.sena.toLocaleString('es-AR')}</p></div>
        <div><p className="text-gray-400">Saldo</p><p className={`font-medium ${saldo > 0 ? 'text-yellow-400' : 'text-green-400'}`}>${saldo.toLocaleString('es-AR')}</p></div>
        {pedido.localEntregaAsignado && (
          <div><p className="text-gray-400">Local de entrega</p><p className="text-brand font-medium">{LOCAL_LABEL[pedido.localEntregaAsignado]}</p></div>
        )}
        {pedido.motivoRechazo && (
          <div className="col-span-full"><p className="text-gray-400">Motivo rechazo</p><p className="text-red-400">{pedido.motivoRechazo}</p></div>
        )}
      </div>

      {/* Prendas + Etapas */}
      <div className="card space-y-6">
        <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Prendas y producción</h2>
        {pedido.prendas.map((prenda) => (
          <div key={prenda.id} className="border border-gray-800 rounded-lg p-4">
            <p className="font-semibold text-white mb-3">
              {['REMERA','CHOMBA'].includes(prenda.tipo) ? '👕' : '🧥'} {prenda.tipo} · Talle {prenda.talle}
              {prenda.tieneBordado && <span className="ml-2 text-xs badge bg-purple-500/15 text-purple-400">Bordado</span>}
              {prenda.tieneEstampado && <span className="ml-2 text-xs badge bg-orange-500/15 text-orange-400">DTF/ESTAMPADO</span>}
            </p>
            <div className="space-y-2">
              {prenda.etapas.map((etapa, i) => {
                const esLaSiguiente = !etapa.completada && (i === 0 || prenda.etapas[i - 1]?.completada);
                const puedeDeshacer = etapa.completada && pedido.estado === 'EN_PRODUCCION' &&
                  (usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'PRODUCCION' || usuario?.rol === 'GERENTE');
                const tallerKey = `${prenda.id}-${etapa.nombre}`;
                const puedeCompletar = esLaSiguiente && esProduccion && pedido.estado === 'EN_PRODUCCION';
                const puedeGestionarEnvio = esLaSiguiente && esProduccion && pedido.estado === 'EN_PRODUCCION';
                return (
                  <div key={etapa.id} className="space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${etapa.completada ? 'bg-brand text-white' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                        {etapa.completada ? '✓' : ''}
                      </div>
                      <div className="flex-1 min-w-[8rem]">
                        <span className={`text-sm ${etapa.completada ? 'text-gray-300' : 'text-gray-500'}`}>
                          {ETAPA_LABEL[etapa.nombre]}
                        </span>
                        {etapa.completada && etapa.fechaFin && (
                          <span className="text-xs text-gray-500 ml-2">
                            {format(new Date(etapa.fechaFin), 'dd/MM/yyyy HH:mm')}
                            {etapa.usuario && ` · ${etapa.usuario.nombre}`}
                            {etapa.taller && ` · Taller: ${etapa.taller}`}
                          </span>
                        )}
                      </div>
                      {puedeCompletar && (
                        <input
                          className="input py-1 text-xs w-32"
                          placeholder="Taller"
                          value={tallerInputs[tallerKey] || ''}
                          onChange={(e) => setTallerInputs((prev) => ({ ...prev, [tallerKey]: e.target.value }))}
                        />
                      )}
                      {puedeCompletar && (
                        <button
                          onClick={() => avanzarEtapa.mutate({ prendaId: prenda.id, etapa: etapa.nombre, taller: tallerInputs[tallerKey] || undefined })}
                          disabled={avanzarEtapa.isPending}
                          className="text-xs btn-primary py-1 px-2"
                        >
                          Completar
                        </button>
                      )}
                      {puedeDeshacer && (
                        <button
                          onClick={() => revertirEtapa.mutate({ prendaId: prenda.id, etapa: etapa.nombre })}
                          disabled={revertirEtapa.isPending}
                          className="text-xs btn-secondary py-1 px-2"
                        >
                          Deshacer
                        </button>
                      )}
                    </div>

                    {(etapa.fechaSalida || etapa.fechaLlegada || puedeGestionarEnvio) && (
                      <div className="ml-8 flex items-center gap-3 flex-wrap text-xs">
                        {etapa.fechaSalida ? (
                          <span className="text-gray-500">
                            🚚 Se fue: {format(new Date(etapa.fechaSalida), 'dd/MM/yyyy HH:mm')}
                            {etapa.descripcionSalida && ` · ${etapa.descripcionSalida}`}
                          </span>
                        ) : puedeGestionarEnvio ? (
                          <button
                            onClick={() => abrirEventoModal(prenda.id, etapa.nombre, 'se-va')}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            Se va →
                          </button>
                        ) : null}

                        {etapa.fechaLlegada ? (
                          <span className="text-gray-500">
                            ✓ Llegó: {format(new Date(etapa.fechaLlegada), 'dd/MM/yyyy HH:mm')}
                            {etapa.descripcionLlegada && ` · ${etapa.descripcionLlegada}`}
                          </span>
                        ) : etapa.fechaSalida && puedeGestionarEnvio ? (
                          <button
                            onClick={() => abrirEventoModal(prenda.id, etapa.nombre, 'llego')}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            ✓ Llegó
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cuenta corriente */}
      <CuentaCorriente pedido={pedido} />

      {/* Observaciones */}
      <div className="card space-y-3 no-print">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Observaciones</h2>
          {esVendedor && !editandoObs && (
            <button
              onClick={() => { setObservaciones(pedido.observaciones || ''); setEditandoObs(true); }}
              className="text-xs btn-secondary py-1 px-2"
            >
              ✏️ Editar
            </button>
          )}
        </div>
        {editandoObs ? (
          <div className="space-y-2">
            <textarea
              className="input h-24 resize-none"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas u observaciones sobre el pedido..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => guardarObservaciones.mutate()}
                disabled={guardarObservaciones.isPending}
                className="text-xs btn-primary py-1 px-2"
              >
                {guardarObservaciones.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditandoObs(false)} className="text-xs btn-secondary py-1 px-2">Cancelar</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {pedido.observaciones || <span className="text-gray-500">Sin observaciones</span>}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="card space-y-3 no-print">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Acciones</h2>
        <div className="flex flex-wrap gap-3">
          {pedido.estado === 'PENDIENTE_APROBACION' && (usuario?.rol === 'GERENTE' || usuario?.rol === 'ADMINISTRADOR') && (
            <>
              <button onClick={() => setModalAprobar(true)} className="btn-primary">✅ Aprobar pedido</button>
              <button onClick={() => setModalRechazar(true)} className="btn-danger">❌ Rechazar</button>
            </>
          )}
          {pedido.estado === 'TERMINADO' && esAdmin && !pedido.localEntregaAsignado && (
            <button onClick={() => setModalLocal(true)} className="btn-primary">📍 Asignar local de entrega</button>
          )}
          {pedido.estado === 'TERMINADO' && esVendedor && (
            <button onClick={() => marcarRecibido.mutate()} disabled={marcarRecibido.isPending} className="btn-primary">
              📦 Marcar como recibido en local
            </button>
          )}
          {pedido.estado === 'RECIBIDO_EN_LOCAL' && esVendedor && (
            <button onClick={() => marcarEntregado.mutate()} disabled={marcarEntregado.isPending} className="btn-primary">
              🤝 Marcar como entregado al cliente
            </button>
          )}
        </div>
      </div>

      {/* Log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-brand uppercase tracking-wide mb-4">Historial de movimientos</h2>
        {pedido.logs.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin movimientos registrados</p>
        ) : (
          <div className="space-y-2">
            {pedido.logs.map((l) => (
              <div key={l.id} className="flex gap-3 text-sm">
                <span className="text-gray-500 shrink-0 w-32">
                  {format(new Date(l.createdAt), 'dd/MM HH:mm')}
                </span>
                <div>
                  <span className="text-gray-300">{l.accion}</span>
                  {l.detalle && <span className="text-gray-500 ml-1">· {l.detalle}</span>}
                  <span className="text-gray-600 ml-1">({l.usuario?.nombre})</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Aprobar */}
      <Modal open={modalAprobar} onClose={() => setModalAprobar(false)} title="Aprobar pedido" size="md">
        <p className="text-gray-400 text-sm mb-4">¿Confirmás la aprobación del pedido? Las etapas de producción ya fueron configuradas por el vendedor.</p>
        <div className="space-y-2 mb-6">
          {pedido.prendas.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <span className="text-white">{p.tipo} · Talle {p.talle}</span>
              {p.tieneBordado && <span className="badge bg-purple-500/15 text-purple-400">Bordado</span>}
              {p.tieneEstampado && <span className="badge bg-orange-500/15 text-orange-400">DTF/ESTAMPADO</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => aprobar.mutate()} disabled={aprobar.isPending} className="btn-primary">
            {aprobar.isPending ? 'Aprobando...' : 'Confirmar aprobación'}
          </button>
          <button onClick={() => setModalAprobar(false)} className="btn-secondary">Cancelar</button>
        </div>
        {aprobar.isError && <p className="text-red-400 text-sm mt-2">{aprobar.error?.response?.data?.error}</p>}
      </Modal>

      {/* Modal Rechazar */}
      <Modal open={modalRechazar} onClose={() => setModalRechazar(false)} title="Rechazar pedido">
        <label className="label">Motivo del rechazo *</label>
        <textarea
          className="input h-24 resize-none"
          value={motivoRechazo}
          onChange={(e) => setMotivoRechazo(e.target.value)}
          placeholder="Indicá el motivo..."
        />
        <div className="flex gap-3 mt-4">
          <button onClick={() => rechazar.mutate()} disabled={rechazar.isPending || !motivoRechazo} className="btn-danger">
            {rechazar.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
          </button>
          <button onClick={() => setModalRechazar(false)} className="btn-secondary">Cancelar</button>
        </div>
      </Modal>

      {/* Modal Asignar Local */}
      <Modal open={modalLocal} onClose={() => setModalLocal(false)} title="Asignar local de entrega">
        <label className="label">Local de entrega</label>
        <select className="input" value={localAsignado} onChange={(e) => setLocalAsignado(e.target.value)}>
          <option value="">Seleccionar...</option>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
        </select>
        <div className="flex gap-3 mt-4">
          <button onClick={() => asignarLocal.mutate()} disabled={asignarLocal.isPending || !localAsignado} className="btn-primary">
            {asignarLocal.isPending ? 'Guardando...' : 'Asignar'}
          </button>
          <button onClick={() => setModalLocal(false)} className="btn-secondary">Cancelar</button>
        </div>
      </Modal>

      {/* Modal Eliminar */}
      <Modal open={modalEliminar} onClose={() => setModalEliminar(false)} title="Eliminar pedido" size="md">
        <p className="text-gray-400 text-sm mb-4">
          ¿Confirmás que querés eliminar el pedido de <span className="text-white font-semibold">{pedido.nombre} {pedido.apellido}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={() => eliminar.mutate()} disabled={eliminar.isPending} className="btn-danger">
            {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
          <button onClick={() => setModalEliminar(false)} className="btn-secondary">Cancelar</button>
        </div>
        {eliminar.isError && <p className="text-red-400 text-sm mt-2">{eliminar.error?.response?.data?.error}</p>}
      </Modal>

      {/* Modal Se va / Llegó */}
      <Modal
        open={!!eventoModal}
        onClose={() => setEventoModal(null)}
        title={eventoModal?.tipo === 'se-va' ? 'Registrar salida' : 'Registrar llegada'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Fecha *</label>
            <input className="input" type="date" value={eventoFecha} onChange={(e) => setEventoFecha(e.target.value)} required />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input h-20 resize-none"
              value={eventoDescripcion}
              onChange={(e) => setEventoDescripcion(e.target.value)}
              placeholder="Detalles opcionales..."
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => registrarEvento.mutate({
                prendaId: eventoModal.prendaId,
                etapa: eventoModal.etapaNombre,
                tipo: eventoModal.tipo,
                fecha: eventoFecha,
                descripcion: eventoDescripcion,
              })}
              disabled={registrarEvento.isPending || !eventoFecha}
              className="btn-primary"
            >
              {registrarEvento.isPending ? 'Guardando...' : 'Confirmar'}
            </button>
            <button onClick={() => setEventoModal(null)} className="btn-secondary">Cancelar</button>
          </div>
          {registrarEvento.isError && <p className="text-red-400 text-sm">{registrarEvento.error?.response?.data?.error}</p>}
        </div>
      </Modal>
    </div>
  );
}
