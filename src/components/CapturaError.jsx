import { Component } from 'react'

/* ============================================================================
   Captura de errores de render
   ----------------------------------------------------------------------------
   Cuando un componente lanza una excepción durante el render, React desmonta
   todo el árbol y la pantalla queda en blanco, sin ninguna pista visible.

   Esto ya pasó cuatro veces en el proyecto (v80, v83, v92, v95) y en cada una
   hubo que ir descartando causas a ciegas. Este componente atrapa el error y
   lo MUESTRA: el nombre, el mensaje y dónde ocurrió.

   No arregla nada por sí solo. Convierte una pantalla en blanco en un
   diagnóstico, que es lo que faltaba.
   ========================================================================== */

export default class CapturaError extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('Error de render capturado:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    // La primera línea del stack suele señalar el archivo y la línea reales
    const origen = (info?.componentStack || '').trim().split('\n')[0]?.trim()

    return (
      <div className="p-4">
        <div className="card p-4 border-l-4 max-w-2xl" style={{ borderLeftColor: '#e0382b' }}>
          <h2 className="font-semibold text-ink mb-1">Esta pantalla no se pudo cargar</h2>
          <p className="text-sm text-slate-500 mb-3">
            El resto de la aplicación sigue funcionando. Copia el detalle de abajo y pásalo
            para que se corrija.
          </p>

          <div className="rounded-lg p-3 text-xs font-mono overflow-x-auto"
               style={{ background: '#fdecea', color: '#8a1f18' }}>
            <div><strong>{error.name}:</strong> {error.message}</div>
            {origen && <div className="mt-1 opacity-80">en {origen}</div>}
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="btn-soft text-sm" onClick={() => this.setState({ error: null, info: null })}>
              Reintentar
            </button>
            <button className="btn-soft text-sm" onClick={() => window.location.assign('/')}>
              Volver al inicio
            </button>
            <button className="btn-soft text-sm"
                    onClick={() => {
                      const txt = `${error.name}: ${error.message}\n${info?.componentStack || ''}`
                      navigator.clipboard?.writeText(txt)
                    }}>
              Copiar detalle
            </button>
          </div>

          {info?.componentStack && (
            <details className="mt-3">
              <summary className="text-[11px] text-slate-400 cursor-pointer">Ver traza completa</summary>
              <pre className="text-[10px] text-slate-500 mt-1 overflow-x-auto whitespace-pre-wrap">
                {info.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
