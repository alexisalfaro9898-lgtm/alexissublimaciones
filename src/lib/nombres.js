const DECODIFICACIONES = [
  [/u00f1/gi, 'ñ'],
  [/u00d1/gi, 'Ñ'],
  [/u00b0/gi, '°'],
  [/u00ba/gi, 'º'],
  [/u00aa/gi, 'ª'],
  [/u2019/gi, "'"],
  [/u2018/gi, "'"],
  [/u2013/gi, '–'],
  [/u2014/gi, '—'],
  [/u00e9/gi, 'é'],
  [/u00ed/gi, 'í'],
  [/u00f3/gi, 'ó'],
  [/u00e1/gi, 'á'],
  [/u00fa/gi, 'ú']
]

export function decodificarNombre(nombre) {
  if (!nombre) return nombre

  let resultado = nombre

  for (const [patron, reemplazo] of DECODIFICACIONES) {
    resultado = resultado.replace(patron, reemplazo)
  }

  return resultado
}

const PATRONES_GENERICOS = [
  /^(jarro|jarra|taza)\s+(sublimable|para\s+sublimar|sublimaci[oó]n|sublimar)(?:\s+|$)/i,
  /^mate\s+(sublimable|para\s+sublimar|m[aá]gico)(?:\s+|$)/i
]

const REEMPLAZO_GENERICO = {
  jarro: 'Taza personalizada',
  jarra: 'Taza personalizada',
  taza: 'Taza personalizada',
  mate: 'Mate personalizado'
}

const FEMENINOS = {
  mágico: 'mágica',
  magico: 'magica',
  cromado: 'cromada',
  cónico: 'cónica',
  conico: 'conica',
  dorado: 'dorada',
  plateado: 'plateada',
  esmerilado: 'esmerilada',
  térmico: 'térmica',
  termico: 'termica',
  chapado: 'chapada',
  blanco: 'blanca',
  negro: 'negra',
  rojo: 'roja',
  amarillo: 'amarilla',
  rosado: 'rosada',
  celeste: 'celeste',
  verde: 'verde',
  naranja: 'naranja',
  azul: 'azul',
  violeta: 'violeta',
  turquesa: 'turquesa',
  gris: 'gris',
  fucsia: 'fucsia',
  bordeaux: 'bordeaux',
  coral: 'coral',
  beige: 'beige'
}

const PALABRAS_SIN_ADAPTAR = new Set([
  'interior',
  'color',
  'de'
])

function adaptarGenero(texto) {
  if (!texto) return texto

  const palabras = texto.split(' ')
  const resultado = []

  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i]
    const anterior = i > 0 ? palabras[i - 1].toLowerCase() : ''

    const clave = palabra.toLowerCase()
    const femenino = FEMENINOS[clave]

    if (
      femenino &&
      !PALABRAS_SIN_ADAPTAR.has(anterior) &&
      anterior !== 'y'
    ) {
      const primera =
        palabra.charAt(0) === palabra.charAt(0).toUpperCase()
          ? femenino.charAt(0).toUpperCase() + femenino.slice(1)
          : femenino

      resultado.push(primera)
      continue
    }

    resultado.push(palabra)
  }

  return resultado.join(' ')
}

export function normalizarNombreComercial(nombre) {
  if (!nombre) return null

  const texto = decodificarNombre(nombre)
    .replace(/\s+/g, ' ')
    .trim()

  if (!texto) return null

  let resto = null
  let tipo = null

  for (const patron of PATRONES_GENERICOS) {
    const coincidencia = texto.match(patron)

    if (coincidencia) {
      const prefijo = coincidencia[0]
      const generico = prefijo.split(/\s+/)[0].toLowerCase()
      tipo = REEMPLAZO_GENERICO[generico] || null
      resto = texto.slice(prefijo.length).trim()
      break
    }
  }

  if (!tipo) return null

  const caracteristicas = adaptarGenero(resto)

  const nombreNuevo = caracteristicas
    ? `${tipo} ${caracteristicas}`
    : tipo

  if (nombreNuevo === texto) return null

  return nombreNuevo
}

export function proponerNormalizaciones(productos) {
  return (productos || [])
    .map((producto) => {
      const propuesto = normalizarNombreComercial(
        producto.nombre
      )

      if (!propuesto) return null

      const actual =
        decodificarNombre(producto.nombre_comercial) ||
        producto.nombre_comercial

      if (
        actual &&
        actual.trim().toLowerCase() === propuesto.toLowerCase()
      ) {
        return null
      }

      return {
        id: producto.id,
        nombre: producto.nombre,
        actual: actual || '',
        propuesto
      }
    })
    .filter(Boolean)
}