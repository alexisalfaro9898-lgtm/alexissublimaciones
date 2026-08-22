import { supabase } from './supabase'

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

export const RECARGO_NOMBRE_TEXTO = 2
export const RECARGO_BOLSITA = 30

export const ORIGENES_PEDIDO = ['web', 'whatsapp', 'admin']

export const TAMANO_MAX_ARCHIVO = 5 * 1024 * 1024
export const TIPOS_ARCHIVO_PERMITIDOS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/avif'
]

/* ============================================================
   ESTADOS
   Los estados canónicos viven en la tabla estados_pedido.
   pedidos.estado guarda el slug (sin acentos, en minúsculas)
   para mantener consistencia con los datos existentes.
   ============================================================ */

function slugificar(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

let estadosCache = null
let estadosCachePromesa = null

export async function cargarEstados() {
  if (estadosCache) {
    return estadosCache
  }

  if (!estadosCachePromesa) {
    estadosCachePromesa = (async () => {
      const { data, error } = await supabase
        .from('estados_pedido')
        .select('id, nombre, descripcion, color, orden')
        .eq('activo', true)
        .order('orden')

      if (error) {
        console.error('Error cargando estados:', error)
        return []
      }

      estadosCache = (data || []).map((estado) => ({
        id: estado.id,
        nombre: estado.nombre,
        valor: slugificar(estado.nombre),
        descripcion: estado.descripcion,
        color: estado.color,
        orden: estado.orden
      }))

      return estadosCache
    })()
  }

  return estadosCachePromesa
}

export function etiquetaEstado(valor) {
  const mapa = {
    nuevo: 'Nuevo',
    revisar: 'Revisar',
    diseno: 'Diseño',
    aprobacion: 'Aprobación',
    produccion: 'Producción',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  }
  return mapa[valor] || valor || 'Sin estado'
}

/* ============================================================
   PRECIOS
   ============================================================ */

export function precioBaseItem(item, tipo) {
  const precioVariante = Number(item?.variante?.precio)
  if (Number.isFinite(precioVariante) && precioVariante > 0) {
    return precioVariante
  }

  const producto = item?.producto || {}

  if (tipo === 'mayorista') {
    const precioMayorista = Number(producto.precio_mayorista)
    if (Number.isFinite(precioMayorista) && precioMayorista > 0) {
      return precioMayorista
    }

    const precioSugerido = Number(producto.precio_mayorista_sugerido)
    if (Number.isFinite(precioSugerido) && precioSugerido > 0) {
      return precioSugerido
    }
  }

  const precioProducto = Number(
    producto.precio_publico ??
    producto.precio ??
    0
  )

  return Number.isFinite(precioProducto) ? precioProducto : 0
}

export function calcularSubtotalItem(item, tipo) {
  return (
    precioBaseItem(item, tipo) *
    Math.max(1, Number(item?.cantidad) || 1)
  )
}

export function calcularRecargoItem(item, tipo) {
  let recargo = 0

  if (item?.nombreActivo && item?.nombre?.trim()) {
    recargo += precioBaseItem(item, tipo) * (RECARGO_NOMBRE_TEXTO / 100)
  }

  if (item?.bolsitaActivo) {
    recargo += RECARGO_BOLSITA
  }

  return recargo * Math.max(1, Number(item?.cantidad) || 1)
}

/* ============================================================
   CREACIÓN DE PEDIDO
   La transacción completa (pedidos, pedido_detalles,
   pedido_personalizaciones, pedido_respuestas, historial_pedidos)
   vive en la RPC crear_pedido() del servidor: UNA sola llamada,
   cualquier fallo revierte todo sin dejar huérfanos.
   Los archivos se suben a Storage DESPUÉS de la RPC, con los ids
   reales del pedido y del detalle. Si la subida falla, el pedido
   ya existe y se informa el error.
   ============================================================ */

function validarItems(items, tipo) {
  if (!items || items.length === 0) {
    return 'Agregá al menos un producto.'
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const producto = item?.producto

    if (!producto || producto.id === null || producto.id === undefined || producto.id === '') {
      return `El producto del renglón ${i + 1} no es válido.`
    }

    if (!producto.nombre) {
      return `El producto del renglón ${i + 1} no tiene nombre válido.`
    }

    const cantidad = Number(item?.cantidad)
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      return `La cantidad del renglón ${i + 1} debe ser mayor o igual a 1.`
    }

    const precio = precioBaseItem(item, tipo)
    if (!(precio > 0)) {
      return `El producto "${producto.nombre}" no tiene precio configurado. Asignale un precio o una variante con precio.`
    }

    if (item?.imagenArchivo) {
      const archivo = item.imagenArchivo

      if (!TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
        return `El archivo "${archivo.name}" no tiene un formato permitido. Usá PNG, JPG, WEBP, GIF, BMP, HEIC, HEIF o AVIF.`
      }

      if (archivo.size > TAMANO_MAX_ARCHIVO) {
        return `El archivo "${archivo.name}" supera el máximo de 5 MB.`
      }
    }
  }

  return null
}

