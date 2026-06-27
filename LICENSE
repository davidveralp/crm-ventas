import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Mapeo flexible de encabezados -> columnas de la tabla clientes
const ALIAS = {
  nombre: ['nombre', 'cliente', 'razon social', 'razón social'],
  email: ['email', 'correo', 'e-mail'],
  telefono: ['telefono', 'teléfono', 'fono', 'celular', 'whatsapp'],
  ciudad: ['ciudad', 'comuna'],
  tipo: ['tipo'],
  facturacion_total: ['facturacion', 'facturación', 'total', 'total $', 'monto'],
  ticket_promedio: ['ticket', 'ticket promedio', 'ticket $'],
  num_ot: ['ot', 'ots', 'visitas', 'n ot'],
  ultima_visita: ['ultima visita', 'última visita', 'ult. visita', 'últ. visita'],
  accion_recomendada: ['accion recomendada', 'acción recomendada', 'accion']
}

const SEG_ALIAS = {
  'flota / empresa': 'flota_empresa', 'flota': 'flota_empresa', 'empresa': 'flota_empresa',
  'vip activo': 'vip_activo', 'vip': 'vip_activo',
  'alto valor en riesgo': 'alto_valor_riesgo', 'en riesgo': 'alto_valor_riesgo',
  'leal recurrente': 'leal_recurrente',
  'prometedor': 'prometedor',
  'dormido recuperable': 'dormido_recuperable', 'dormido': 'dormido_recuperable',
  'ocasional': 'ocasional'
}

function detectar(encabezado) {
  const h = encabezado.trim().toLowerCase()
  for (const [col, alias] of Object.entries(ALIAS))
    if (alias.includes(h)) return col
  if (h === 'segmento') return 'segmento'
  return null
}

function limpiarNumero(v) {
  if (typeof v === 'number') return v
  if (!v) return 0
  return Number(String(v).replace(/[^0-9.-]/g, '')) || 0
}

export default function Datos() {
  const { perfil, esAdmin } = useAuth()
  const [preview, setPreview] = useState(null)
  const [filas, setFilas] = useState([])
  const [estado, setEstado] = useState('')

  function procesarFilas(rows) {
    if (!rows.length) return
    const cols = Object.keys(rows[0])
    const mapa = {}
    cols.forEach((c) => { const d = detectar(c); if (d) mapa[c] = d })

    const limpias = rows.map((r) => {
      const o = { empresa_id: perfil.empresa_id }
      for (const [orig, col] of Object.entries(mapa)) {
        let val = r[orig]
        if (['facturacion_total', 'ticket_promedio', 'num_ot'].includes(col))
          val = limpiarNumero(val)
        else if (col === 'segmento')
          val = SEG_ALIAS[String(val || '').trim().toLowerCase()] || null
        else val = val ? String(val).trim() : null
        o[col] = val
      }
      if (!esAdmin) o.vendedor_id = perfil.id
      return o
    }).filter((o) => o.nombre)

    setFilas(limpias)
    setPreview({ total: rows.length, validas: limpias.length, columnas: Object.values(mapa) })
  }

  function onCSV(e) {
    const file = e.target.files[0]; if (!file) return
    Papa.parse(file, { header: true, skipEmptyLines: true,
      complete: (res) => procesarFilas(res.data) })
  }

  function onXLSX(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      procesarFilas(XLSX.utils.sheet_to_json(ws, { defval: '' }))
    }
    reader.readAsArrayBuffer(file)
  }

  async function importar() {
    setEstado('Importando…')
    let ok = 0
    for (let i = 0; i < filas.length; i += 100) {
      const lote = filas.slice(i, i + 100)
      const { error } = await supabase.from('clientes').insert(lote)
      if (!error) ok += lote.length
    }
    setEstado(`Listo: ${ok} clientes importados.`)
    setPreview(null); setFilas([])
  }

  async function exportar() {
    setEstado('Generando archivo…')
    const { data } = await supabase.from('clientes')
      .select('nombre,email,telefono,ciudad,tipo,segmento,facturacion_total,ticket_promedio,num_ot,ultima_visita')
    const ws = XLSX.utils.json_to_sheet(data || [])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes-didial-${new Date().toISOString().slice(0,10)}.xlsx`)
    setEstado('')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-ink">Importar / Exportar</h1>
        <p className="text-sm text-slate-500">Carga tu base de Google Sheets (exportada a CSV o Excel) o descarga la cartera actual</p>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-ink">Importar clientes</h3>
        <p className="text-sm text-slate-500">
          Desde Google Sheets: <span className="font-medium">Archivo → Descargar → CSV o Excel</span>, luego súbelo aquí.
          Detectamos automáticamente columnas como nombre, teléfono, correo, facturación y segmento.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="btn-soft cursor-pointer">
            Subir CSV
            <input type="file" accept=".csv" className="hidden" onChange={onCSV} />
          </label>
          <label className="btn-soft cursor-pointer">
            Subir Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onXLSX} />
          </label>
        </div>

        {preview && (
          <div className="rounded-lg bg-paper p-4 text-sm space-y-2">
            <div>Filas leídas: <span className="font-medium">{preview.total}</span></div>
            <div>Clientes válidos (con nombre): <span className="font-medium">{preview.validas}</span></div>
            <div className="text-xs text-slate-500">
              Columnas detectadas: {preview.columnas.join(', ') || 'ninguna'}
            </div>
            <button className="btn-primary mt-2" onClick={importar}>
              Importar {preview.validas} clientes
            </button>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-ink">Exportar cartera</h3>
        <p className="text-sm text-slate-500">Descarga todos tus clientes en formato Excel.</p>
        <button className="btn-soft" onClick={exportar}>Descargar Excel</button>
      </div>

      {estado && <p className="text-sm text-deep font-medium">{estado}</p>}
    </div>
  )
}
