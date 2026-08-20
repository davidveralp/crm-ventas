/* Regla propia: detecta el uso de una variable `const`/`let` antes de su
   declaración EN EL MISMO NIVEL del cuerpo de un componente, que es el caso que
   revienta durante el render. Ignora las referencias dentro de funciones
   anidadas (callbacks, useEffect, manejadores), que se ejecutan después y por
   eso son inofensivas — es lo que generaba los 10 falsos positivos. */
module.exports = {
  rules: {
    'tdz-en-render': {
      create(context) {
        return {
          'FunctionDeclaration, ArrowFunctionExpression'(node) {
            const cuerpo = node.body
            if (!cuerpo || cuerpo.type !== 'BlockStatement') return
            const declaradas = new Map()
            cuerpo.body.forEach((sent, i) => {
              if (sent.type !== 'VariableDeclaration') return
              if (sent.kind === 'var') return
              sent.declarations.forEach((d) => {
                const ids = []
                const rec = (p) => {
                  if (!p) return
                  if (p.type === 'Identifier') ids.push(p.name)
                  else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => rec(pr.value || pr.argument))
                  else if (p.type === 'ArrayPattern') p.elements.forEach(rec)
                }
                rec(d.id)
                ids.forEach((n) => { if (!declaradas.has(n)) declaradas.set(n, i) })
              })
            })
            // Ahora: cada inicializador de nivel superior no puede usar algo declarado después
            cuerpo.body.forEach((sent, i) => {
              if (sent.type !== 'VariableDeclaration') return
              sent.declarations.forEach((d) => {
                if (!d.init) return
                const visitar = (n, dentroDeFuncion) => {
                  if (!n || typeof n.type !== 'string') return
                  let esFn = /FunctionExpression|ArrowFunctionExpression|FunctionDeclaration/.test(n.type)
                  // Excepción: los callbacks de los métodos de array corren
                  // durante el render, así que la variable debe existir ya.
                  // Es el caso de `MOVIL.filter((m) => tieneFeature(...))`.
                  if (esFn && n.__inmediato) esFn = false
                  // Ignorar propiedades de objeto: en `p.veh`, `veh` no es una
                  // variable sino una clave. Mismo caso para `{ veh: ... }`.
                  const esPropiedad = n.__esPropiedad === true
                  if (n.type === 'Identifier' && !dentroDeFuncion && !esPropiedad) {
                    const j = declaradas.get(n.name)
                    if (j !== undefined && j > i) {
                      context.report({ node: n,
                        message: `'${n.name}' se usa en el render antes de declararse (línea posterior). Provoca pantalla en blanco.` })
                    }
                  }
                  for (const k of Object.keys(n)) {
                    if (k === 'parent') continue
                    // La parte derecha de `obj.prop` y las claves de objeto no
                    // son referencias a variables.
                    if (n.type === 'MemberExpression' && k === 'property' && !n.computed) continue
                    if (n.type === 'Property' && k === 'key' && !n.computed) continue
                    const v = n[k]
                    const INMEDIATOS = ['map','filter','reduce','forEach','find','findIndex','some','every','sort','flatMap']
                    if (n.type === 'CallExpression' && k === 'arguments' &&
                        n.callee?.type === 'MemberExpression' &&
                        INMEDIATOS.includes(n.callee.property?.name)) {
                      v.forEach((c) => { if (c) c.__inmediato = true })
                    }
                    if (Array.isArray(v)) v.forEach((c) => visitar(c, dentroDeFuncion || esFn))
                    else if (v && typeof v.type === 'string') visitar(v, dentroDeFuncion || esFn)
                  }
                }
                visitar(d.init, false)
              })
            })
          }
        }
      }
    }
  }
}
