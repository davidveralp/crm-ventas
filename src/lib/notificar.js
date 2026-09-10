import { supabase } from './supabase'

// Crea una notificación para un usuario directo o para todos los de un rol.
// notificar({ titulo, cuerpo, url, usuario_id }) o { ..., rol: 'jefe_taller' }
export async function notificar({ titulo, cuerpo = '', url = '', usuario_id = null, rol = null, empresa_id }) {
  try {
    await supabase.from('notificaciones').insert({
      empresa_id, usuario_id, rol_destino: rol, titulo, cuerpo, url
    })
  } catch { /* la notificación nunca debe romper el flujo principal */ }
}

// Sonido de alerta (dos tonos) sin archivos externos.
let ctx
export function sonarAlerta() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const beep = (freq, t0, dur) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0)
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur)
      o.connect(g); g.connect(ctx.destination)
      o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05)
    }
    beep(880, 0, 0.18); beep(1174, 0.2, 0.22)
  } catch { }
}


/**
 * Aviso a un rol, con respaldo a administración.
 *
 * La campanita lee con `rol_destino.eq.<mi rol>`, así que si NADIE tiene ese
 * rol el aviso se guarda y no lo ve nadie: existe en la tabla y desaparece.
 * Pasó con `coordinador_adquisiciones` cuando el usuario de Víctor Tello
 * todavía no estaba creado.
 *
 * Esta función verifica si hay alguien con el rol; si no, avisa a admin.
 */
export async function avisarRol({ empresa_id, rol, titulo, cuerpo = '', url = '' }) {
  const { count } = await supabase.from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('rol', rol).eq('activo', true)

  const destino = count ? rol : 'admin'
  const aviso = count ? titulo : `[sin ${rol}] ${titulo}`

  await supabase.from('notificaciones').insert({
    empresa_id, rol_destino: destino, titulo: aviso, cuerpo, url
  })
  return { entregado_a: destino, habia_destinatario: !!count }
}
