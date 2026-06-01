import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import ReciboPago from './ReciboPago';

export default function CuentaCorriente({ pedido }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [modalPago, setModalPago] = useState(false);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [errorPago, setErrorPago] = useState('');
  const [reciboVisible, setReciboVisible] = useState(null); // pagoId

  const esAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'GERENTE';
  const puedeRegistrar = ['VENDEDOR', 'ADMINISTRADOR', 'GERENTE'].includes(usuario?.rol);

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['pagos', pedido.id],
    queryFn: () => api.get(`/pedidos/${pedido.id}/pagos`).then((r) => r.data),
  });

  const registrarPago = useMutation({
    mutationFn: (data) => api.post(`/pedidos/${pedido.id}/pagos`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagos', pedido.id] });
      setModalPago(false);
      setMonto('');
      setFecha(new Date().toISOString().split('T')[0]);
      setNotas('');
      setErrorPago('');
    },
    onError: (err) => setErrorPago(err.response?.data?.error || 'Error al registrar pago'),
  });

  const eliminarPago = useMutation({
    mutationFn: (pagoId) => api.delete(`/pedidos/${pedido.id}/pagos/${pagoId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagos', pedido.id] }),
  });

  function handleRegistrar(e) {
    e.preventDefault();
    setErrorPago('');
    if (!monto || Number(monto) <= 0) return setErrorPago('El monto debe ser mayor a cero');
    registrarPago.mutate({ monto: Number(monto), fecha, notas: notas || undefined });
  }

  if (isLoading) return null;

  const pagoConRecibo = reciboVisible ? resumen.pagos.find((p) => p.id === reciboVisible) : null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Cuenta corriente</h2>
        {puedeRegistrar && (
          <button onClick={() => setModalPago(true)} className="btn-primary text-xs py-1.5 px-3">
            + Registrar pago
          </button>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Costo total</span>
          <span className="text-white font-medium">${resumen.costoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total pagado</span>
          <span className="text-green-400 font-medium">${resumen.totalPagado.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-base border-t border-gray-700 pt-2 mt-1">
          <span className="font-bold text-white">
            {resumen.saldado ? 'Estado' : 'Saldo restante'}
          </span>
          {resumen.saldado ? (
            <span className="font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-sm">
              ✓ Pagado en su totalidad
            </span>
          ) : (
            <span className="font-bold text-yellow-400">${resumen.deudaRestante.toLocaleString('es-AR')}</span>
          )}
        </div>
      </div>

      {/* Tabla de pagos */}
      {resumen.pagos.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin pagos registrados</p>
      ) : (
        <div className="space-y-2">
          {resumen.pagos.map((pago) => (
            <div key={pago.id} className="flex items-center gap-3 text-sm border-b border-gray-800 pb-2 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">${pago.monto.toLocaleString('es-AR')}</span>
                  {pago.notas && <span className="text-gray-500">· {pago.notas}</span>}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {format(new Date(pago.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  {pago.creadoPor && ` · ${pago.creadoPor.nombre}`}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setReciboVisible(pago.id)}
                  className="text-xs btn-secondary py-1 px-2"
                >
                  🖨️ Recibo
                </button>
                {esAdmin && (
                  <button
                    onClick={() => eliminarPago.mutate(pago.id)}
                    disabled={eliminarPago.isPending}
                    className="text-xs btn-danger py-1 px-2"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal registrar pago */}
      <Modal open={modalPago} onClose={() => { setModalPago(false); setErrorPago(''); }} title="Registrar pago">
        <form onSubmit={handleRegistrar} className="space-y-4">
          <div>
            <label className="label">Monto *</label>
            <input
              className="input"
              type="number"
              min="1"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input
              className="input"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Pago parcial, transferencia..."
            />
          </div>
          {errorPago && <p className="text-red-400 text-sm">{errorPago}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={registrarPago.isPending}>
              {registrarPago.isPending ? 'Guardando...' : 'Registrar'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setModalPago(false); setErrorPago(''); }}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Recibo de pago individual */}
      {pagoConRecibo && (
        <Modal open={true} onClose={() => setReciboVisible(null)} title="Recibo de pago" size="lg">
          <ReciboPago pedido={pedido} pago={pagoConRecibo} resumen={resumen} />
          <button onClick={() => window.print()} className="btn-primary mt-3 no-print">Imprimir</button>
        </Modal>
      )}
    </div>
  );
}
