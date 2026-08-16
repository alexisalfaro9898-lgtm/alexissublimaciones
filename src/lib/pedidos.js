import { supabase } from './supabase'

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

export const RECARGO_NOMBRE_TEXTO = 2
export const RECARGO_BOLSITA = 30

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
   Escribe el pedido completo usando las tablas reales:
   - pedidos
   - pedido_detalles
   - pedido_personalizaciones
   - pedido_respuestas
   - pedido_archivos (+ Storage bucket pedido-archivos)
   - historial_pedidos (estado inicial)
   Si algo falla, elimina el pedido huérfano antes de propagar el error.
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

export async function crearPedido({ cliente, items, tipo }) {
  if (!cliente?.nombre?.trim()) {
    throw new Error('Ingresá el nombre del cliente.')
  }

  const errorValidacion = validarItems(items, tipo)
  if (errorValidacion) {
    throw new Error(errorValidacion)
  }

  const subtotal = items.reduce(
    (total, item) => total + calcularSubtotalItem(item, tipo),
    0
  )

  const recargos = items.reduce(
    (total, item) => total + calcularRecargoItem(item, tipo),
    0
  )

  const total = subtotal + recargos

  let pedidoId = null
  const rutasSubidas = []

  try {
    /* ==================================================
       PEDIDO
       ================================================== */

    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_nombre: cliente.nombre.trim(),
        cliente_telefono: cliente.telefono?.trim() || null,
        cliente_email: cliente.email?.trim().toLowerCase() || null,
        estado: 'nuevo',
        subtotal,
        recargos,
        total
      })
      .select('*')
      .single()

    if (errorPedido) {
      throw errorPedido
    }

    pedidoId = pedido.id

    /* ==================================================
       NÚMERO DE PEDIDO
       ================================================== */

    if (!pedido.numero_pedido) {
      const { error: errorNumero } = await supabase
        .from('pedidos')
        .update({ numero_pedido: pedido.id })
        .eq('id', pedido.id)

      if (errorNumero) {
        throw errorNumero
      }
    }

    /* ==================================================
       ESTADO INICIAL EN HISTORIAL
       ================================================== */

    const estados = await cargarEstados()
    const estadoNuevo = estados.find((e) => e.valor === 'nuevo')

    if (estadoNuevo) {
      const { error: errorHistorial } = await supabase
        .from('historial_pedidos')
        .insert({
          pedido_id: pedido.id,
          estado_anterior_id: null,
          estado_nuevo_id: estadoNuevo.id,
          accion: 'Pedido creado',
          comentario: 'El pedido se creó correctamente.'
        })

      if (errorHistorial) {
        throw errorHistorial
      }
    }

    /* ==================================================
       DETALLES, PERSONALIZACIONES, RESPUESTAS Y ARCHIVOS
       ================================================== */

    for (const item of items) {
      const productoId = item.producto.id
      const precio = precioBaseItem(item, tipo)
      const cantidad = Math.max(1, Number(item.cantidad) || 1)
      const detalleTexto = item.detalleActivo ? (item.detalle || '').trim() : null

      const { data: detalle, error: errorDetalle } = await supabase
        .from('pedido_detalles')
        .insert({
          pedido_id: pedido.id,
          producto_id: productoId,
          producto_nombre: item.producto.nombre,
          codigo_interno: item.producto.codigo_interno || null,
          cantidad,
          precio_unitario: precio,
          subtotal: precio * cantidad,
          costo_unitario: item.producto.precio_costo ?? null,
          detalle: detalleTexto
        })
        .select()
        .single()

      if (errorDetalle) {
        throw errorDetalle
      }

      /* ----- Variante ----- */

      if (item.variante?.nombre) {
        const { error: errorVariante } = await supabase
          .from('pedido_personalizaciones')
          .insert({
            pedido_detalle_id: detalle.id,
            nombre: 'Variante',
            descripcion: 'Opción elegida por el cliente.',
            valor_texto: item.variante.nombre,
            recargo_porcentaje: 0,
            recargo_fijo: 0,
            recargo_calculado: 0
          })

        if (errorVariante) {
          throw errorVariante
        }
      }

      /* ----- Nombre o texto ----- */

      if (item.nombreActivo && item.nombre.trim()) {
        const recargo = precio * (RECARGO_NOMBRE_TEXTO / 100)

        const { error } = await supabase
          .from('pedido_personalizaciones')
          .insert({
            pedido_detalle_id: detalle.id,
            nombre: 'Nombre o texto',
            descripcion: 'El cliente agregó un nombre, frase o texto.',
            valor_texto: item.nombre.trim(),
            recargo_porcentaje: RECARGO_NOMBRE_TEXTO,
            recargo_fijo: 0,
            recargo_calculado: recargo * cantidad
          })

        if (error) {
          throw error
        }
      }

      /* ----- Detalle del diseño ----- */

      if (item.detalleActivo && detalleTexto) {
        const { error } = await supabase
          .from('pedido_personalizaciones')
          .insert({
            pedido_detalle_id: detalle.id,
            nombre: 'Detalle del diseño',
            descripcion: 'Información proporcionada por el cliente para realizar el diseño.',
            valor_texto: detalleTexto,
            recargo_porcentaje: 0,
            recargo_fijo: 0,
            recargo_calculado: 0
          })

        if (error) {
          throw error
        }
      }

      /* ----- Bolsita ----- */

      if (item.bolsitaActivo) {
        const { error } = await supabase
          .from('pedido_personalizaciones')
          .insert({
            pedido_detalle_id: detalle.id,
            nombre: 'Bolsita de regalo',
            descripcion: 'Presentación del producto en bolsita de regalo.',
            valor_texto: 'Sí',
            recargo_porcentaje: 0,
            recargo_fijo: RECARGO_BOLSITA,
            recargo_calculado: RECARGO_BOLSITA * cantidad
          })

        if (error) {
          throw error
        }
      }

      /* ----- Respuestas a preguntas ----- */

      if (Array.isArray(item.respuestas)) {
        for (const respuesta of item.respuestas) {
          if (!respuesta?.preguntaId) {
            continue
          }

          const filaRespuesta = {
            pedido_item_id: detalle.id,
            pregunta_id: respuesta.preguntaId
          }

          if (respuesta.tipo === 'booleano') {
            filaRespuesta.valor_booleano = Boolean(respuesta.valorBooleano)
          } else if (respuesta.tipo === 'numero') {
            filaRespuesta.valor_numero = Number(respuesta.valorNumero) || null
          } else if (respuesta.tipo === 'opcion') {
            filaRespuesta.opcion_id = Number(respuesta.opcionId) || null
          } else {
            filaRespuesta.valor_texto = (respuesta.valorTexto || '').trim() || null
          }

          const { error: errorRespuesta } = await supabase
            .from('pedido_respuestas')
            .insert(filaRespuesta)

          if (errorRespuesta) {
            throw errorRespuesta
          }
        }
      }

      /* ----- Foto o imagen ----- */

      if (item.imagenActivo && item.imagenArchivo) {
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

        rutasSubidas.push(rutaStorage)

        const { error: errorArchivo } = await supabase
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

        if (errorArchivo) {
          throw errorArchivo
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
      }
    }

    /* ==================================================
       RECUPERAR PEDIDO COMPLETO
       ================================================== */

    const { data: pedidoCompleto, error: errorRecarga } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedido.id)
      .single()

    if (errorRecarga) {
      throw errorRecarga
    }

    return pedidoCompleto

  } catch (error) {
    if (rutasSubidas.length > 0) {
      await supabase.storage
        .from('pedido-archivos')
        .remove(rutasSubidas)
    }

    if (pedidoId) {
      const { data: detallesHuérfanos } = await supabase
        .from('pedido_detalles')
        .select('id')
        .eq('pedido_id', pedidoId)

      const idsDetalles = (detallesHuérfanos || []).map((d) => d.id)

      if (idsDetalles.length > 0) {
        await supabase
          .from('pedido_archivos')
          .delete()
          .in('pedido_detalle_id', idsDetalles)

        await supabase
          .from('pedido_respuestas')
          .delete()
          .in('pedido_item_id', idsDetalles)

        await supabase
          .from('pedido_personalizaciones')
          .delete()
          .in('pedido_detalle_id', idsDetalles)
      }

      await supabase
        .from('pedido_detalles')
        .delete()
        .eq('pedido_id', pedidoId)

      await supabase
        .from('historial_pedidos')
        .delete()
        .eq('pedido_id', pedidoId)

      await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)
    }

    throw error
  }
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
