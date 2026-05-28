import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };

export default function Recibo({ pedido }) {
  const saldo = pedido.costoTotal - pedido.sena;
  const prendas = pedido.prendas || [];

  return (
    <div className="print-only bg-white text-black p-8 rounded-xl border border-gray-200 font-sans max-w-md mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
        <img src="https://i.imgur.com/M4GONM5.png" alt="InCollege" width="48" height="48" style={{ borderRadius: '10px', objectFit: 'contain' }} />
        <div>
          <p className="text-xl font-bold text-gray-900">InCollege</p>
          <p className="text-sm text-gray-500">Local {LOCAL_LABEL[pedido.localTomoPedido]}</p>
        </div>
      </div>

      <h2 className="text-base font-bold text-gray-700 mb-4 uppercase tracking-wide">Comprobante de pedido</h2>

      <table className="w-full text-sm mb-4">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500 w-1/2">Nombre</td>
            <td className="py-1.5 font-medium">{pedido.nombre} {pedido.apellido}</td>
          </tr>
          {pedido.apodo && (
            <tr className="border-b border-gray-100">
              <td className="py-1.5 text-gray-500">Apodo</td>
              <td className="py-1.5 font-medium">"{pedido.apodo}"</td>
            </tr>
          )}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Colegio</td>
            <td className="py-1.5 font-medium">{pedido.colegio}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">N° Contrato</td>
            <td className="py-1.5 font-medium">{pedido.numeroContrato}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Prendas</td>
            <td className="py-1.5 font-medium">
              {prendas.map((p) => `${p.tipo} T:${p.talle}`).join(' · ')}
            </td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">Entrega comprometida</td>
            <td className="py-1.5 font-medium">
              {format(new Date(pedido.fechaEntregaComprometida), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Costo total</span>
          <span className="font-semibold">${pedido.costoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Seña abonada</span>
          <span className="font-semibold text-green-600">-${pedido.sena.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between text-base border-t border-gray-200 pt-2 mt-2">
          <span className="font-bold">Saldo restante</span>
          <span className="font-bold text-gray-900">${saldo.toLocaleString('es-AR')}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
        Este comprobante no tiene validez fiscal · Conservarlo hasta retirar el pedido
      </p>
      <p className="text-xs text-gray-300 text-center mt-1">
        Fecha: {format(new Date(), "dd/MM/yyyy HH:mm")}
      </p>
    </div>
  );
}
