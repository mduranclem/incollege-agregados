import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../api/client';
import EstadoBadge from '../components/EstadoBadge';
import ProgresoPrendas from '../components/ProgresoPrendas';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const ESTADOS_ACTIVOS = 'PENDIENTE_APROBACION,EN_PRODUCCION,TERMINADO,RECIBIDO_EN_LOCAL';

export default function EnProceso() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState('');
  const [estado, setEstado] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos-proceso', search, local, estado],
    queryFn: () => api.get('/pedidos', {
      params: { estado: estado || ESTADOS_ACTIVOS, local: local || undefined, busqueda: search || undefined, limit: 100 },
    }).then((r) => r.data),
    keepPreviousData: true,
  });

  const pedidos = data?.pedidos || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">En Proceso</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nombre, contrato, apodo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={local} onChange={(e) => setLocal(e.target.value)}>
          <option value="">Todos los locales</option>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
        </select>
        <select className="input max-w-xs" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_APROBACION">Pendiente aprobación</option>
          <option value="EN_PRODUCCION">En producción</option>
          <option value="TERMINADO">Terminado</option>
          <option value="RECIBIDO_EN_LOCAL">Recibido en local</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : pedidos.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No se encontraron pedidos</div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/pedidos/${p.id}`)}
              className="card w-full text-left hover:border-gray-700 transition-colors"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{p.nombre} {p.apellido}</span>
                    {p.apodo && <span className="text-gray-400 text-sm">"{p.apodo}"</span>}
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{p.colegio} · #{p.numeroContrato}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {LOCAL_LABEL[p.localTomoPedido]} · Entrega: {format(new Date(p.fechaEntregaComprometida), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="w-full sm:w-56 shrink-0">
                  <ProgresoPrendas prendas={p.prendas} compact />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
