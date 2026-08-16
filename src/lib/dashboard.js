import { supabase } from './supabase'


/* ============================================================
   DASHBOARD: CONSULTAS CENTRALIZADAS
   ============================================================

   Reglas de negocio (documentadas):

   - VENTAS VÁLIDAS: pedidos con estado 'listo' o 'entregado'.
     'cancelado' se excluye. El resto se muestra como "pendiente".
   - FACTURACIÓN  = suma de subtotal de líneas de ventas válidas.
   - COSTO        = suma de costo_unitario * cantidad (costo histórico
                    capturado al crear el pedido).
   - GANANCIA     = facturación - costo. Solo donde hay costo; si una
                    línea no tiene costo, su ganancia es NULL (no se
                    asume 0) y su facturación se reporta como
                    "facturación sin costo".
   - MARGEN %     = ganancia / facturación * 100 (solo si hay costo).
   - TICKET PROMEDIO = facturación / pedidos.

   UMBRALES (configurables en configuracion):
   - dashboard_stock_bajo  (default 5): stock <= valor = "stock bajo".
   - dashboard_stock_inmovilizado (default 20): stock >= valor y sin
     ventas recientes = "stock inmovilizado".
   - dashboard_margen_objetivo (default 30): margen mínimo deseado.
   ============================================================ */

export const PERIODOS = [
  { valor: 'hoy', nombre: 'Hoy' },
  { valor: 'ayer', nombre: 'Ayer' },
  { valor: '7d', nombre: 'Últimos 7 días' },
  { valor: '30d', nombre: 'Últimos 30 días' },
  { valor: 'mes', nombre: 'Este mes' },
  { valor: 'mes_anterior', nombre: 'Mes anterior' },
  { valor: 'anio', nombre: 'Este año' },
  { valor: 'anio_anterior', nombre: 'Año anterior' },
  { valor: 'personalizado', nombre: 'Período personalizado' }
]

export async function cargarEstadosPedido() {
  const { data, error } = await supabase
    .from('estados_pedido')
    .select('id, nombre, activo')
    .order('orden')

  if (error) throw error

  return (data || []).map((e) => ({
    ...e,
    valor: e.nombre.toLowerCase()
  }))
}

export function rangoPeriodo(periodo, desdePersonalizado, hastaPersonalizado) {
  const ahora = new Date()
  const inicio = (d) => {
    const f = new Date(ahora)
    f.setDate(f.getDate() - d)
    f.setHours(0, 0, 0, 0)
    return f
  }

  switch (periodo) {
    case 'hoy': {
      const d = new Date(ahora)
      d.setHours(0, 0, 0, 0)
      return { desde: d, hasta: new Date(ahora.getTime() + 60000) }
    }
    case 'ayer': {
      const d = new Date(ahora)
      d.setDate(d.getDate() - 1)
      d.setHours(0, 0, 0, 0)
      const h = new Date(d)
      h.setDate(h.getDate() + 1)
      return { desde: d, hasta: h }
    }
    case '7d':
      return { desde: inicio(6), hasta: new Date(ahora.getTime() + 60000) }
    case '30d':
      return { desde: inicio(29), hasta: new Date(ahora.getTime() + 60000) }
    case 'mes': {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return { desde: d, hasta: new Date(ahora.getTime() + 60000) }
    }
    case 'mes_anterior': {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
      const h = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return { desde: d, hasta: h }
    }
    case 'anio': {
      const d = new Date(ahora.getFullYear(), 0, 1)
      return { desde: d, hasta: new Date(ahora.getTime() + 60000) }
    }
    case 'anio_anterior': {
      const d = new Date(ahora.getFullYear() - 1, 0, 1)
      const h = new Date(ahora.getFullYear(), 0, 1)
      return { desde: d, hasta: h }
    }
    case 'personalizado': {
      const desde = desdePersonalizado ? new Date(desdePersonalizado) : inicio(29)
      const hasta = hastaPersonalizado ? new Date(hastaPersonalizado) : new Date(ahora.getTime() + 60000)
      if (!hastaPersonalizado) hasta.setHours(23, 59, 59, 999)
      else hasta.setHours(23, 59, 59, 999)
      return { desde, hasta }
    }
    default:
      return { desde: inicio(29), hasta: new Date(ahora.getTime() + 60000) }
  }
}

const num = (v) => Number(v ?? 0)

