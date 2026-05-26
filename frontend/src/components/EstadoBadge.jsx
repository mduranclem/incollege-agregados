const CONFIG = {
  PENDIENTE_APROBACION: { label: 'Pendiente', color: 'bg-yellow-500/15 text-yellow-400' },
  RECHAZADO:            { label: 'Rechazado', color: 'bg-red-500/15 text-red-400' },
  EN_PRODUCCION:        { label: 'En producción', color: 'bg-blue-500/15 text-blue-400' },
  TERMINADO:            { label: 'Terminado', color: 'bg-brand/15 text-brand' },
  RECIBIDO_EN_LOCAL:    { label: 'En local', color: 'bg-purple-500/15 text-purple-400' },
  ENTREGADO:            { label: 'Entregado', color: 'bg-green-500/15 text-green-400' },
};

export default function EstadoBadge({ estado }) {
  const c = CONFIG[estado] || { label: estado, color: 'bg-gray-500/15 text-gray-400' };
  return <span className={`badge ${c.color}`}>{c.label}</span>;
}
