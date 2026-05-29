import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import EstadoBadge from '../components/EstadoBadge';
import { useAuth } from '../context/AuthContext';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const ESTADOS = ['PENDIENTE_APROBACION','RECHAZADO','EN_PRODUCCION','TERMINADO','RECIBIDO_EN_LOCAL','ENTREGADO'];
const ESTADO_LABEL = { PENDIENTE_APROBACION:'Pendiente',RECHAZADO:'Rechazado',EN_PRODUCCION:'En producción',TERMINADO:'Terminado',RECIBIDO_EN_LOCAL:'En local',ENTREGADO:'Entregado' };

export default function Reportes() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const esGerente = usuario?.rol === 'GERENTE';
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [local, setLocal] = useState('');
  const [estado, setEstado] = useState('');

  const params = {};
  if (desde) params.desde = desde;
  if (hasta) params.hasta = hasta;
  if (local) params.local = local;
  if (estado) params.estado = estado;

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['reportes', params],
    queryFn: () => api.get('/reportes', { params }).then((r) => r.data),
  });

  const total = pedidos.reduce((s, p) => s + p.costoTotal, 0);
  const senas = pedidos.reduce((s, p) => s + p.sena, 0);
  const saldo = total - senas;

  async function downloadExcel() {
    const response = await api.get('/reportes/excel', { params, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes-incollege.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <button onClick={downloadExcel} className="btn-primary">⬇ Exportar Excel</button>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <label className="label">Local</label>
            <select className="input" value={local} onChange={(e) => setLocal(e.target.value)}>
              <option value="">Todos</option>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className={`grid gap-4 ${esGerente ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <div className="card text-center">
          <p className="text-gray-400 text-sm">Total pedidos</p>
          <p className="text-2xl font-bold text-white">{pedidos.length}</p>
        </div>
        {esGerente && (
          <>
            <div className="card text-center">
              <p className="text-gray-400 text-sm">Cobrado</p>
              <p className="text-2xl font-bold text-brand">${senas.toLocaleString('es-AR')}</p>
            </div>
            <div className="card text-center">
              <p className="text-gray-400 text-sm">Saldo pendiente</p>
              <p className="text-2xl font-bold text-yellow-400">${saldo.toLocaleString('es-AR')}</p>
            </div>
          </>
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-3 pr-3">Cliente</th>
                <th className="pb-3 pr-3">Colegio</th>
                <th className="pb-3 pr-3">Local</th>
                <th className="pb-3 pr-3">Estado</th>
                <th className="pb-3 pr-3 text-right">Total</th>
                <th className="pb-3 pr-3 text-right">Seña</th>
                <th className="pb-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/pedidos/${p.id}`)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                >
                  <td className="py-2.5 pr-3 text-white">{p.nombre} {p.apellido}</td>
                  <td className="py-2.5 pr-3 text-gray-400">{p.colegio}</td>
                  <td className="py-2.5 pr-3 text-gray-400">{LOCAL_LABEL[p.localTomoPedido]}</td>
                  <td className="py-2.5 pr-3"><EstadoBadge estado={p.estado} /></td>
                  <td className="py-2.5 pr-3 text-right text-white">${p.costoTotal.toLocaleString('es-AR')}</td>
                  <td className="py-2.5 pr-3 text-right text-green-400">${p.sena.toLocaleString('es-AR')}</td>
                  <td className="py-2.5 text-right text-yellow-400">${(p.costoTotal - p.sena).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pedidos.length === 0 && (
            <p className="text-center py-8 text-gray-500">Sin pedidos para los filtros seleccionados</p>
          )}
        </div>
      )}
    </div>
  );
}
