// =====================================================================
// DIDIAL CRM · REPORTE DIARIO (Supabase Edge Function)
// =====================================================================
// Se ejecuta todos los días a las 08:00 hora de La Serena (UTC-4).
// Arma un resumen de la cartera + actividad y lo envía por email al
// administrador y gerencia vía Brevo.
//
// Despliegue:  supabase functions deploy reporte-diario
// Programación: ver docs/DEPLOY.md (pg_cron o panel de Supabase)
//
// Variables de entorno requeridas (Project Settings > Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   BREVO_API_KEY            (clave de la API de Brevo)
//   REPORTE_DESTINATARIOS    (correos separados por coma)
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
    .format(n || 0)

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hoy = new Date().toISOString().slice(0, 10)
  const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10)

  // --- Métricas ---
  const { count: totalClientes } = await supabase
    .from('clientes').select('*', { count: 'exact', head: true })

  const { data: actAyer } = await supabase
    .from('actividades').select('tipo, resultado').eq('fecha', ayer)

  const { data: citasHoy } = await supabase
    .from('actividades')
    .select('hora, tipo, clientes(nombre)')
    .eq('fecha', hoy).order('hora')

  const agendamientos = (actAyer || []).filter((a) => a.resultado === 'agendado').length

  // --- HTML del correo ---
  const citasHtml = (citasHoy || []).map((c) =>
    `<li>${c.hora ? c.hora.slice(0, 5) : '—'} · ${c.tipo} · ${(c as any).clientes?.nombre || ''}</li>`
  ).join('') || '<li>Sin actividades agendadas para hoy.</li>'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0A0B0C">
      <div style="background:#1C4357;color:#fff;padding:20px;border-radius:12px 12px 0 0">
        <h2 style="margin:0">DIDIAL · Reporte diario</h2>
        <p style="margin:4px 0 0;color:#7FB3C7">${hoy}</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 12px 12px">
        <h3>Resumen</h3>
        <ul>
          <li>Clientes en cartera: <b>${totalClientes ?? 0}</b></li>
          <li>Actividades de ayer: <b>${(actAyer || []).length}</b></li>
          <li>Agendamientos logrados ayer: <b>${agendamientos}</b></li>
        </ul>
        <h3>Agenda de hoy</h3>
        <ul>${citasHtml}</ul>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px">
          Generado automáticamente por DIDIAL CRM.
        </p>
      </div>
    </div>`

  // --- Envío vía Brevo ---
  const destinatarios = (Deno.env.get('REPORTE_DESTINATARIOS') || '')
    .split(',').map((e) => e.trim()).filter(Boolean)
    .map((email) => ({ email }))

  const brevoKey = Deno.env.get('BREVO_API_KEY')

  if (brevoKey && destinatarios.length) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'DIDIAL CRM', email: 'administracion@didial.cl' },
        to: destinatarios,
        subject: `DIDIAL · Reporte diario ${hoy}`,
        htmlContent: html
      })
    })
    if (!r.ok) {
      return new Response(JSON.stringify({ error: await r.text() }), { status: 500 })
    }
  }

  return new Response(JSON.stringify({ ok: true, fecha: hoy, enviado_a: destinatarios.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
