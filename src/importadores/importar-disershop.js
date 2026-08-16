import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

const URL_CATEGORIA =
  'https://disershop.com.uy/emprendedores/sublimables'

const PROVEEDOR_ID = 3
const CATEGORIA_ID = 6

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

function limpiarTexto(texto) {
  if (!texto) return null

  return texto
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerPrecio(texto) {
  if (!texto) return null

  const limpio = texto
    .replace(/\./g, '')
    .replace(',', '.')

  const coincidencia = limpio.match(/[\d.]+/)

  if (!coincidencia) return null

  const precio = Number(coincidencia[0])

  if (!Number.isFinite(precio) || precio <= 0) {
    return null
  }

  return precio
}

function clasificarProducto(producto) {
  const nombre = (producto.nombre || '').toLowerCase()

  const exclusion = PALABRAS_EXCLUIR.find(
    palabra => nombre.includes(palabra)
  )

  if (exclusion) {
    return {
      estado: 'EXCLUIR',
      motivo: `Nombre contiene "${exclusion}"`
    }
  }

  const permitido = PALABRAS_IMPORTAR.find(
    palabra => nombre.includes(palabra)
  )

  if (permitido) {
    return {
      estado: 'IMPORTAR',
      motivo: `Nombre contiene "${permitido}"`
    }
  }

  return {
    estado: 'REVISAR',
    motivo: 'No se pudo determinar automáticamente'
  }
}

async function obtenerProductos() {
  console.log('======================================')
  console.log(' IMPORTADOR DISERSHOP → SUPABASE')
  console.log('======================================')
  console.log('')

  console.log('Descargando Disershop...')

  const respuesta = await fetch(URL_CATEGORIA)

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status}`)
  }

  const html = await respuesta.text()

  console.log(`HTML recibido: ${html.length} caracteres`)
  console.log('Analizando productos...')
  console.log('')

  const $ = cheerio.load(html)

  const productos = []

  $('.product-thumb').each((_, elemento) => {
    const producto = $(elemento)

    const enlace = producto
      .find('.name a')
      .first()

    const imagen = producto
      .find('img')
      .first()

    const nombre = limpiarTexto(enlace.text())

    if (!nombre) return

    const url =
      enlace.attr('href') || null

    const imagenUrl =
      imagen.attr('data-src') ||
      imagen.attr('src') ||
      null

    const descripcion =
      limpiarTexto(
        producto.find('.description').text()
      )

    const precio =
      extraerPrecio(
        producto.find('.price').text()
      )

    const productoId =
      producto
        .find('input[name="product_id"]')
        .attr('value') || null

    const etiquetas =
      limpiarTexto(
        producto.find('.product-labels').text()
      )

    const disponible =
      !etiquetas ||
      !etiquetas.toUpperCase().includes('OUT')

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

async function importarProducto(producto) {
  /*
   * Buscamos primero si este producto ya existe
   * para este proveedor.
   */

  const { data: relacionExistente, error: errorBusqueda } =
    await supabase
      .from('producto_proveedores')
      .select(`
        id,
        producto_id,
        precio_compra,
        precio_anterior,
        stock,
        disponible
      `)
      .eq('proveedor_id', PROVEEDOR_ID)
      .eq('sku_proveedor', producto.proveedor_producto_id)
      .maybeSingle()

  if (errorBusqueda) {
    throw errorBusqueda
  }

  /*
   * Si ya existe:
   * actualizamos información del proveedor.
   */

  if (relacionExistente) {
    const precioCambio =
      relacionExistente.precio_compra !== producto.precio

    const stockCambio =
      relacionExistente.disponible !== producto.disponible

    const ahora = new Date().toISOString()

    const datosActualizacion = {
      precio_anterior: precioCambio
        ? relacionExistente.precio_compra
        : relacionExistente.precio_anterior,

      precio_compra: producto.precio,

      disponible: producto.disponible,

      stock: producto.disponible ? 1 : 0,

      url_producto: producto.url,

      imagen_url: producto.imagen_url,

      descripcion_proveedor: producto.descripcion,

      ultima_sincronizacion: ahora
    }

    if (precioCambio) {
      datosActualizacion.ultimo_cambio_precio = ahora
    }

    if (stockCambio) {
      datosActualizacion.ultimo_cambio_stock = ahora
    }

    const { error } = await supabase
      .from('producto_proveedores')
      .update(datosActualizacion)
      .eq('id', relacionExistente.id)

    if (error) {
      throw error
    }

    /*
     * Actualizamos también la información básica
     * del producto.
     */

    const { error: errorProducto } =
      await supabase
        .from('productos')
        .update({
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          imagen_principal: producto.imagen_url,
          updated_at: ahora
        })
        .eq('id', relacionExistente.producto_id)

    if (errorProducto) {
      throw errorProducto
    }

    return 'ACTUALIZADO'
  }

  /*
   * Producto nuevo.
   */

  const { data: nuevoProducto, error: errorProducto } =
    await supabase
      .from('productos')
      .insert({
        categoria_id: CATEGORIA_ID,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        imagen_principal: producto.imagen_url,
        activo: true
      })
      .select('id')
      .single()

  if (errorProducto) {
    throw errorProducto
  }

  /*
   * Creamos la relación producto ↔ proveedor.
   */

  const { error: errorRelacion } =
    await supabase
      .from('producto_proveedores')
      .insert({
        producto_id: nuevoProducto.id,
        proveedor_id: PROVEEDOR_ID,

        codigo_proveedor:
          producto.proveedor_producto_id,

        sku_proveedor:
          producto.proveedor_producto_id,

        precio_compra:
          producto.precio,

        es_principal: true,

        url_producto:
          producto.url,

        imagen_url:
          producto.imagen_url,

        descripcion_proveedor:
          producto.descripcion,

        disponible:
          producto.disponible,

        stock:
          producto.disponible ? 1 : 0,

        ultima_sincronizacion:
          new Date().toISOString(),

        activo_sincronizacion: true
      })

  if (errorRelacion) {
    throw errorRelacion
  }

  return 'NUEVO'
}

async function main() {
  try {
    const productos = await obtenerProductos()

    /*
     * Eliminamos duplicados por ID del proveedor.
     */

    const mapa = new Map()

    for (const producto of productos) {
      if (!producto.proveedor_producto_id) continue

      mapa.set(
        producto.proveedor_producto_id,
        producto
      )
    }

    const productosUnicos =
      Array.from(mapa.values())

    const importar =
      productosUnicos.filter(
        producto =>
          producto.estado === 'IMPORTAR'
      )

    const revisar =
      productosUnicos.filter(
        producto =>
          producto.estado === 'REVISAR'
      )

    console.log(
      `Productos encontrados: ${productos.length}`
    )

    console.log(
      `Productos únicos: ${productosUnicos.length}`
    )

    console.log(
      `Para importar: ${importar.length}`
    )

    console.log(
      `Para revisar: ${revisar.length}`
    )

    console.log('')
    console.log('======================================')
    console.log(' IMPORTANDO A SUPABASE')
    console.log('======================================')
    console.log('')

    let nuevos = 0
    let actualizados = 0
    let errores = 0

    for (const producto of importar) {
      try {
        const resultado =
          await importarProducto(producto)

        console.log(
          `${resultado}: ${producto.nombre}`
        )

        if (resultado === 'NUEVO') {
          nuevos++
        } else {
          actualizados++
        }
      } catch (error) {
        errores++

        console.error(
          `ERROR: ${producto.nombre}`
        )

        console.error(error.message)
      }
    }

    console.log('')
    console.log('======================================')
    console.log(' RESULTADO')
    console.log('======================================')
    console.log('')
    console.log(`Nuevos: ${nuevos}`)
    console.log(`Actualizados: ${actualizados}`)
    console.log(`Errores: ${errores}`)
    console.log('')
    console.log('Importación terminada.')

  } catch (error) {
    console.error('')
    console.error('ERROR GENERAL:')
    console.error(error)
  }
}

main()