export async function crearPedido({ cliente, items, tipo, origen = 'web' }) {
  if (!cliente?.nombre?.trim()) {
    throw new Error('Ingresá el nombre del cliente.')
  }

  if (!ORIGENES_PEDIDO.includes(origen)) {
    throw new Error(`Origen de pedido inválido: "${origen}".`)
  }

  const errorValidacion = validarItems(items, tipo)
  if (errorValidacion) {
    throw new Error(errorValidacion)
  }

  const { data, error } = await supabase.rpc('crear_pedido', {
    p_cliente_nombre: cliente.nombre.trim(),
    p_cliente_telefono: cliente.telefono?.trim() || null,
    p_cliente_email: cliente.email?.trim().toLowerCase() || null,
    p_cliente_id: cliente.clienteId || cliente.id || null,
    p_origen: origen,
    p_tipo: tipo || null,
    p_items: (items || []).map((item) => ({
      producto_id: item.producto.id,
      variante_id: item.variante?.id ?? null,
      cantidad: Math.max(1, Number(item.cantidad) || 1),
      detalle: item.detalleActivo ? (item.detalle || '').trim() : null,
      nombre_activo: Boolean(item.nombreActivo),
      nombre: (item.nombre || '').trim(),
      bolsita_activo: Boolean(item.bolsitaActivo),
      respuestas: (item.respuestas || []).map((respuesta) => ({
        pregunta_id: respuesta.preguntaId,
        tipo: respuesta.tipo,
        valor_texto: respuesta.valorTexto ?? null,
        valor_booleano: respuesta.valorBooleano ?? null,
        valor_numero: respuesta.valorNumero ?? null,
        opcion_id: respuesta.opcionId ?? null
      }))
    }))
  })

  if (error) {
    throw error
  }

  const pedido = data?.pedido
  const detalles = data?.detalles || []

  if (!pedido?.id) {
    throw new Error('No se pudo crear el pedido.')
  }

  /* ==================================================
     ARCHIVOS (fuera de la transacción)
     La RPC ya creó el pedido. La subida a Storage se
     hace con los ids reales; si falla, el pedido queda
     creado y se informa el error del adjunto.
     ================================================== */

  let errorArchivo = null

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]

    if (!(item.imagenActivo && item.imagenArchivo)) {
      continue
    }

    const detalle = detalles[i]

    if (!detalle?.id) {
      errorArchivo = errorArchivo || new Error('No se pudo asociar la imagen al pedido.')
      continue
    }

    try {
      const extension = item.imagenArchivo.name.includes('.')
        ? item.imagenArchivo.name.split('.').pop().toLowerCase()
        : null

      const rutaStorage =
        `pedidos/${pedido.id}/detalle-${detalle.id}/${Date.now()}-${item.imagenArchivo.name}`

      const { error: errorUpload } = await supabase.storage
        .from('pedido-archivos')
        .upload(rutaStorage, item.imagenArchivo, {
          upsert: false,
          contentType: item.imagenArchivo.type || 'application/octet-stream'
        })

      if (errorUpload) {
        throw errorUpload
      }

      const { error: errorArchivoRegistro } = await supabase
        .from('pedido_archivos')
        .insert({
          pedido_id: pedido.id,
          pedido_detalle_id: detalle.id,
          nombre_original: item.imagenArchivo.name,
          ruta_storage: rutaStorage,
          tipo_archivo: item.imagenArchivo.type || 'application/octet-stream',
          extension,
          tamano_bytes: item.imagenArchivo.size || 0
        })

      if (errorArchivoRegistro) {
        throw errorArchivoRegistro
      }

      const { error: errorPersonalizacion } = await supabase
        .from('pedido_personalizaciones')
        .insert({
          pedido_detalle_id: detalle.id,
          nombre: 'Foto o imagen',
          descripcion: 'Imagen proporcionada por el cliente.',
          valor_texto: item.imagenArchivo.name,
          recargo_porcentaje: 0,
          recargo_fijo: 0,
          recargo_calculado: 0
        })

      if (errorPersonalizacion) {
        throw errorPersonalizacion
      }
    } catch (errorItem) {
      errorArchivo = errorArchivo || errorItem
    }
  }

  if (errorArchivo) {
    console.error('Pedido creado, pero falló la subida de imagen:', errorArchivo)
    throw new Error(
      'El pedido se creó correctamente, pero la imagen no se pudo subir. Podés adjuntarla más tarde desde el detalle del pedido.'
    )
  }

  return pedido
}

