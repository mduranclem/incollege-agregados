import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const LOCALES = ['PELLEGRINI', 'SUR', 'NORTE', 'FISHERTON', 'SANTA_FE', 'SAN_NICOLAS', 'FABRICA'];
const LOCAL_LABEL = { PELLEGRINI: 'Pellegrini', SUR: 'Sur', NORTE: 'Norte', FISHERTON: 'Fisherton', SANTA_FE: 'Santa Fe', SAN_NICOLAS: 'San Nicolás', FABRICA: 'Fábrica' };

const PRENDAS_TIPOS = [
  { key: 'remera', tipo: 'REMERA', label: 'Remera' },
  { key: 'chomba', tipo: 'CHOMBA', label: 'Chomba' },
  { key: 'campera', tipo: 'CAMPERA', label: 'Campera' },
  { key: 'buzo', tipo: 'BUZO', label: 'Buzo' },
];

const INIT_PRENDAS = {
  tieneRemera: false, talleRemera: '', bordadoRemera: false, sublimadoRemera: false,
  tieneChomba: false, talleChomba: '', bordadoChomba: false, sublimadoChomba: false,
  tieneCampera: false, talleCampera: '', bordadoCampera: false, sublimadoCampera: false,
  tieneBuzo: false, talleBuzo: '', bordadoBuzo: false, sublimadoBuzo: false,
};

function prendasToForm(prendas) {
  const result = { ...INIT_PRENDAS };
  for (const p of prendas) {
    const key = p.tipo.toLowerCase();
    const K = key.charAt(0).toUpperCase() + key.slice(1);
    result[`tiene${K}`] = true;
    result[`talle${K}`] = p.talle;
    result[`bordado${K}`] = p.tieneBordado;
    result[`sublimado${K}`] = p.tieneEstampado;
  }
  return result;
}

export default function EditarPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    if (!pedido) return;
    const hayEtapasCompletadas = pedido.prendas.some((p) => p.etapas.some((e) => e.completada));
    const fechaEntrega = pedido.fechaEntregaComprometida
      ? new Date(pedido.fechaEntregaComprometida).toISOString().split('T')[0]
      : '';
    setForm({
      nombre: pedido.nombre,
      apellido: pedido.apellido,
      apodo: pedido.apodo || '',
      colegio: pedido.colegio,
      numeroContrato: pedido.numeroContrato,
      costoTotal: pedido.costoTotal,
      sena: pedido.sena,
      fechaEntregaComprometida: fechaEntrega,
      localTomoPedido: pedido.localTomoPedido,
      hayEtapasCompletadas,
      ...(hayEtapasCompletadas ? {} : prendasToForm(pedido.prendas)),
    });
  }, [pedido]);

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/pedidos/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedido', id] });
      navigate(`/pedidos/${id}`);
    },
    onError: (err) => setError(err.response?.data?.error || 'Error al guardar'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      nombre: form.nombre,
      apellido: form.apellido,
      apodo: form.apodo || undefined,
      colegio: form.colegio,
      numeroContrato: form.numeroContrato,
      costoTotal: Number(form.costoTotal),
      sena: Number(form.sena),
      fechaEntregaComprometida: form.fechaEntregaComprometida,
      localTomoPedido: form.localTomoPedido,
    };

    if (!form.hayEtapasCompletadas) {
      const prendas = [];
      if (form.tieneRemera) prendas.push({ tipo: 'REMERA', talle: form.talleRemera, tieneBordado: form.bordadoRemera, tieneEstampado: form.sublimadoRemera });
      if (form.tieneChomba) prendas.push({ tipo: 'CHOMBA', talle: form.talleChomba, tieneBordado: form.bordadoChomba, tieneEstampado: form.sublimadoChomba });
      if (form.tieneCampera) prendas.push({ tipo: 'CAMPERA', talle: form.talleCampera, tieneBordado: form.bordadoCampera, tieneEstampado: form.sublimadoCampera });
      if (form.tieneBuzo) prendas.push({ tipo: 'BUZO', talle: form.talleBuzo, tieneBordado: form.bordadoBuzo, tieneEstampado: form.sublimadoBuzo });
      if (!prendas.length) return setError('Debe seleccionar al menos una prenda');
      payload.prendas = prendas;
    }

    mutation.mutate(payload);
  }

  if (isLoading || !form) return <div className="flex justify-center mt-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-4 block">← Volver</button>
      <h1 className="text-2xl font-bold text-white mb-6">Editar Pedido</h1>

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
            <input className="input" value={form.apodo} onChange={(e) => set('apodo', e.target.value)} />
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
        {form.hayEtapasCompletadas ? (
          <div className="card">
            <h2 className="text-sm font-semibold text-brand uppercase tracking-wide mb-3">Prendas</h2>
            <p className="text-sm text-yellow-400">Las prendas no se pueden modificar porque ya hay etapas de producción completadas.</p>
            <div className="mt-3 space-y-1">
              {pedido.prendas.map((p) => (
                <p key={p.id} className="text-sm text-gray-300">{p.tipo} · Talle {p.talle}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-brand uppercase tracking-wide">Prendas</h2>
            <div className="space-y-3">
              {PRENDAS_TIPOS.map(({ key, label }) => {
                const K = key.charAt(0).toUpperCase() + key.slice(1);
                const tieneKey = `tiene${K}`;
                const talleKey = `talle${K}`;
                const bordadoKey = `bordado${K}`;
                const sublimadoKey = `sublimado${K}`;
                return (
                  <div key={key}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form[tieneKey]} onChange={(e) => set(tieneKey, e.target.checked)} className="w-4 h-4 accent-brand" />
                      <span className="text-gray-300">{label}</span>
                    </label>
                    {form[tieneKey] && (
                      <div className="ml-7 mt-2 space-y-3">
                        <div>
                          <label className="label">Talle *</label>
                          <input className="input max-w-xs" placeholder="Ej: M, XL, 42..." value={form[talleKey]} onChange={(e) => set(talleKey, e.target.value)} required />
                        </div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-brand" checked={form[bordadoKey]} onChange={(e) => set(bordadoKey, e.target.checked)} />
                            <span className="text-sm text-gray-300">Bordado</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-brand" checked={form[sublimadoKey]} onChange={(e) => set(sublimadoKey, e.target.checked)} />
                            <span className="text-sm text-gray-300">Sublimado</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