/* ============================================================
   MÉTRICAS PRINCIPALES + COMPARACIÓN
   ============================================================ */

export async function cargarResumen(filtros) {
  const { desde, hasta } = rangoPeriodo(
    filtros.periodo,
    filtros.desdePersonalizado,
    filtros.hastaPersonalizado
  )

  const { data, error } = await supabase.rpc('dashboard_resumen', {
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
    p_categoria_id: filtros.categoriaId || null,
    p_producto_id: filtros.productoId || null,
    p_cliente: filtros.cliente || null,
    p_estado: filtros.estado || null
  })

  if (error) throw error

  const actual = data?.actual || {}
  const anterior = data?.anterior || {}

  const facturacion = num(actual.facturacion)
  const costo = num(actual.costo)
  const ganancia = num(actual.ganancia)
  const pedidos = num(actual.pedidos)
  const unidades = num(actual.unidades)

  return {
    desde,
    hasta,
    facturacion,
    costo,
    ganancia,
    margen: facturacion > 0 ? (ganancia / facturacion) * 100 : null,
    pedidos,
    unidades,
    ticket: pedidos > 0 ? facturacion / pedidos : 0,
    facturacionSinCosto: num(actual.facturacion_sin_costo),
    itemsConCosto: num(actual.items_con_costo),
    itemsTotal: num(actual.items_total),
    coberturaCosto:
      num(actual.items_total) > 0
        ? (num(actual.items_con_costo) / num(actual.items_total)) * 100
        : null,
    comparacion: {
      facturacion: num(anterior.facturacion),
      ganancia: num(anterior.ganancia),
      pedidos: num(anterior.pedidos),
      unidades: num(anterior.unidades)
    },
    pendientes: data?.pendientes || { pedidos: 0, facturacion: 0 },
    cancelados: num(data?.cancelados)
  }
}

