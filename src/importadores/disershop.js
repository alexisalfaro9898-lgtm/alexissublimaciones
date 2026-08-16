import 'dotenv/config'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const URL_CATEGORIA =
  'https://disershop.com.uy/emprendedores/sublimables'

const PROVEEDOR_ID = 3
const CATEGORIA_ID = 6
const PREFIJO_CODIGO = 'DIS'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

function limpiarTexto(texto) {
  if (!texto) return null

  return texto
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerPrecio(texto) {
  if (!texto) return null

  const coincidencia = texto
    .replace(/\./g, '')
    .replace(',', '.')
    .match(/[\d.]+/)

  if (!coincidencia) return null

  const precio = Number(coincidencia[0])

  if (!Number.isFinite(precio) || precio <= 0) {
    return null
  }

  return precio
}

const PALABRAS_EXCLUIR = [
  'tinta',
  'vinilo',
  'papel',
  'resma',
  'impresora',
  'plotter',
  'prensa',
  'plancha',
  'sublimadora',
  'sublimador',
  'máquina',
  'maquina',
  'repuesto',
  'insumo',
  'mobiliario',
  'banqueta',
  'silla',
  'mesa',
  'escritorio'
]

const PALABRAS_IMPORTAR = [
  'taza',
  'jarra',
  'jarro',
  'vaso',
  'botella',
  'termo',
  'mate',
  'camiseta',
  'remera',
  'buzo',
  'campera',
  'gorra',
  'gorro',
  'llavero',
  'azulejo',
  'cerámica',
  'ceramica',
  'madera',
  'mdf',
  'posavasos',
  'cojin',
  'cojín',
  'almohadon',
  'almohadón',
  'caramañola',
  'caramanola',
  'cuadro',
  'marco',
  'bandera',
  'body',
  'agenda'
]

function clasificarProducto(producto) {
  const nombre = (producto.nombre || '').toLowerCase()
  const descripcion = (producto.descripcion || '').toLowerCase()
  const url = (producto.url || '').toLowerCase()

  /*
   * Primero revisamos exclusiones.
   * Esto evita importar insumos o maquinaria
   * aunque aparezcan palabras permitidas.
   */

  const exclusion = PALABRAS_EXCLUIR.find((palabra) => {
    return nombre.includes(palabra)
  })

  if (exclusion) {
    return {
      estado: 'EXCLUIR',
      motivo: `Nombre contiene "${exclusion}"`
    }
  }

  /*
   * Después buscamos productos permitidos.
   */

  const permitido = PALABRAS_IMPORTAR.find((palabra) => {
    return (
      nombre.includes(palabra) ||
      descripcion.includes(palabra) ||
      url.includes(palabra)
    )
  })

  if (permitido) {
    return {
      estado: 'IMPORTAR',
      motivo: `Contiene "${permitido}"`
    }
  }

  return {
    estado: 'REVISAR',
    motivo: 'No se pudo determinar automáticamente'
  }
}

async function extraerProductos() {
  console.log('======================================')
  console.log(' DESCARGANDO DISERSHOP')
  console.log('======================================')
  console.log('')

  const respuesta = await fetch(URL_CATEGORIA)

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status}`)
  }

  const html = await respuesta.text()

  console.log(
    `HTML recibido: ${html.length} caracteres`
  )

  const $ = cheerio.load(html)

  const productos = []
  const idsVistos = new Set()

  $('.product-thumb').each((_, elemento) => {
    const producto = $(elemento)

    const enlace = producto
      .find('.name a')
      .first()

    const imagen = producto
      .find('img')
      .first()

    const nombre = limpiarTexto(
      enlace.text()
    )

    if (!nombre) return

    const url =
      enlace.attr('href') || null

    const imagenUrl =
      imagen.attr('data-src') ||
      imagen.attr('src') ||
      null

    const descripcion =
      limpiarTexto(
        producto
          .find('.description')
          .text()
      )

    const precio =
      extraerPrecio(
        producto
          .find('.price')
          .text()
      )

    const productoId =
      producto
        .find('input[name="product_id"]')
        .attr('value') || null

    if (!productoId) return

    /*
     * Evitamos duplicados dentro de la propia página.
     */

    if (idsVistos.has(productoId)) {
      return
    }

    idsVistos.add(productoId)

    const etiquetas =
      limpiarTexto(
        producto
          .find('.product-labels')
          .text()
      )

    const disponible =
      !etiquetas ||
      !etiquetas
        .toUpperCase()
        .includes('OUT')

    const datos = {
      proveedor_producto_id: productoId,
      nombre,
      url,
      imagen_url: imagenUrl,
      descripcion,
      precio,
      disponible
    }

    const clasificacion =
      clasificarProducto(datos)

    productos.push({
      ...datos,
      ...clasificacion
    })
  })

  return productos
}

async function buscarRelacionProveedor(
  codigoProveedor
) {
  const { data, error } = await supabase
    .from('producto_proveedores')
    .select(`
      id,
      producto_id,
      precio_compra,
      precio_anterior,
      stock,
      disponible,
      imagen_url,
      descripcion_proveedor
    `)
    .eq('proveedor_id', PROVEEDOR_ID)
    .eq('sku_proveedor', codigoProveedor)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function crearProducto(producto) {
  const codigoInterno =
    `${PREFIJO_CODIGO}-${producto.proveedor_producto_id}`

  const { data, error } = await supabase
    .from('productos')
    .insert({
      categoria_id: CATEGORIA_ID,
      nombre: producto.nombre,
      codigo_interno: codigoInterno,
      descripcion: producto.descripcion,
      imagen_principal: producto.imagen_url,
      precio: producto.precio,
      activo: producto.disponible,
      orden: 0
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

async function crearRelacionProveedor(
  productoDB,
  producto
) {
  const ahora = new Date().toISOString()

  const { error } = await supabase
    .from('producto_proveedores')
    .insert({
      producto_id: productoDB.id,
      proveedor_id: PROVEEDOR_ID,

      codigo_proveedor:
        producto.proveedor_producto_id,

      sku_proveedor:
        producto.proveedor_producto_id,

      precio_compra:
        producto.precio,

      precio_anterior:
        null,

      stock:
        null,

      disponible:
        producto.disponible,

      imagen_url:
        producto.imagen_url,

      descripcion_proveedor:
        producto.descripcion,

      url_producto:
        producto.url,

      ultima_sincronizacion:
        ahora,

      ultimo_cambio_precio:
        null,

      ultimo_cambio_stock:
        null,

      activo_sincronizacion:
        true,

      observaciones_sincronizacion:
        'Importación inicial desde Disershop',

      es_principal:
        true
    })

  if (error) {
    throw error
  }
}

async function actualizarProducto(
  relacion,
  producto
) {
  const ahora = new Date().toISOString()

  const precioAnterior =
    relacion.precio_compra

  const precioCambio =
    precioAnterior !== producto.precio

  const stockCambio =
    relacion.disponible !== producto.disponible

  const { error: errorRelacion } =
    await supabase
      .from('producto_proveedores')
      .update({
        precio_anterior:
          precioCambio
            ? precioAnterior
            : relacion.precio_anterior,

        precio_compra:
          producto.precio,

        disponible:
          producto.disponible,

        imagen_url:
          producto.imagen_url,

        descripcion_proveedor:
          producto.descripcion,

        url_producto:
          producto.url,

        ultima_sincronizacion:
          ahora,

        ultimo_cambio_precio:
          precioCambio
            ? ahora
            : undefined,

        ultimo_cambio_stock:
          stockCambio
            ? ahora
            : undefined,

        observaciones_sincronizacion:
          precioCambio
            ? `Precio actualizado de ${precioAnterior ?? 'sin precio'} a ${producto.precio}`
            : 'Sin cambios de precio'
      })
      .eq('id', relacion.id)

  if (errorRelacion) {
    throw errorRelacion
  }

  const { error: errorProducto } =
    await supabase
      .from('productos')
      .update({
        nombre:
          producto.nombre,

        descripcion:
          producto.descripcion,

        imagen_principal:
          producto.imagen_url,

        precio:
          producto.precio,

        activo:
          producto.disponible,

        updated_at:
          ahora
      })
      .eq('id', relacion.producto_id)

  if (errorProducto) {
    throw errorProducto
  }

  return {
    accion: 'ACTUALIZADO',
    precioCambio,
    stockCambio
  }
}

async function importarProducto(producto) {
  const codigoProveedor =
    producto.proveedor_producto_id

  const relacion =
    await buscarRelacionProveedor(
      codigoProveedor
    )

  /*
   * Si ya existe:
   * actualizamos.
   */

  if (relacion) {
    return actualizarProducto(
      relacion,
      producto
    )
  }

  /*
   * Si no existe:
   * creamos producto nuevo.
   */

  const productoDB =
    await crearProducto(producto)

  await crearRelacionProveedor(
    productoDB,
    producto
  )

  return {
    accion: 'NUEVO',
    precioCambio: false,
    stockCambio: false
  }
}

async function main() {
  try {
    const productos =
      await extraerProductos()

    const importar =
      productos.filter(
        (producto) =>
          producto.estado === 'IMPORTAR'
      )

    const excluir =
      productos.filter(
        (producto) =>
          producto.estado === 'EXCLUIR'
      )

    const revisar =
      productos.filter(
        (producto) =>
          producto.estado === 'REVISAR'
      )

    console.log('')
    console.log('======================================')
    console.log(' RESULTADO DEL FILTRO')
    console.log('======================================')
    console.log('')

    console.log(
      `Total encontrados: ${productos.length}`
    )

    console.log(
      `IMPORTAR: ${importar.length}`
    )

    console.log(
      `EXCLUIR: ${excluir.length}`
    )

    console.log(
      `REVISAR: ${revisar.length}`
    )

    console.log('')
    console.log('======================================')
    console.log(' SINCRONIZANDO SUPABASE')
    console.log('======================================')
    console.log('')

    let nuevos = 0
    let actualizados = 0
    let errores = 0

    for (const producto of importar) {
      try {
        const resultado =
          await importarProducto(
            producto
          )

        if (resultado.accion === 'NUEVO') {
          nuevos++

          console.log(
            `NUEVO: ${producto.nombre}`
          )
        } else {
          actualizados++

          console.log(
            `ACTUALIZADO: ${producto.nombre}`
          )
        }
      } catch (error) {
        errores++

        console.error(
          `ERROR: ${producto.nombre}`
        )

        console.error(
          error.message
        )
      }
    }

    console.log('')
    console.log('======================================')
    console.log(' SINCRONIZACIÓN FINALIZADA')
    console.log('======================================')
    console.log('')

    console.log(
      `Productos nuevos: ${nuevos}`
    )

    console.log(
      `Productos actualizados: ${actualizados}`
    )

    console.log(
      `Errores: ${errores}`
    )

    console.log(
      `Para revisar: ${revisar.length}`
    )

    console.log(
      `Excluidos: ${excluir.length}`
    )

    console.log('')

  } catch (error) {
    console.error('')
    console.error('ERROR GENERAL:')
    console.error(error)
    process.exit(1)
  }
}

main()
