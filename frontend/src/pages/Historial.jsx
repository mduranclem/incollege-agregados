import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import EstadoBadge from '../components/EstadoBadge';

const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };

export default function Historial() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['historial', search, estadoFiltro],
    queryFn: () => api.get('/pedidos', {
      params: {
        estado: estadoFiltro || 'ENTREGADO,RECHAZADO',
        busqueda: search || undefined,
        limit: 100,
      },
    }).then((r) => r.data),
  });

  const pedidos = data?.pedidos || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Historial</h1>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
          <option value="">Entregados y rechazados</option>
          <option value="ENTREGADO">Solo entregados</option>
          <option value="RECHAZADO">Solo rechazados</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : pedidos.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Sin resultados</div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/pedidos/${p.id}`)}
              className="card w-full text-left hover:border-gray-700 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{p.nombre} {p.apellido}</span>
                    {p.apodo && <span className="text-gray-400 text-sm">"{p.apodo}"</span>}
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{p.colegio} · #{p.numeroContrato}</p>
                  {p.motivoRechazo && <p className="text-xs text-red-400 mt-0.5">Motivo: {p.motivoRechazo}</p>}
                </div>
                <div className="text-right shrink-0 text-xs text-gray-500">
                  <p>{LOCAL_LABEL[p.localTomoPedido]}</p>
                  <p>{format(new Date(p.fechaIngreso), 'dd/MM/yyyy')}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
