import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import EstadoBadge from '../components/EstadoBadge';

const LOCAL_LABEL = {
  PELLEGRINI: 'Pellegrini', SUR: 'Sur', NORTE: 'Norte', FISHERTON: 'Fisherton',
  SANTA_FE: 'Santa Fe', SAN_NICOLAS: 'San Nicolás', FABRICA: 'Fábrica',
};

function MetricCard({ label, value, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card text-left hover:border-brand/40 transition-colors cursor-pointer w-full"
    >
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/pedidos/dashboard').then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center mt-20"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const { tomados = 0, enProduccion = 0, terminados = 0, entregados = 0, proximos = [] } = data || {};

  const hoy = new Date();
  const en7dias = addDays(hoy, 7);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total tomados" value={tomados} color="text-white" onClick={() => navigate('/en-proceso')} />
        <MetricCard label="En producción" value={enProduccion} color="text-blue-400" onClick={() => navigate('/en-proceso?estado=EN_PRODUCCION')} />
        <MetricCard label="Terminados" value={terminados} color="text-brand" onClick={() => navigate('/terminados')} />
        <MetricCard label="Entregados" value={entregados} color="text-green-400" onClick={() => navigate('/historial')} />
      </div>

      {/* Alertas de vencimiento */}
      {proximos.filter((p) => isBefore(new Date(p.fechaEntregaComprometida), en7dias)).length > 0 && (
        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <h2 className="text-sm font-semibold text-yellow-400 mb-3">⚠️ Entregas próximas a vencer (1 semana)</h2>
          <div className="space-y-2">
            {proximos
              .filter((p) => isBefore(new Date(p.fechaEntregaComprometida), en7dias))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/pedidos/${p.id}`)}
                  className="w-full text-left flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm text-white">
                    {p.nombre} {p.apellido} — {p.colegio}
                  </span>
                  <span className="text-xs text-yellow-400">
                    {format(new Date(p.fechaEntregaComprometida), 'dd/MM/yyyy')}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico por mes */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Pedidos por mes</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buildChartData(data?.pedidosPorMes)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#2EC4A0' }}
              />
              <Bar dataKey="total" fill="#2EC4A0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Próximas entregas */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Próximas entregas</h2>
          {proximos.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin entregas próximas</p>
          ) : (
            <div className="space-y-2">
              {proximos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/pedidos/${p.id}`)}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.nombre} {p.apellido}</p>
                    <p className="text-xs text-gray-400">{p.colegio} · {LOCAL_LABEL[p.localTomoPedido]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{format(new Date(p.fechaEntregaComprometida), 'dd MMM', { locale: es })}</p>
                    <EstadoBadge estado={p.estado} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildChartData(rawData) {
  if (!rawData?.length) return [];
  return rawData.map(({ mes, total }) => ({
    mes: format(parseISO(`${mes}-01`), 'MMM yy', { locale: es }),
    total: Number(total),
  }));
}
