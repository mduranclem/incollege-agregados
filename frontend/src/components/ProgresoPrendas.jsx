const ETAPA_LABEL = {
  CORTE: 'Corte',
  UNION: 'Unión',
  BORDADO: 'Bordado',
  ESTAMPADO: 'Estampado',
  CONFECCION: 'Confección',
  TERMINADO: 'Terminado',
  ENTREGA_A_LOCAL: 'Entrega a local',
};

export default function ProgresoPrendas({ prendas, compact = false }) {
  if (!prendas?.length) return null;

  return (
    <div className="space-y-2">
      {prendas.map((prenda) => {
        const total = prenda.etapas.length;
        const completas = prenda.etapas.filter((e) => e.completada).length;
        const pct = total ? Math.round((completas / total) * 100) : 0;

        return (
          <div key={prenda.id}>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span className="font-medium text-gray-300">
                {prenda.tipo === 'REMERA' ? '👕' : '🧥'} {prenda.tipo} T:{prenda.talle}
              </span>
              <span>{completas}/{total} etapas</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {!compact && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {prenda.etapas.map((e) => (
                  <span
                    key={e.id}
                    title={ETAPA_LABEL[e.nombre]}
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      e.completada
                        ? 'bg-brand/20 text-brand'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {ETAPA_LABEL[e.nombre]}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
