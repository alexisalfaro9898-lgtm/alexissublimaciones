import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ClipboardList,
  Search,
  RefreshCw,
  ArrowLeft,
  Package,
  Plus,
  Save,
  Check,
  Trash2
} from 'lucide-react'

function hoyLocal() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

export default function ComprasPage() {
  const [compras, setCompras] = useState([])
  const [itemsPorCompra, setItemsPorCompra] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [seleccionada, setSeleccionada] = useState(null)
  const [mensaje, setMensaje] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [catalogoProductos, setCatalogoProductos] = useState([])
  const [variantesPorProducto, setVariantesPorProducto] = useState({})
  const [costosConocidos, setCostosConocidos] = useState({})
  const [proveedorForm, setProveedorForm] = useState('')
  const [fechaForm, setFechaForm] = useState(hoyLocal())
  const [comprobanteForm, setComprobanteForm] = useState('')
  const [observacionesForm, setObservacionesForm] = useState('')
  const [lineas, setLineas] = useState([
    { producto_id: '', variante_id: '', cantidad: '1', costo_unitario: '' }
  ])
  const [guardando, setGuardando] = useState(false)

  function avisar(texto) {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 2800)
  }

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const [respuestaCompras, respuestaItems] = await Promise.all([
      supabase
        .from('compras')
        .select('*, proveedores (nombre)')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false }),

      supabase
        .from('compra_items')
        .select(`
          *,
          productos (
            nombre_comercial,
            nombre,
            codigo_interno
          ),
          producto_variantes (
            nombre
          )
        `)
    ])

    if (respuestaCompras.error) {
      console.error('Error cargando compras:', respuestaCompras.error)
      setError(respuestaCompras.error.message)
      setCargando(false)
      return
    }

    const mapa = {}
    for (const item of respuestaItems.data || []) {
      if (!mapa[item.compra_id]) {
        mapa[item.compra_id] = []
      }
      mapa[item.compra_id].push(item)
    }

    setCompras(respuestaCompras.data || [])
    setItemsPorCompra(mapa)
    setCargando(false)
  }

  async function cargarCatalogo() {
    const [resProveedores, resProductos, resVariantes, resCostos] =
      await Promise.all([
        supabase
          .from('proveedores')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre'),

        supabase
          .from('productos')
          .select('id, nombre_comercial, nombre, codigo_interno')
          .order('nombre_comercial'),

        supabase
          .from('producto_variantes')
          .select('id, producto_id, nombre')
          .eq('activo', true),

        supabase
          .from('producto_proveedores')
          .select('producto_id, proveedor_id, precio_compra')
      ])

    if (resProveedores.error) {
      console.error('Error cargando proveedores:', resProveedores.error)
      return
    }

    if (resProductos.error) {
      console.error('Error cargando productos:', resProductos.error)
      return
    }

    setProveedores(resProveedores.data || [])
    setCatalogoProductos(resProductos.data || [])

    const mapaVariantes = {}
    for (const variante of resVariantes.data || []) {
      if (!mapaVariantes[variante.producto_id]) {
        mapaVariantes[variante.producto_id] = []
      }
      mapaVariantes[variante.producto_id].push(variante)
    }
    setVariantesPorProducto(mapaVariantes)

    const mapaCostos = {}
    for (const relacion of resCostos.data || []) {
      if (relacion.precio_compra === null || relacion.precio_compra === undefined) {
        continue
      }
      mapaCostos[
        `${relacion.producto_id}:${relacion.proveedor_id}`
      ] = relacion.precio_compra
    }
    setCostosConocidos(mapaCostos)
  }

  useEffect(() => {
    cargarDatos()
    cargarCatalogo()
  }, [])

  const proveedoresDeCompras = [
    ...new Set(
      compras
        .map((compra) => compra.proveedores?.nombre)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'es'))

  const hayFiltros =
    busqueda.trim() !== '' ||
    filtroProveedor !== 'todos' ||
    desde !== '' ||
    hasta !== ''

  const comprasFiltradas = compras.filter((compra) => {
    const texto =
      `${compra.proveedores?.nombre || ''} ${compra.comprobante || ''}`
        .toLowerCase()

    if (
      busqueda.trim() !== '' &&
      !texto.includes(busqueda.trim().toLowerCase())
    ) {
      return false
    }

    if (
      filtroProveedor !== 'todos' &&
      compra.proveedores?.nombre !== filtroProveedor
    ) {
      return false
    }

    if (desde && compra.fecha < desde) return false
    if (hasta && compra.fecha > hasta) return false

    return true
  })

  function totalDeCompra(compraId) {
    const items = itemsPorCompra[compraId] || []

    if (
      items.length === 0 ||
      items.every(
        (item) =>
          item.costo_total === null ||
          item.costo_total === undefined
      )
    ) {
      return null
    }

    return items.reduce(
      (suma, item) =>
        suma + (Number(item.costo_total) || 0),
      0
    )
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroProveedor('todos')
    setDesde('')
    setHasta('')
  }

  function agregarLinea() {
    setLineas((actuales) => [
      ...actuales,
      { producto_id: '', variante_id: '', cantidad: '1', costo_unitario: '' }
    ])
  }

  function quitarLinea(indice) {
    setLineas((actuales) => actuales.filter((_, i) => i !== indice))
  }

  function setLinea(indice, campo, valor) {
    setLineas((actuales) =>
      actuales.map((linea, i) => {
        if (i !== indice) return linea

        const nueva = { ...linea, [campo]: valor }

        if (campo === 'producto_id') {
          nueva.variante_id = ''
        }

        return nueva
      })
    )
  }

  function costoConocido(linea) {
    if (
      !linea.producto_id ||
      !proveedorForm ||
      !proveedorForm.trim()
    ) {
      return null
    }

    return (
      costosConocidos[
        `${linea.producto_id}:${proveedorForm}`
      ] ?? null
    )
  }

  function tieneVariantesActivas(linea) {
    return (
      (variantesPorProducto[linea.producto_id] || [])
        .length > 0
    )
  }

  function totalLinea(linea) {
    const cantidad = Number(linea.cantidad)
    const costo = Number(linea.costo_unitario)

    if (!cantidad || cantidad <= 0 || costo === null || costo === undefined || isNaN(costo) || costo < 0) {
      return null
    }

    return cantidad * costo
  }

  const lineasConProducto = lineas.filter(
    (linea) => String(linea.producto_id) !== ''
  )

  const totalGeneral = lineasConProducto.reduce(
    (suma, linea) => suma + (totalLinea(linea) || 0),
    0
  )

  function validarCompra() {
    const problemas = []

    if (!proveedorForm || !proveedorForm.trim()) {
      problemas.push('Seleccioná un proveedor.')
    } else if (
      !proveedores.some(
        (proveedor) =>
          String(proveedor.id) === String(proveedorForm)
      )
    ) {
      problemas.push('El proveedor seleccionado no es válido.')
    }

    if (!fechaForm || !fechaForm.trim()) {
      problemas.push('Ingresá una fecha.')
    } else if (isNaN(new Date(`${fechaForm}T00:00:00`).getTime())) {
      problemas.push('La fecha no es válida.')
    }

    if (lineasConProducto.length === 0) {
      problemas.push('Agregá al menos un ítem con producto.')
    }

    lineasConProducto.forEach((linea, indice) => {
      const cantidad = Number(linea.cantidad)
      const costo = Number(linea.costo_unitario)

      if (
        !cantidad ||
        cantidad <= 0 ||
        isNaN(cantidad)
      ) {
        problemas.push(
          `Ítem ${indice + 1}: la cantidad debe ser mayor a 0.`
        )
      }

      if (
        linea.costo_unitario === '' ||
        linea.costo_unitario === null ||
        linea.costo_unitario === undefined ||
        isNaN(costo) ||
        costo < 0
      ) {
        problemas.push(
          `Ítem ${indice + 1}: el costo unitario no puede ser negativo.`
        )
      }

      const productoExiste = catalogoProductos.some(
        (producto) =>
          String(producto.id) === String(linea.producto_id)
      )

      if (!productoExiste) {
        problemas.push(
          `Ítem ${indice + 1}: el producto seleccionado no es válido.`
        )
      }

      if (
        productoExiste &&
        tieneVariantesActivas(linea) &&
        (!linea.variante_id || linea.variante_id.trim() === '')
      ) {
        problemas.push(
          `Ítem ${indice + 1}: este producto tiene variantes activas, debes seleccionar una.`
        )
      }
    })

    return problemas
  }

  async function guardarCompra(e) {
    e.preventDefault()

    const problemas = validarCompra()

    if (problemas.length > 0) {
      alert(problemas.join('\n'))
      return
    }

    setGuardando(true)

    const { error } = await supabase.rpc(
      'registrar_compra',
      {
        p_proveedor_id: Number(proveedorForm),
        p_fecha: fechaForm,
        p_comprobante: comprobanteForm,
        p_observaciones: observacionesForm,
        p_items: lineasConProducto.map((linea) => ({
          producto_id: Number(linea.producto_id),
          variante_id:
            linea.variante_id && linea.variante_id.trim() !== ''
              ? Number(linea.variante_id)
              : null,
          cantidad: Number(linea.cantidad),
          costo_unitario: Number(linea.costo_unitario)
        }))
      }
    )

    setGuardando(false)

    if (error) {
      console.error('Error guardando compra:', error)
      alert(
        'No se pudo guardar la compra: ' + error.message
      )
      return
    }

    setMostrarFormulario(false)
    setProveedorForm('')
    setFechaForm(hoyLocal())
    setComprobanteForm('')
    setObservacionesForm('')
    setLineas([
      { producto_id: '', variante_id: '', cantidad: '1', costo_unitario: '' }
    ])
    cargarDatos()
    avisar('Compra registrada.')
  }

  function formatearFechaCorta(fecha) {
    if (!fecha) return '—'

    const [anio, mes, dia] = String(fecha).split('-')

    if (!anio || !mes || !dia) return fecha

    return `${dia}/${mes}/${anio}`
  }

  if (seleccionada) {
    const compra = compras.find(
      (c) => c.id === seleccionada.id
    )

    const items = itemsPorCompra[seleccionada.id] || []
    const total = totalDeCompra(seleccionada.id)

    return (
      <>
        <header className="topbar">
          <div>
            <button
              className="boton-volver"
              onClick={() => setSeleccionada(null)}
            >
              <ArrowLeft size={18} />
              Volver a compras
            </button>
            <h1>
              {compra?.comprobante
                ? `Compra ${compra.comprobante}`
                : `Compra #${seleccionada.id}`}
            </h1>
            <p>
              {compra?.proveedores?.nombre ||
                'Proveedor'}
            </p>
          </div>
        </header>

        {!compra ? (
          <section className="panel">

            <div className="vacio">
              <div className="vacio-icono">
                <ClipboardList size={30} />
              </div>
              <h3>
                Compra no encontrada
              </h3>
              <p>
                La compra seleccionada ya no existe
                o no se puede consultar.
              </p>
              <button
                className="crear"
                type="button"
                onClick={() => setSeleccionada(null)}
              >
                Volver a compras
              </button>
            </div>

          </section>
        ) : (
          <>
            <section className="panel detalle-panel">

              <div className="panel-header">
                <div>
                  <h2>
                    Datos de la compra
                  </h2>
                </div>
              </div>

              <div className="detalle-datos">
                <div>
                  <span>Proveedor</span>
                  <strong>
                    {compra.proveedores?.nombre ||
                      '—'}
                  </strong>
                </div>
                <div>
                  <span>Fecha</span>
                  <strong>
                    {formatearFechaCorta(compra.fecha)}
                  </strong>
                </div>
                <div>
                  <span>Comprobante</span>
                  <strong>
                    {compra.comprobante || '—'}
                  </strong>
                </div>
                <div>
                  <span>Observaciones</span>
                  <strong>
                    {compra.observaciones || '—'}
                  </strong>
                </div>
                <div>
                  <span>Cantidad de ítems</span>
                  <strong>
                    {items.length}
                  </strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>
                    {total !== null
                      ? '$' +
                        Number(total).toLocaleString(
                          'es-UY'
                        )
                      : (
                        <span className="sin-costo-texto">
                          Sin costo
                        </span>
                      )}
                  </strong>
                </div>
              </div>

            </section>

            <section className="panel detalle-panel">

              <div className="panel-header">
                <div>
                  <h2>
                    Ítems de la compra
                  </h2>
                  <p>
                    Detalle de productos comprados.
                  </p>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="vacio">
                  <div className="vacio-icono">
                    <Package size={30} />
                  </div>
                  <h3>
                    Sin ítems registrados
                  </h3>
                  <p>
                    Esta compra no tiene productos
                    asociados.
                  </p>
                </div>
              ) : (
                <div className="detalle-tabla-contenedor">

                  <div className="detalle-tabla compras-items">

                    <div className="detalle-tabla-cabecera">
                      <div>Producto</div>
                      <div>Variante</div>
                      <div>Cantidad</div>
                      <div>Costo unitario</div>
                      <div>Costo total</div>
                    </div>

                    {items.map((item) => (
                      <div
                        className="detalle-tabla-fila"
                        key={item.id}
                      >
                        <div>
                          <strong>
                            {item.productos
                              ?.nombre_comercial ||
                              item.productos
                                ?.nombre ||
                              'Producto'}
                          </strong>
                          {item.productos
                            ?.codigo_interno && (
                            <div className="secundario">
                              {
                                item.productos
                                  .codigo_interno
                              }
                            </div>
                          )}
                        </div>
                        <div className="secundario">
                          {item.variante_id
                            ? item
                                .producto_variantes
                                ?.nombre || 'Variante'
                            : '—'}
                        </div>
                        <div>
                          {Number(
                            item.cantidad
                          ).toLocaleString('es-UY')}
                        </div>
                        <div>
                          {item.costo_unitario !==
                            null &&
                          item.costo_unitario !==
                            undefined ? (
                            <>

                              $
                              {Number(
                                item.costo_unitario
                              ).toLocaleString(
                                'es-UY'
                              )}

                            </>
                          ) : (
                            <span className="sin-costo-texto">
                              Sin costo
                            </span>
                          )}
                        </div>
                        <div>
                          {item.costo_total !==
                            null &&
                          item.costo_total !==
                            undefined ? (
                            <>

                              $
                              {Number(
                                item.costo_total
                              ).toLocaleString(
                                'es-UY'
                              )}

                            </>
                          ) : (
                            <span className="sin-costo-texto">
                              Sin costo
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                  </div>

                  <div className="compra-total">
                    <span>Total</span>
                    {total !== null
                      ? '$' +
                        Number(total).toLocaleString(
                          'es-UY'
                        )
                      : (
                        <span className="sin-costo-texto">
                          Sin costo
                        </span>
                      )}
                  </div>

                </div>
              )}

            </section>
          </>
        )}
      </>
    )
  }

  if (mostrarFormulario) {
    return (
      <>
        <header className="topbar">
          <div>
            <button
              className="boton-volver"
              onClick={() => setMostrarFormulario(false)}
            >
              <ArrowLeft size={18} />
              Volver a compras
            </button>
            <h1>
              Nueva compra
            </h1>
            <p>
              Registrá una compra a un proveedor.
            </p>
          </div>
        </header>

        <form onSubmit={guardarCompra}>

          <section className="panel detalle-panel">

            <div className="panel-header">
              <div>
                <h2>
                  Datos de la compra
                </h2>
                <p>
                  Proveedor, fecha y datos del
                  comprobante.
                </p>
              </div>
            </div>

            <div className="proveedor-form">

              <div className="cliente-form-campo">
                <label htmlFor="compra-proveedor">
                  Proveedor *
                </label>
                <select
                  id="compra-proveedor"
                  value={proveedorForm}
                  onChange={(e) =>
                    setProveedorForm(e.target.value)
                  }
                >
                  <option value="">
                    Seleccioná un proveedor...
                  </option>
                  {proveedores.map((proveedor) => (
                    <option
                      key={proveedor.id}
                      value={proveedor.id}
                    >
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="compra-fecha">
                  Fecha *
                </label>
                <input
                  id="compra-fecha"
                  type="date"
                  value={fechaForm}
                  onChange={(e) =>
                    setFechaForm(e.target.value)
                  }
                />
              </div>

              <div className="cliente-form-campo">
                <label htmlFor="compra-comprobante">
                  Comprobante
                </label>
                <input
                  id="compra-comprobante"
                  type="text"
                  placeholder="Ej: Factura 1234"
                  value={comprobanteForm}
                  onChange={(e) =>
                    setComprobanteForm(e.target.value)
                  }
                />
              </div>

              <div className="cliente-form-campo ancho-completo">
                <label htmlFor="compra-obs">
                  Observaciones
                </label>
                <textarea
                  id="compra-obs"
                  rows="2"
                  value={observacionesForm}
                  onChange={(e) =>
                    setObservacionesForm(e.target.value)
                  }
                />
              </div>

            </div>

          </section>

          <section className="panel detalle-panel">

            <div className="panel-header">
              <div>
                <h2>
                  Ítems de la compra
                </h2>
                <p>
                  Productos comprados, cantidades y
                  costos reales pagados.
                </p>
              </div>
            </div>

            {lineas.map((linea, indice) => {
              const costoConocidoLinea = costoConocido(linea)
              const total = totalLinea(linea)

              return (
                <div
                  className="compra-item-linea"
                  key={indice}
                >

                  <div>
                    <label
                      className="linea-label"
                      htmlFor={`linea-${indice}-producto`}
                    >
                      Producto *
                    </label>
                    <select
                      id={`linea-${indice}-producto`}
                      className="edicion-inline"
                      value={linea.producto_id}
                      onChange={(e) =>
                        setLinea(
                          indice,
                          'producto_id',
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Seleccionar producto...
                      </option>
                      {catalogoProductos.map((producto) => (
                        <option
                          key={producto.id}
                          value={producto.id}
                        >
                          {producto.nombre_comercial ||
                            producto.nombre}
                          {producto.codigo_interno
                            ? ` (${producto.codigo_interno})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className="linea-label"
                      htmlFor={`linea-${indice}-variante`}
                    >
                      Variante{' '}
                      {tieneVariantesActivas(linea)
                        ? '*'
                        : ''}
                    </label>
                    <select
                      id={`linea-${indice}-variante`}
                      className="edicion-inline"
                      value={linea.variante_id}
                      disabled={!linea.producto_id}
                      onChange={(e) =>
                        setLinea(
                          indice,
                          'variante_id',
                          e.target.value
                        )
                      }
                    >
                      {tieneVariantesActivas(linea) ? (
                        <option value="">
                          Seleccionar variante...
                        </option>
                      ) : (
                        <option value="">
                          Sin variante
                        </option>
                      )}
                      {(
                        variantesPorProducto[
                          linea.producto_id
                        ] || []
                      ).map((variante) => (
                        <option
                          key={variante.id}
                          value={variante.id}
                        >
                          {variante.nombre}
                        </option>
                      ))}
                    </select>
                    {tieneVariantesActivas(linea) &&
                      (!linea.variante_id ||
                        linea.variante_id.trim() ===
                          '') && (
                        <div className="aviso-variantes">
                          Este producto tiene variantes.
                          Debes seleccionar una.
                        </div>
                      )}
                  </div>

                  <div>
                    <label
                      className="linea-label"
                      htmlFor={`linea-${indice}-cantidad`}
                    >
                      Cantidad *
                    </label>
                    <input
                      id={`linea-${indice}-cantidad`}
                      className="edicion-inline"
                      type="number"
                      min="0"
                      step="any"
                      value={linea.cantidad}
                      onChange={(e) =>
                        setLinea(
                          indice,
                          'cantidad',
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label
                      className="linea-label"
                      htmlFor={`linea-${indice}-costo`}
                    >
                      Costo unitario *
                    </label>
                    <input
                      id={`linea-${indice}-costo`}
                      className="edicion-inline"
                      type="number"
                      min="0"
                      step="0.01"
                      value={linea.costo_unitario}
                      onChange={(e) =>
                        setLinea(
                          indice,
                          'costo_unitario',
                          e.target.value
                        )
                      }
                    />
                    {costoConocidoLinea !== null && (
                      <div className="costo-conocido">
                        Costo conocido: $
                        {Number(
                          costoConocidoLinea
                        ).toLocaleString('es-UY')}{' '}
                        <button
                          type="button"
                          onClick={() =>
                            setLinea(
                              indice,
                              'costo_unitario',
                              String(costoConocidoLinea)
                            )
                          }
                        >
                          Usar
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="linea-label">
                      Total línea
                    </label>
                    <div className="linea-total">
                      {total !== null
                        ? '$' +
                          Number(total).toLocaleString(
                            'es-UY'
                          )
                        : '—'}
                    </div>
                  </div>

                  <div className="linea-quitar">
                    <button
                      className="accion-icono"
                      type="button"
                      onClick={() => quitarLinea(indice)}
                      disabled={lineas.length === 1}
                      title="Quitar ítem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                </div>
              )
            })}

            <div className="cliente-form-acciones">
              <button
                className="sutil"
                type="button"
                onClick={agregarLinea}
              >
                <Plus size={18} />
                Agregar ítem
              </button>
            </div>

            <div className="compra-total">
              <span>
                Total general
                {lineasConProducto.length > 0
                  ? ` (${lineasConProducto.length} ítems)`
                  : ''}
              </span>
              {totalGeneral > 0 ||
              lineasConProducto.some(
                (linea) => totalLinea(linea) !== null
              ) ? (
                '$' +
                Number(totalGeneral).toLocaleString('es-UY')
              ) : (
                <span className="sin-costo-texto">
                  Sin costo
                </span>
              )}
            </div>

          </section>

          <div className="cliente-form-acciones">
            <button
              className="crear"
              type="submit"
              disabled={guardando}
            >
              <Save size={18} />
              {guardando
                ? 'Guardando...'
                : 'Guardar compra'}
            </button>
          </div>

        </form>

        {mensaje && (
          <div className="toast-aviso">
            <Check size={16} />
            {mensaje}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            Compras
          </h1>
          <p>
            Historial de compras a proveedores.
          </p>
        </div>
        <button
          className="nuevo-pedido"
          type="button"
          onClick={() => setMostrarFormulario(true)}
        >
          <Plus size={19} />
          Nueva compra
        </button>
      </header>

      <section className="panel">

        <div className="productos-toolbar">

          <div className="buscador">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por proveedor o comprobante..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="filtro-productos"
            value={filtroProveedor}
            onChange={(e) =>
              setFiltroProveedor(e.target.value)
            }
            aria-label="Filtrar por proveedor"
          >
            <option value="todos">
              Todos los proveedores
            </option>

            {proveedoresDeCompras.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>

          <input
            className="filtro-fecha"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            aria-label="Desde"
            title="Desde"
          />

          <input
            className="filtro-fecha"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            aria-label="Hasta"
            title="Hasta"
          />

          {hayFiltros && (
            <button
              className="sutil"
              type="button"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          )}

          <button
            className="sutil"
            type="button"
            onClick={cargarDatos}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <span className="cantidad-productos">
            {comprasFiltradas.length} compras
          </span>

        </div>

        {cargando ? (
          <div className="vacio">
            <RefreshCw size={30} />
            <p>Cargando compras...</p>
          </div>
        ) : error ? (
          <div className="vacio">
            <div className="vacio-icono">
              <ClipboardList size={30} />
            </div>
            <h3>
              No se pudieron cargar las compras
            </h3>
            <p>
              {error}
            </p>
          </div>
        ) : compras.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <ClipboardList size={30} />
            </div>
            <h3>
              Todavía no hay compras registradas
            </h3>
            <p>
              Cuando registres compras a proveedores
              aparecerán aquí.
            </p>
          </div>
        ) : comprasFiltradas.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <ClipboardList size={30} />
            </div>
            <h3>
              Sin resultados
            </h3>
            <p>
              Ninguna compra coincide con los filtros
              seleccionados.
            </p>
            <button
              className="crear"
              type="button"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="detalle-tabla-contenedor">

            <div className="detalle-tabla compras-lista">

              <div className="detalle-tabla-cabecera">
                <div>Fecha</div>
                <div>Proveedor</div>
                <div>Comprobante</div>
                <div>Total</div>
                <div>Ítems</div>
                <div>Observaciones</div>
              </div>

              {comprasFiltradas.map((compra) => {
                const total = totalDeCompra(compra.id)
                const cantidadItems =
                  (itemsPorCompra[compra.id] || [])
                    .length

                return (
                  <div
                    className="detalle-tabla-fila"
                    key={compra.id}
                    onClick={() =>
                      setSeleccionada(compra)
                    }
                    style={{
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <strong>
                        {formatearFechaCorta(
                          compra.fecha
                        )}
                      </strong>
                    </div>
                    <div>
                      {compra.proveedores?.nombre ||
                        '—'}
                    </div>
                    <div className="secundario">
                      {compra.comprobante || '—'}
                    </div>
                    <div>
                      {total !== null
                        ? '$' +
                          Number(total).toLocaleString(
                            'es-UY'
                          )
                        : (
                          <span className="sin-costo-texto">
                            Sin costo
                          </span>
                        )}
                    </div>
                    <div className="secundario">
                      {cantidadItems}
                    </div>
                    <div className="secundario">
                      {compra.observaciones || '—'}
                    </div>
                  </div>
                )
              })}

            </div>

          </div>
        )}

      </section>
    </>
  )
}