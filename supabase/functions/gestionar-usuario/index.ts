// =====================================================================
// DIDIAL CRM · GESTIONAR USUARIOS (Supabase Edge Function)
// =====================================================================
// Crea o elimina usuarios del equipo. Solo lo puede invocar un admin.
//   { action: 'crear',      nombre, email, password, rol, activo }
//   { action: 'actualizar', usuario_id, nombre?, rol?, activo?, password? }  (v27)
//   { action: 'eliminar', id }
//
// Despliegue:  supabase functions deploy gestionar-usuario
// Requiere secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const ROLES = ['admin', 'vendedor', 'asesor_toyota', 'asesor_multimarca', 'supervisor', 'postventa', 'jefe_taller', 'tecnico', 'coordinador_adquisiciones', 'encargado_bodega', 'asistente_administrativo', 'asistente_bodega']
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // --- Verifica que quien llama sea admin ---
    const auth = req.headers.get('Authorization') || ''
    const cliente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } })
    const { data: userData } = await cliente.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return json({ error: 'No autenticado' }, 401)

    const { data: perfil } = await service.from('usuarios')
      .select('rol, empresa_id').eq('id', uid).single()
    if (!perfil || perfil.rol !== 'admin') return json({ error: 'Solo un administrador puede gestionar usuarios' }, 403)

    const body = await req.json()
    const action = body.action

    if (action === 'crear') {
      const { nombre, email, password, rol, activo } = body
      if (!nombre || !email || !password) return json({ error: 'Faltan nombre, email o contraseña' }, 400)
      if (!ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)

      // 1. Crea el usuario de autenticación
      const { data: created, error: e1 } = await service.auth.admin.createUser({
        email, password, email_confirm: true
      })
      if (e1 || !created?.user) return json({ error: 'No se pudo crear el acceso: ' + (e1?.message || '') }, 400)

      // 2. Crea su perfil en la tabla usuarios (misma empresa del admin)
      const { error: e2 } = await service.from('usuarios').insert({
        id: created.user.id, empresa_id: perfil.empresa_id,
        nombre, email, rol, activo: activo !== false
      })
      if (e2) {
        await service.auth.admin.deleteUser(created.user.id) // revierte
        return json({ error: 'No se pudo crear el perfil: ' + e2.message }, 400)
      }
      return json({ ok: true, id: created.user.id })
    }

    // v27: edición de usuarios desde administración (nombre, rol, estado y
    // opcionalmente restablecer la contraseña vía auth admin API).
    if (action === 'actualizar') {
      const { usuario_id, nombre, rol, activo, password } = body
      if (!usuario_id) return json({ error: 'Falta usuario_id' }, 400)
      if (rol && !ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)
      const campos: Record<string, unknown> = {}
      if (nombre) campos.nombre = nombre
      if (rol) campos.rol = rol
      if (typeof activo === 'boolean') campos.activo = activo
      if (Object.keys(campos).length) {
        const { error: eU } = await service.from('usuarios').update(campos)
          .eq('id', usuario_id).eq('empresa_id', perfil.empresa_id)
        if (eU) return json({ error: 'No se pudo actualizar el perfil: ' + eU.message }, 400)
      }
      if (password) {
        if (String(password).length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
        const { error: eP } = await service.auth.admin.updateUserById(usuario_id, { password })
        if (eP) return json({ error: 'No se pudo cambiar la contraseña: ' + eP.message }, 400)
      }
      return json({ ok: true })
    }

    if (action === 'eliminar') {
      const { id } = body
      if (!id) return json({ error: 'Falta id' }, 400)
      if (id === uid) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
      await service.from('usuarios').delete().eq('id', id)
      await service.auth.admin.deleteUser(id)
      return json({ ok: true })
    }

    return json({ error: 'Acción no reconocida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
