import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  GitCompareArrows,
  Search,
  RefreshCw
} from 'lucide-react'

export default function ComparacionProveedoresPage() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('todos')
  const [soloOportunidades, setSoloOportunidades] = useState(false)
  const [orden, setOrden] = useState('ahorro')

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const { data, error: errorRpc } = await supabase.rpc(
      'productos_con_mejor_precio'
    )

    setCargando(false)

    if (errorRpc) {
      console.error('Error comparando proveedores:', errorRpc)
      setError(errorRpc.message || 'No se pudo cargar la comparación.')
      setDatos([])
      return
    }

    setDatos(data || [])
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const proveedoresActuales = [
    ...new Set(
      datos
        .map((producto) => producto.proveedor_actual)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'es'))

  const haySinProveedorActual = datos.some(
    (producto) => !producto.proveedor_actual
  )

  const filtrados = datos.filter((producto) => {
    const texto =
      `${producto.producto_nombre || ''} ${producto.codigo_interno || ''}`
        .toLowerCase()

    if (!texto.includes(busqueda.toLowerCase())) return false

    if (filtroProveedor === 'sin-proveedor-actual') {
      if (producto.proveedor_actual) return false
    } else if (
      filtroProveedor !== 'todos' &&
      producto.proveedor_actual !== filtroProveedor
    ) {
      return false
    }

    if (
      soloOportunidades &&
      !(Number(producto.ahorro_unitario) > 0)
    ) {
      return false
    }

    return true
  })

  const ordenados = [...filtrados].sort((a, b) => {
    if (orden === 'nombre') {
      return (a.producto_nombre || '').localeCompare(
        b.producto_nombre || '',
        'es'
      )
    }

    if (orden === 'precio_actual') {
      const pa = Number(a.precio_actual)
      const pb = Number(b.precio_actual)
      if (!pa && !pb) return 0
      if (!pa) return 1
      if (!pb) return -1
      return pa - pb
    }

    if (orden === 'mejor_precio') {
      const pa = Number(a.precio_mejor)
      const pb = Number(b.precio_mejor)
      if (!pa && !pb) return 0
      if (!pa) return 1
      if (!pb) return -1
      return pa - pb
    }

    const aa = Number(a.ahorro_unitario) || 0
    const ab = Number(b.ahorro_unitario) || 0
    return ab - aa
  })

  const esOportunidad = (producto) =>
    Number(producto.ahorro_unitario) > 0

  const esMejorActual = (producto) =>
    !esOportunidad(producto) &&
    producto.proveedor_actual &&
    producto.proveedor_actual === producto.proveedor_nombre

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            Comparación de proveedores
          </h1>
          <p>
            Dónde conviene comprar cada producto,
            producto por producto.
          </p>
        </div>
      </header>

      <section className="panel">

        <div className="productos-toolbar">

          <div className="buscador">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="filtro-productos"
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            aria-label="Filtrar por proveedor actual"
          >
            <option value="todos">
              Todos los proveedores
            </option>

            {proveedoresActuales.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}

            {haySinProveedorActual && (
              <option value="sin-proveedor-actual">
                Sin proveedor actual
              </option>
            )}
          </select>

          <button
            className={
              'estado-toggle' +
              (soloOportunidades ? ' activo' : '')
            }
            type="button"
            onClick={() =>
              setSoloOportunidades((actual) => !actual)
            }
            title="Mostrar solo productos con ahorro posible"
          >
            Solo oportunidades
          </button>

          <select
            className="filtro-productos"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            aria-label="Ordenar productos"
          >
            <option value="ahorro">
              Mayor ahorro
            </option>
            <option value="nombre">
              Producto A-Z
            </option>
            <option value="precio_actual">
              Precio actual
            </option>
            <option value="mejor_precio">
              Mejor precio
            </option>
          </select>

          <button
            className="sutil"
            type="button"
            onClick={cargarDatos}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <span className="cantidad-productos">
            {ordenados.length} productos
          </span>

        </div>

        {cargando ? (
          <div className="vacio">
            <RefreshCw size={30} />
            <p>Cargando comparación de precios...</p>
          </div>
        ) : error ? (
          <div className="vacio">
            <div className="vacio-icono">
              <GitCompareArrows size={30} />
            </div>
            <h3>
              No se pudo cargar la comparación
            </h3>
            <p>
              {error}
            </p>
          </div>
        ) : datos.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <GitCompareArrows size={30} />
            </div>
            <h3>
              No hay precios comparables
            </h3>
            <p>
              No hay productos con precios de
              compra cargados para comparar.
            </p>
          </div>
        ) : ordenados.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <GitCompareArrows size={30} />
            </div>
            <h3>
              Sin resultados
            </h3>
            <p>
              Ningún producto coincide con los
              filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="detalle-tabla-contenedor">

            <div className="detalle-tabla general">

              <div className="detalle-tabla-cabecera">

                <div>Producto</div>
                <div>Código</div>
                <div>Proveedor actual</div>
                <div>Precio actual</div>
                <div>Mejor proveedor</div>
                <div>Mejor precio</div>
                <div>Más caro</div>
                <div>Precio más caro</div>
                <div>Diferencia</div>
                <div>Ahorro unitario</div>

              </div>

              {ordenados.map((producto) => (

                <div
                  className={
                    'detalle-tabla-fila' +
                    (esOportunidad(producto)
                      ? ' mejor-precio oportunidad'
                      : '')
                  }
                  key={producto.producto_id}
                >

                  <div>
                    <strong>
                      {producto.producto_nombre ||
                        '—'}
                    </strong>
                  </div>

                  <div className="secundario">
                    {producto.codigo_interno || '—'}
                  </div>

                  <div>
                    {producto.proveedor_actual ||
                      <span className="secundario">
                        Sin proveedor
                      </span>}
                  </div>

                  <div>
                    {producto.precio_actual !==
                      null &&
                    producto.precio_actual !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          producto.precio_actual
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (

                      <span className="sin-costo-texto">
                        Sin precio
                      </span>

                    )}
                  </div>

                  <div>
                    {esOportunidad(producto) ? (
                      <strong>
                        {producto.proveedor_nombre ||
                          '—'}
                      </strong>
                    ) : (
                      <span>
                        {producto.proveedor_nombre ||
                          '—'}
                      </span>
                    )}
                  </div>

                  <div>
                    {producto.precio_mejor !==
                      null &&
                    producto.precio_mejor !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          producto.precio_mejor
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (
                      '—'
                    )}
                  </div>

                  <div className="secundario">
                    {producto.proveedor_caro || '—'}
                  </div>

                  <div>
                    {producto.precio_caro !==
                      null &&
                    producto.precio_caro !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          producto.precio_caro
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (
                      '—'
                    )}
                  </div>

                  <div className="secundario">
                    {producto.diferencia !==
                      null &&
                    producto.diferencia !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          producto.diferencia
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (
                      '—'
                    )}
                  </div>

                  <div>
                    {esOportunidad(producto) ? (

                      <span className="badge-mejor-precio">
                        Ahorro $
                        {Number(
                          producto.ahorro_unitario
                        ).toLocaleString('es-UY')}
                        /unid
                      </span>

                    ) : esMejorActual(producto) ? (

                      <span className="badge-mejor-precio">
                        Mejor precio actual
                      </span>

                    ) : producto.precio_actual ===
                        null &&
                      producto.precio_actual ===
                        undefined ? (

                      <span className="sin-costo-texto">
                        Sin precio
                      </span>

                    ) : (

                      <span className="secundario">
                        —
                      </span>

                    )}
                  </div>

                </div>

              ))}

            </div>

          </div>
        )}

      </section>
    </>
  )
}