export function variacionPorcentual(actual, anterior) {
  if (anterior === 0) {
    return actual > 0 ? 100 : 0
  }
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

/* ============================================================
   EVOLUCIÓN (gráfico)
   ============================================================ */

export async function cargarEvolucion(filtros, agrupacion = 'dia') {
  const { desde, hasta } = rangoPeriodo(
    filtros.periodo,
    filtros.desdePersonalizado,
    filtros.hastaPersonalizado
  )

  const { data, error } = await supabase.rpc('dashboard_evolucion', {
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
    p_agrupacion: agrupacion,
    p_categoria_id: filtros.categoriaId || null,
    p_producto_id: filtros.productoId || null
  })

  if (error) throw error
  return (data || []).map((p) => ({
    ...p,
    facturacion: num(p.facturacion),
    costo: num(p.costo),
    ganancia: num(p.ganancia),
    pedidos: num(p.pedidos)
  }))
}

/* ============================================================
   RANKINGS (productos, categorías, clientes)
   ============================================================ */

export async function cargarTop(tipo, filtros, limite = 30) {
  const { desde, hasta } = rangoPeriodo(
    filtros.periodo,
    filtros.desdePersonalizado,
    filtros.hastaPersonalizado
  )

  const { data, error } = await supabase.rpc('dashboard_top', {
    p_tipo: tipo,
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
    p_limite: limite,
    p_categoria_id: filtros.categoriaId || null,
    p_producto_id: filtros.productoId || null
  })

  if (error) throw error
  return (data || []).map((r) => ({
    ...r,
    unidades: num(r.unidades),
    facturacion: num(r.facturacion),
    costo: num(r.costo),
    ganancia: num(r.ganancia),
    pedidos: num(r.pedidos),
    margen: r.margen === null || r.margen === undefined ? null : num(r.margen)
  }))
}

/* ============================================================
   STOCK
   ============================================================ */

export async function cargarStock() {
  const { data, error } = await supabase
    .from('productos')
    .select(
      'id, nombre, nombre_comercial, codigo_interno, categoria_id, precio_costo, precio_publico, stock, activo, proveedor_nombre'
    )

  if (error) throw error
  return data || []
}

export async function cargarUmbrales() {
  const claves = [
    'dashboard_stock_bajo',
    'dashboard_stock_inmovilizado',
    'dashboard_margen_objetivo'
  ]

  const { data, error } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', claves)

  if (error) throw error

  const mapa = {}
  for (const item of data || []) {
    mapa[item.clave] = item.valor
  }

  return {
    stockBajo: num(mapa.dashboard_stock_bajo) || 5,
    stockInmovilizado: num(mapa.dashboard_stock_inmovilizado) || 20,
    margenObjetivo: num(mapa.dashboard_margen_objetivo) || 30
  }
}

/* ============================================================
   PROVEEDORES
   ============================================================ */

export async function cargarProveedores() {
  const { data, error } = await supabase
    .from('proveedores')
    .select(
      'id, nombre, telefono, email, activo, ultima_sincronizacion, porcentaje_alerta_precio'
    )
    .order('nombre')

  if (error) throw error

  const proveedores = data || []

  const { data: relaciones, error: errorRel } = await supabase
    .from('producto_proveedores')
    .select(
      'id, producto_id, proveedor_id, precio_compra, precio_anterior, es_principal, disponible, ultimo_cambio_precio'
    )

  if (errorRel) throw errorRel

  return {
    proveedores,
    relaciones: relaciones || []
  }
}

/* ============================================================
   HISTORIAL DE COSTOS (proveedor_historial)
   ============================================================ */

export async function cargarHistorialCostos() {
  const { data, error } = await supabase
    .from('proveedor_historial')
    .select(
      'id, producto_proveedor_id, tipo_cambio, precio_anterior, precio_nuevo, stock_anterior, stock_nuevo, fecha_cambio, origen, observaciones'
    )
    .order('fecha_cambio', { ascending: false })
    .limit(300)

  if (error) throw error
  return data || []
}

/* ============================================================
   COMPRAS
   ============================================================ */

export async function cargarCompras() {
  const { data, error } = await supabase
    .from('compras')
    .select(
      'id, proveedor_id, fecha, comprobante, observaciones, created_at'
    )
    .order('fecha', { ascending: false })
    .limit(200)

  if (error) throw error

  const compras = data || []

  const ids = compras.map((c) => c.id)
  const { data: items, error: errorItems } = await supabase
    .from('compra_items')
    .select(
      'id, compra_id, producto_id, variante_id, cantidad, costo_unitario, costo_total'
    )
    .in('compra_id', ids.length ? ids : [0])

  if (errorItems) throw errorItems

  return { compras, items: items || [] }
}

/* ============================================================
   OBJETIVOS (se guardan en configuracion, clave/valor)
   ============================================================ */

const CLAVES_OBJETIVOS = [
  'objetivo_facturacion',
  'objetivo_ganancia',
  'objetivo_pedidos',
  'objetivo_margen'
]

export async function cargarObjetivos() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', CLAVES_OBJETIVOS)

  if (error) throw error

  const mapa = {}
  for (const item of data || []) {
    mapa[item.clave] = item.valor
  }

  return {
    facturacion: num(mapa.objetivo_facturacion),
    ganancia: num(mapa.objetivo_ganancia),
    pedidos: num(mapa.objetivo_pedidos),
    margen: num(mapa.objetivo_margen) || 30
  }
}

export async function guardarObjetivos(objetivos) {
  const filas = CLAVES_OBJETIVOS.map((clave) => ({
    clave,
    valor: String(num(objetivos[clave.replace('objetivo_', '')]) || ''),
    descripcion: `Objetivo del dashboard: ${clave}`
  }))

  for (const fila of filas) {
    const { error } = await supabase
      .from('configuracion')
      .upsert(fila, { onConflict: 'clave' })

    if (error) throw error
  }
}

/* ============================================================
   EXPORTACIÓN CSV
   ============================================================ */

export function exportarCSV(nombreArchivo, filas) {
  if (!filas || filas.length === 0) return

  const columnas = Object.keys(filas[0])

  const escapar = (valor) => {
    const texto = valor === null || valor === undefined ? '' : String(valor)
    if (/[",\n;]/.test(texto)) {
      return '"' + texto.replace(/"/g, '""') + '"'
    }
    return texto
  }

  const contenido =
    columnas.join(';') +
    '\n' +
    filas.map((fila) => columnas.map((c) => escapar(fila[c])).join(';')).join('\n')

  const blob = new Blob(['\ufeff' + contenido], {
    type: 'text/csv;charset=utf-8;'
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

/* ============================================================
   FORMATEO
   ============================================================ */

export const formatearDinero = (valor) =>
  '$' +
  Number(valor || 0).toLocaleString('es-UY', {
    maximumFractionDigits: 0
  })

export const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  const f = new Date(fecha)
  return f.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}