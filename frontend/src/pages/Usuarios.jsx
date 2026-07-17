import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import Modal from '../components/Modal';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';

const LOCALES = ['PELLEGRINI','SUR','NORTE','FISHERTON','SANTA_FE','SAN_NICOLAS','FABRICA'];
const LOCAL_LABEL = { PELLEGRINI:'Pellegrini',SUR:'Sur',NORTE:'Norte',FISHERTON:'Fisherton',SANTA_FE:'Santa Fe',SAN_NICOLAS:'San Nicolás',FABRICA:'Fábrica' };
const ROL_LABEL = { ADMINISTRADOR:'Administrador', VENDEDOR:'Vendedor', PRODUCCION:'Producción', GERENTE:'Gerente' };
const ROL_COLOR = { ADMINISTRADOR:'bg-brand/15 text-brand', VENDEDOR:'bg-blue-500/15 text-blue-400', PRODUCCION:'bg-purple-500/15 text-purple-400', GERENTE:'bg-yellow-500/15 text-yellow-400' };

const INIT_FORM = { nombre:'', email:'', password:'', rol:'VENDEDOR', localPrincipal:'' };

export default function Usuarios() {
  const qc = useQueryClient();
  const { usuario: usuarioActual } = useAuth();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(INIT_FORM);
  const [error, setError] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = useMutation({
    mutationFn: (data) => editando
      ? api.put(`/usuarios/${editando.id}`, data).then((r) => r.data)
      : api.post('/usuarios', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); cerrarModal(); },
    onError: (err) => setError(err.response?.data?.error || 'Error'),
  });

  const desactivar = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const eliminar = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}/eliminar`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setConfirmarEliminar(null); },
    onError: (err) => setError(err.response?.data?.error || 'Error al eliminar el usuario'),
  });

  function abrirCrear() {
    setEditando(null);
    setForm(INIT_FORM);
    setError('');
    setModal(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, localPrincipal: u.localPrincipal || '' });
    setError('');
    setModal(true);
  }

  function cerrarModal() { setModal(false); setEditando(null); setError(''); }

  function handleSubmit(e) {
    e.preventDefault();
    const data = { nombre: form.nombre, email: form.email, rol: form.rol, localPrincipal: form.localPrincipal || null };
    if (form.password) data.password = form.password;
    if (!editando) data.password = form.password;
    guardar.mutate(data);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <button onClick={abrirCrear} className="btn-primary">+ Nuevo usuario</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-10"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Rol</th>
                <th className="pb-3 pr-4">Local</th>
                <th className="pb-3 pr-4">Estado</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 pr-4 text-white font-medium">{u.nombre}</td>
                  <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${ROL_COLOR[u.rol]}`}>{ROL_LABEL[u.rol]}</span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{u.localPrincipal ? LOCAL_LABEL[u.localPrincipal] : '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${u.activo ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(u)} className="text-xs text-gray-400 hover:text-white">Editar</button>
                      {u.activo && u.id !== usuarioActual?.id && (
                        <button onClick={() => desactivar.mutate(u.id)} className="text-xs text-orange-400 hover:text-orange-300">Desactivar</button>
                      )}
                      {u.id !== usuarioActual?.id && (
                        <button onClick={() => setConfirmarEliminar(u)} className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={cerrarModal} title={editando ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">{editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <PasswordInput value={form.password} onChange={(e) => set('password', e.target.value)} required={!editando} minLength={6} />
          </div>
          <div>
            <label className="label">Rol *</label>
            <select className="input" value={form.rol} onChange={(e) => set('rol', e.target.value)} required>
              <option value="VENDEDOR">Vendedor</option>
              <option value="PRODUCCION">Producción</option>
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="GERENTE">Gerente</option>
            </select>
          </div>
          <div>
            <label className="label">Local principal</label>
            <select className="input" value={form.localPrincipal} onChange={(e) => set('localPrincipal', e.target.value)}>
              <option value="">Sin local asignado</option>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCAL_LABEL[l]}</option>)}
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={cerrarModal}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal open={!!confirmarEliminar} onClose={() => setConfirmarEliminar(null)} title="Eliminar usuario">
        <div className="space-y-4">
          <p className="text-gray-300">
            ¿Estás seguro que querés eliminar a <span className="text-white font-semibold">{confirmarEliminar?.nombre}</span>?
          </p>
          <p className="text-gray-500 text-sm">
            Esta acción es permanente. El historial del usuario se conservará con su nombre.
          </p>
          <div className="flex gap-3">
            <button
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => eliminar.mutate(confirmarEliminar.id)}
              disabled={eliminar.isPending}
            >
              {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button className="btn-secondary" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
