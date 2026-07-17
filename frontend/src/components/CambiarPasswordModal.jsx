import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import Modal from './Modal';
import PasswordInput from './PasswordInput';

const INIT = { passwordActual: '', passwordNueva: '', confirmarPassword: '' };

export default function CambiarPasswordModal({ open, onClose }) {
  const [form, setForm] = useState(INIT);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.put('/auth/cambiar-password', {
      passwordActual: form.passwordActual,
      passwordNueva: form.passwordNueva,
    }).then((r) => r.data),
    onSuccess: () => { setOk(true); setForm(INIT); },
    onError: (err) => setError(err.response?.data?.error || 'Error al cambiar la contraseña'),
  });

  function handleClose() {
    setForm(INIT);
    setError('');
    setOk(false);
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.passwordNueva !== form.confirmarPassword) {
      return setError('Las contraseñas nuevas no coinciden');
    }
    if (form.passwordNueva.length < 6) {
      return setError('La nueva contraseña debe tener al menos 6 caracteres');
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Cambiar contraseña" size="sm">
      {ok ? (
        <div className="space-y-4">
          <p className="text-sm text-green-400">✅ Contraseña actualizada correctamente</p>
          <button onClick={handleClose} className="btn-primary">Cerrar</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Contraseña actual *</label>
            <PasswordInput
              value={form.passwordActual}
              onChange={(e) => set('passwordActual', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Nueva contraseña *</label>
            <PasswordInput
              value={form.passwordNueva}
              onChange={(e) => set('passwordNueva', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Confirmar nueva contraseña *</label>
            <PasswordInput
              value={form.confirmarPassword}
              onChange={(e) => set('confirmarPassword', e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleClose}>Cancelar</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
