import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env')
}

export const supabase = createClient(url, key)

// Trae TODAS las filas paginando de a 1000 (Supabase limita a 1000 por consulta).
// modify recibe el query y puede aplicar filtros/orden antes de paginar.
export async function fetchAllRows(table, select = '*', modify = (q) => q) {
  const PAGE = 1000
  let from = 0
  let all = []
  for (;;) {
    const { data, error } = await modify(supabase.from(table).select(select))
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error || !data) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}