/* ============================================================
   STOCK
   ============================================================ */

export async function validarStockDisponible(items) {
  const productosIds = []
  const variantesIds = []

  for (const item of items || []) {
    const productoId = Number(item?.producto?.id)
    if (Number.isFinite(productoId) && productoId > 0) {
      productosIds.push(productoId)
    }

    const varianteId = Number(item?.variante?.id)
    if (Number.isFinite(varianteId) && varianteId > 0) {
      variantesIds.push(varianteId)
    }
  }

  if (productosIds.length === 0) {
    return []
  }

  const [respuestaProductos, respuestaVariantes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, nombre_comercial, stock')
      .in('id', productosIds),

    variantesIds.length > 0
      ? supabase
          .from('producto_variantes')
          .select('id, producto_id, nombre, stock')
          .in('id', variantesIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (respuestaProductos.error) {
    throw respuestaProductos.error
  }

  if (respuestaVariantes.error) {
    throw respuestaVariantes.error
  }

  const stockPorProducto = new Map(
    (respuestaProductos.data || []).map((p) => [p.id, p])
  )
  const stockPorVariante = new Map(
    (respuestaVariantes.data || []).map((v) => [v.id, v])
  )

  return (items || []).map((item) => {
    const productoId = Number(item?.producto?.id)
    const varianteId = Number(item?.variante?.id)
    const solicitado = Math.max(1, Number(item?.cantidad) || 1)

    const stockProducto = stockPorProducto.get(productoId)
    const stockVariante =
      Number.isFinite(varianteId) && varianteId > 0
        ? stockPorVariante.get(varianteId)
        : null

    const disponibleEnVariante =
      stockVariante?.stock === null ||
      stockVariante?.stock === undefined
        ? null
        : Number(stockVariante.stock)

    const disponibleEnProducto =
      stockProducto?.stock === null ||
      stockProducto?.stock === undefined
        ? null
        : Number(stockProducto.stock)

    const stockEfectivo =
      disponibleEnVariante !== null
        ? disponibleEnVariante
        : disponibleEnProducto

    return {
      productoId,
      nombre:
        stockProducto?.nombre_comercial ||
        stockProducto?.nombre ||
        item?.producto?.nombre ||
        'Producto sin nombre',
      varianteId: Number.isFinite(varianteId) && varianteId > 0 ? varianteId : null,
      varianteNombre: stockVariante?.nombre || item?.variante?.nombre || null,
      solicitado,
      disponible: stockEfectivo,
      stockDefinido: stockEfectivo !== null,
      ok: stockEfectivo === null || stockEfectivo >= solicitado
    }
  })
}

/* ============================================================
   ARCHIVOS
   ============================================================ */

export async function cargarArchivosDePedido(pedidoId) {
  const { data, error } = await supabase
    .from('pedido_archivos')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('id')

  if (error) {
    console.error('Error cargando archivos:', error)
    return []
  }

  return data || []
}

export async function obtenerUrlFirmada(archivo, expiracionSegundos = 3600) {
  if (!archivo?.ruta_storage) {
    return null
  }

  const { data, error } = await supabase.storage
    .from('pedido-archivos')
    .createSignedUrl(archivo.ruta_storage, expiracionSegundos)

  if (error || !data?.signedUrl) {
    console.error('Error generando URL firmada:', error)
    return null
  }

  return data.signedUrl
}
