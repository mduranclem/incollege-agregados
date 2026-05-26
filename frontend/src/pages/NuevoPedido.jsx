import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Recibo from '../components/Recibo';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const TALLES = ['XS','S','M','L','XL','XXL','3XL','4XL'];

const INIT = {
  nombre: '', apellido: '', apodo: '', colegio: '', numeroContrato: '',
  costoTotal: '', sena: '', fechaEntregaComprometida: '', localTomoPedido: '',
  tieneRemera: false, talleRemera: '', tieneCampera: false, talleCampera: '',
};

export default function NuevoPedido() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [form, setForm] = useState({ ...INIT, localTomoPedido: usuario?.localPrincipal || '' });
  const [error, setError] = useState('');
  const [pedidoCreado, setPedidoCreado] = useState(null);
  const reciboRef = useRef();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) => api.post('/pedidos', data).then((r) => r.data),
    onSuccess: (pedido) => setPedidoCreado(pedido),
    onError: (err) => setError(err.response?.data?.error || 'Error al crear el pedido'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.tieneRemera && !form.tieneCampera) {
      return setError('Debe seleccionar al menos una prenda');
    }
    const prendas = [];
    if (form.tieneRemera) prendas.push({ tipo: 'REMERA', talle: form.talleRemera });
    if (form.tieneCampera) prendas.push({ tipo: 'CAMPERA', talle: form.talleCampera });

    mutation.mutate({
      nombre: form.nombre,
      apellido: form.apellido,
      apodo: form.apodo || undefined,
      colegio: form.colegio,
      numeroContrato: form.numeroContrato,
      costoTotal: Number(form.costoTotal),
      sena: Number(form.sena),
      fechaEntregaComprometida: form.fechaEntregaComprometida,
      localTomoPedido: form.localTomoPedido,
      prendas,
    });
  }

  function handlePrint() {
    window.print();
  }

  if (pedidoCreado) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card border-brand/30 bg-brand/5 text-center py-6">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-white font-semibold">Pedido creado exitosamente</p>
          <p className="text-gray-400 text-sm mt-1">Se notificó a los administradores</p>
        </div>
        <div ref={reciboRef}>
          <Recibo pedido={pedidoCreado} />
        </div>
        <div className="flex gap-3 no-print">
          <button onClick={handlePrint} className="btn-primary">🖨️ Imprimir recibo</button>
          <button onClick={() => navigate(`/pedidos/${pedidoCreado.id}`)} className="btn-secondary">Ver pedido</button>
          <button onClick={() => { setPedidoCreado(null); setForm({ ...INIT, localTomoPedido: usuario?.localPrincipal || '' }); }} className="btn-secondary">Nuevo pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Nuevo Pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos del cliente */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Datos del cliente</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input className="input" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Apodo (opcional)</label>
            <input className="input" value={form.apodo} onChange={(e) => set('apodo', e.target.value)} placeholder="Como lo conocen..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Colegio *</label>
              <input className="input" value={form.colegio} onChange={(e) => set('colegio', e.target.value)} required />
            </div>
            <div>
              <label className="label">N° de contrato *</label>
              <input className="input" value={form.numeroContrato} onChange={(e) => set('numeroContrato', e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Prendas */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Prendas</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.tieneRemera} onChange={(e) => set('tieneRemera', e.target.checked)} className="w-4 h-4 accent-brand" />
              <span className="text-gray-300">Remera / Chomba</span>
            </label>
            {form.tieneRemera && (
              <div className="ml-7">
                <label className="label">Talle *</label>
                <select className="input max-w-xs" value={form.talleRemera} onChange={(e) => set('talleRemera', e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {TALLES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.tieneCampera} onChange={(e) => set('tieneCampera', e.target.checked)} className="w-4 h-4 accent-brand" />
              <span className="text-gray-300">Campera / Buzo</span>
            </label>
            {form.tieneCampera && (
              <div className="ml-7">
                <label className="label">Talle *</label>
                <select className="input max-w-xs" value={form.talleCampera} onChange={(e) => set('talleCampera', e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {TALLES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Datos económicos */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Datos económicos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costo total *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.costoTotal} onChange={(e) => set('costoTotal', e.target.value)} required />
            </div>
            <div>
              <label className="label">Seña abonada *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.sena} onChange={(e) => set('sena', e.target.value)} required />
            </div>
          </div>
          {form.costoTotal && form.sena && (
            <p className="text-sm text-gray-400">
              Saldo restante: <span className="text-white font-semibold">${(Number(form.costoTotal) - Number(form.sena)).toLocaleString('es-AR')}</span>
            </p>
          )}
        </div>

        {/* Logística */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Logística</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Local donde se toma *</label>
              <select className="input" value={form.localTomoPedido} onChange={(e) => set('localTomoPedido', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha de entrega comprometida *</label>
              <input className="input" type="date" value={form.fechaEntregaComprometida} onChange={(e) => set('fechaEntregaComprometida', e.target.value)} required />
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Crear pedido'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
