import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Pill } from '../components/UI'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [auditoria, setAuditoria] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: u }, { data: a }] = await Promise.all([
      supabase.from('usuarios').select('*').order('rol'),
      supabase.from('auditoria').select('*, usuarios(nombre)')
        .order('ocurrido_en', { ascending: false }).limit(30)
    ])
    setUsuarios(u || []); setAuditoria(a || [])
  }

  async function toggleActivo(u) {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id)
    cargar()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-ink">Usuarios</h1>
        <p className="text-sm text-slate-500">Equipo comercial y registro de cambios</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3">Correo</th>
              <th className="text-left font-medium px-4 py-3">Rol</th>
              <th className="text-right font-medium px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-ink">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <Pill color={u.rol === 'admin' ? '#1C4357' : '#185FA5'}>{u.rol}</Pill>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActivo(u)}
                    className={`pill ${u.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-sky/10 px-4 py-3 text-sm text-deep">
        Para crear un usuario nuevo: agrégalo en Supabase → Authentication → Users,
        y luego vuelve a ejecutar el script <span className="font-mono">04_vincular_usuarios.sql</span>
        añadiendo su fila.
      </div>

      <div>
        <h3 className="font-semibold text-ink mb-3">Registro de cambios (auditoría)</h3>
        <div className="card divide-y divide-slate-100">
          {auditoria.length ? auditoria.map((a) => (
            <div key={a.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
              <span className="text-slate-600">
                <span className="font-medium text-ink">{a.usuarios?.nombre || 'Sistema'}</span>
                {' '}cambió {a.campo} de un cliente
              </span>
              <span className="text-xs text-slate-400">
                {new Date(a.ocurrido_en).toLocaleString('es-CL')}
              </span>
            </div>
          )) : <div className="px-4 py-4 text-sm text-slate-400 text-center">
            Sin cambios registrados todavía.
          </div>}
        </div>
      </div>
    </div>
  )
}
