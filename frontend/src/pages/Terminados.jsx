import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import EstadoBadge from '../components/EstadoBadge';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };

export default function Terminados() {
  const navigate = useNavigate();
  const [localFiltro, setLocalFiltro] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos-terminados', localFiltro],
    queryFn: () => api.get('/pedidos', {
      params: { estado: 'TERMINADO,RECIBIDO_EN_LOCAL', limit: 100 },
    }).then((r) => r.data),
  });

  const pedidos = (data?.pedidos || []).filter((p) =>
    !localFiltro || p.localEntregaAsignado === localFiltro
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Terminados</h1>

      <select className="input max-w-xs" value={localFiltro} onChange={(e) => setLocalFiltro(e.target.value)}>
        <option value="">Todos los locales</option>
        {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
      </select>

      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : pedidos.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No hay pedidos terminados</div>
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    Entrega: {format(new Date(p.fechaEntregaComprometida), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {p.localEntregaAsignado ? (
                    <span className="badge bg-brand/15 text-brand">{LOCAL_LABEL[p.localEntregaAsignado]}</span>
                  ) : (
                    <span className="badge bg-yellow-500/15 text-yellow-400">⚠️ Sin local asignado</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
