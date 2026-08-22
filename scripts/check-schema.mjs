#!/usr/bin/env node
/* ============================================================================
   Verifica que cada columna que el frontend escribe exista en alguna migración.
   ----------------------------------------------------------------------------
   Motivo: este error se repitió tres veces (migración 54 con `traccion` en
   ordenes_trabajo, v86 con `estado` en clientes, v87 con `chasis` en
   vehiculos). Siempre el mismo síntoma: "Could not find the 'X' column of 'Y'
   in the schema cache", y siempre descubierto por el usuario en producción,
   porque ni Vite ni ESLint miran el esquema de la base.

   Se ejecuta con `npm run check:schema`, y forma parte de `npm run build`.
   ========================================================================== */

import fs from 'fs'
import path from 'path'

const raiz = process.cwd()
const dirSql = path.join(raiz, 'database')
const dirSrc = path.join(raiz, 'src')

/* ---- 1. Columnas declaradas por las migraciones ---- */
const declaradas = {}
const anota = (tabla, col) => {
  declaradas[tabla] = declaradas[tabla] || new Set()
  declaradas[tabla].add(col)
}

for (const f of fs.readdirSync(dirSql).filter((x) => x.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join(dirSql, f), 'utf8')

  // create table ... ( col tipo, ... )
  for (const m of sql.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\);/gi)) {
    const tabla = m[1].toLowerCase()
    for (const linea of m[2].split('\n')) {
      const c = linea.match(/^\s{2,}(\w+)\s+[a-z]/i)
      if (c && !/^(primary|foreign|unique|check|constraint)$/i.test(c[1])) anota(tabla, c[1].toLowerCase())
    }
  }
  // alter table ... add column [if not exists] col
  for (const m of sql.matchAll(/alter table\s+(?:public\.)?(\w+)([\s\S]*?);/gi)) {
    const tabla = m[1].toLowerCase()
    for (const c of m[2].matchAll(/add column\s+(?:if not exists\s+)?(\w+)/gi)) anota(tabla, c[1].toLowerCase())
  }
}

/* ---- 2. Columnas que el frontend escribe ---- */
const archivos = []
const recorrer = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.jsx?$/.test(e.name)) archivos.push(p)
  }
}
recorrer(dirSrc)

const problemas = []
for (const f of archivos) {
  const src = fs.readFileSync(f, 'utf8')
  // .from('tabla').insert({...}) / .update({...}) / .upsert({...})
  const re = /from\(\s*['"](\w+)['"]\s*\)\s*(?:\r?\n\s*)?\.\s*(insert|update|upsert)\(\s*(\{)/g
  let m
  while ((m = re.exec(src))) {
    const tabla = m[1].toLowerCase()
    if (!declaradas[tabla]) continue          // tabla desconocida: no se juzga
    // recorrer el objeto contando llaves para encontrar su cierre real
    let i = m.index + m[0].length - 1, prof = 0, fin = i
    for (; i < src.length; i++) {
      if (src[i] === '{') prof++
      else if (src[i] === '}') { prof--; if (prof === 0) { fin = i; break } }
    }
    const obj = src.slice(m.index + m[0].length - 1, fin + 1)
    // claves de primer nivel del objeto
    let p2 = 0
    for (let j = 0; j < obj.length; j++) {
      if (obj[j] === '{' || obj[j] === '[' || obj[j] === '(') p2++
      else if (obj[j] === '}' || obj[j] === ']' || obj[j] === ')') p2--
      // Ignorar objetos anidados dentro de una llamada a función: son
      // argumentos de helpers (notificar, etc.), no columnas de la tabla.
      else if (p2 === 1 && !/[a-zA-Z_$]\s*$/.test(obj.slice(Math.max(0, j - 40), j).replace(/\s*\{\s*$/, ''))) {
        const resto = obj.slice(j)
        const k = resto.match(/^\s*(?:\/\/[^\n]*\n\s*)*(\w+)\s*:/)
        if (k) {
          const col = k[1].toLowerCase()
          const RESERVADAS = ['empresa_id', 'null', 'true', 'false', 'undefined']
          if (!declaradas[tabla].has(col) && !RESERVADAS.includes(col)) {
            problemas.push({ archivo: path.relative(raiz, f), tabla, col })
          }
          j += k[0].length - 1
        }
      }
    }
  }
}

/* ---- 3. Resultado ---- */
const unicos = [...new Map(problemas.map((p) => [p.tabla + '.' + p.col, p])).values()]
if (!unicos.length) {
  console.log('✓ Esquema: todas las columnas escritas existen en las migraciones.')
  process.exit(0)
}
console.error('\n✖ Columnas escritas que NO existen en ninguna migración:\n')
for (const p of unicos) {
  console.error(`   ${p.tabla}.${p.col}`.padEnd(42) + p.archivo)
}
console.error('\n  Provocan "Could not find the \'columna\' column ... in the schema cache"')
console.error('  al ejecutar. Agrega la migración o corrige el nombre.\n')
process.exit(1)
