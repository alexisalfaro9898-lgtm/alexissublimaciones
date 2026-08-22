import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Truck,
  Search,
  RefreshCw,
  Plus,
  ArrowLeft,
  Save,
  Check,
  Pencil
} from 'lucide-react'

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([])
  const [conteos, setConteos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [web, setWeb] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [nuevoActivo, setNuevoActivo] = useState(true)

  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [mostrarEdicion, setMostrarEdicion] = useState(false)

  function avisar(texto) {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 2800)
  }

  async function cargarDatos() {
    setCargando(true)

    const [respuesta, respuestaRelaciones] = await Promise.all([
      supabase
        .from('proveedores')
        .select('*')
        .order('nombre'),

      supabase
        .from('producto_proveedores')
        .select('proveedor_id')
    ])

    if (respuesta.error) {
      console.error('Error cargando proveedores:', respuesta.error)
      setCargando(false)
      return
    }

    const conteosNuevos = {}
    for (const relacion of respuestaRelaciones.data || []) {
      conteosNuevos[relacion.proveedor_id] =
        (conteosNuevos[relacion.proveedor_id] || 0) + 1
    }

    setProveedores(respuesta.data || [])
    setConteos(conteosNuevos)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!seleccionado) {
      setDetalle(null)
      setErrorDetalle('')
      setMostrarEdicion(false)
      return
    }

    let activo = true

    async function cargarDetalle() {
      setCargandoDetalle(true)
      setErrorDetalle('')
      setDetalle(null)

      const { data, error } = await supabase.rpc(
        'proveedor_detalle',
        { p_proveedor_id: seleccionado.id }
      )

      if (!activo) return

      setCargandoDetalle(false)

      if (error) {
        console.error('Error cargando detalle del proveedor:', error)
        setErrorDetalle(error.message || 'No se pudo cargar el detalle.')
        return
      }

      setDetalle(data)
    }

    cargarDetalle()

    return () => {
      activo = false
    }
  }, [seleccionado?.id])

  const proveedoresFiltrados = proveedores.filter((proveedor) => {
    const texto =
      `${proveedor.nombre || ''} ${proveedor.email || ''} ` +
      `${proveedor.telefono || ''} ${proveedor.whatsapp || ''} ` +
      `${proveedor.web || ''}`
        .toLowerCase()

    return texto.includes(busqueda.toLowerCase())
  })

  async function crearProveedor(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      alert('Ingresá el nombre del proveedor.')
      return
    }

    setGuardando(true)

    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        web: web.trim() || null,
        observaciones: observaciones.trim() || null,
        activo: nuevoActivo
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando proveedor:', error)
      alert('No se pudo crear el proveedor: ' + error.message)
      setGuardando(false)
      return
    }

    setProveedores((actuales) => [data, ...actuales])
    setConteos((actuales) => ({ ...actuales, [data.id]: 0 }))

    setNombre('')
    setTelefono('')
    setWhatsapp('')
    setEmail('')
    setWeb('')
    setObservaciones('')
    setNuevoActivo(true)
    setMostrarFormulario(false)
    setGuardando(false)
    avisar('Proveedor creado.')
  }

  function setCampo(campo, valor) {
    setSeleccionado((actual) => ({ ...actual, [campo]: valor }))
  }

  async function guardarCambios(e) {
    e.preventDefault()

    if (!seleccionado?.nombre?.trim()) {
      alert('El nombre del proveedor es obligatorio.')
      return
    }

    setGuardando(true)

    const { data, error } = await supabase
      .from('proveedores')
      .update({
        nombre: seleccionado.nombre.trim(),
        telefono: seleccionado.telefono?.trim() || null,
        whatsapp: seleccionado.whatsapp?.trim() || null,
        email: seleccionado.email?.trim() || null,
        web: seleccionado.web?.trim() || null,
        observaciones: seleccionado.observaciones?.trim() || null
      })
      .eq('id', seleccionado.id)
      .select()
      .single()

    if (error) {
      console.error('Error guardando proveedor:', error)
      alert('No se pudo guardar el proveedor: ' + error.message)
      setGuardando(false)
      return
    }

    setProveedores((actuales) =>
      actuales.map((p) => (p.id === data.id ? data : p))
    )
    setSeleccionado(data)
    setGuardando(false)
    avisar('Proveedor actualizado.')
  }

  async function cambiarActivo() {
    const nuevoValor = !seleccionado.activo

    setGuardando(true)

    const { data, error } = await supabase
      .from('proveedores')
      .update({ activo: nuevoValor })
      .eq('id', seleccionado.id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando estado:', error)
      alert('No se pudo cambiar el estado: ' + error.message)
      setGuardando(false)
      return
    }

    setProveedores((actuales) =>
      actuales.map((p) => (p.id === data.id ? data : p))
    )
    setSeleccionado(data)
    setGuardando(false)
    avisar(
      nuevoValor
        ? 'Proveedor activado.'
        : 'Proveedor desactivado.'
    )
  }

  if (seleccionado) {
    const proveedorNoEncontrado =
      errorDetalle.includes('Proveedor no encontrado')

    return (
      <>
        <header className="topbar">
          <div>
            <button
              className="boton-volver"
              onClick={() => setSeleccionado(null)}
            >
              <ArrowLeft size={18} />
              Volver a proveedores
            </button>
            <h1>
              {seleccionado.nombre}
            </h1>
            <p>
              {seleccionado.email ||
                seleccionado.telefono ||
                seleccionado.whatsapp ||
                'Sin contacto'}
            </p>
          </div>
          <button
            className="nuevo-pedido"
            type="button"
            onClick={() => setMostrarEdicion((actual) => !actual)}
          >
            <Pencil size={18} />
            {mostrarEdicion
              ? 'Cerrar edición'
              : 'Editar proveedor'}
          </button>
        </header>

        <section className="panel detalle-panel">

          <div className="panel-header">
            <div>
              <h2>
                Datos del proveedor
              </h2>
            </div>
            <span
              className={
                'estado-badge-adm' +
                (seleccionado.activo ? ' activo' : ' inactivo')
              }
            >
              {seleccionado.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <div className="cliente-tipo-acciones">
            <button
              type="button"
              disabled={guardando}
              onClick={cambiarActivo}
            >
              {seleccionado.activo
                ? 'Desactivar proveedor'
                : 'Activar proveedor'}
            </button>
          </div>

          <div className="detalle-datos">
            <div>
              <span>Nombre</span>
              <strong>{seleccionado.nombre}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{seleccionado.telefono || '—'}</strong>
            </div>
            <div>
              <span>WhatsApp</span>
              <strong>{seleccionado.whatsapp || '—'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{seleccionado.email || '—'}</strong>
            </div>
            <div>
              <span>Sitio web</span>
              <strong>{seleccionado.web || '—'}</strong>
            </div>
            <div>
              <span>Observaciones</span>
              <strong>{seleccionado.observaciones || '—'}</strong>
            </div>
            <div>
              <span>Productos relacionados</span>
              <strong>
                {conteos[seleccionado.id] || 0}
              </strong>
            </div>
            <div>
              <span>Fecha de alta</span>
              <strong>
                {formatearFecha(seleccionado.created_at)}
              </strong>
            </div>
          </div>

        </section>

        {mostrarEdicion && (
          <section className="panel detalle-panel">

            <div className="panel-header">
              <div>
                <h2>
                  Editar proveedor
                </h2>
                <p>
                  Actualizá los datos de contacto del proveedor.
                </p>
              </div>
            </div>

            <form
              className="proveedor-form"
              onSubmit={guardarCambios}
            >
              <div className="cliente-form-campo">
                <label htmlFor="prov-nombre">Nombre *</label>
                <input
                  id="prov-nombre"
                  type="text"
                  value={seleccionado.nombre || ''}
                  onChange={(e) => setCampo('nombre', e.target.value)}
                />
              </div>
              <div className="cliente-form-campo">
                <label htmlFor="prov-telefono">Teléfono</label>
                <input
                  id="prov-telefono"
                  type="text"
                  value={seleccionado.telefono || ''}
                  onChange={(e) => setCampo('telefono', e.target.value)}
                />
              </div>
              <div className="cliente-form-campo">
                <label htmlFor="prov-whatsapp">WhatsApp</label>
                <input
                  id="prov-whatsapp"
                  type="text"
                  value={seleccionado.whatsapp || ''}
                  onChange={(e) => setCampo('whatsapp', e.target.value)}
                />
              </div>
              <div className="cliente-form-campo">
                <label htmlFor="prov-email">Email</label>
                <input
                  id="prov-email"
                  type="email"
                  value={seleccionado.email || ''}
                  onChange={(e) => setCampo('email', e.target.value)}
                />
              </div>
              <div className="cliente-form-campo">
                <label htmlFor="prov-web">Sitio web</label>
                <input
                  id="prov-web"
                  type="text"
                  value={seleccionado.web || ''}
                  onChange={(e) => setCampo('web', e.target.value)}
                />
              </div>
              <div className="cliente-form-campo ancho-completo">
                <label htmlFor="prov-obs">Observaciones</label>
                <textarea
                  id="prov-obs"
                  rows="2"
                  value={seleccionado.observaciones || ''}
                  onChange={(e) => setCampo('observaciones', e.target.value)}
                />
              </div>
              <div className="cliente-form-acciones">
                <button
                  className="crear"
                  type="submit"
                  disabled={guardando}
                >
                  <Save size={18} />
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>

          </section>
        )}

        <section className="panel detalle-panel">

          <div className="panel-header">
            <div>
              <h2>
                Productos que vende
              </h2>
              <p>
                Precios de compra actuales de este proveedor.
              </p>
            </div>
            {detalle && (
              <span className="cantidad-productos">
                {detalle.productos.length} productos
              </span>
            )}
          </div>

          {cargandoDetalle ? (
            <div className="vacio">
              <RefreshCw size={30} />
              <p>Cargando productos y compras...</p>
            </div>
          ) : proveedorNoEncontrado ? (
            <div className="vacio">
              <div className="vacio-icono">
                <Truck size={30} />
              </div>
              <h3>
                Proveedor no encontrado
              </h3>
              <p>
                El proveedor ya no existe o no se puede consultar.
              </p>
              <button
                className="crear"
                type="button"
                onClick={() => setSeleccionado(null)}
              >
                Volver a proveedores
              </button>
            </div>
          ) : errorDetalle ? (
            <div className="vacio">
              <div className="vacio-icono">
                <Truck size={30} />
              </div>
              <h3>
                No se pudo cargar el detalle
              </h3>
              <p>
                {errorDetalle}
              </p>
            </div>
          ) : detalle && detalle.productos.length === 0 ? (
            <div className="vacio">
              <div className="vacio-icono">
                <Truck size={30} />
              </div>
              <h3>
                Este proveedor aún no tiene productos
              </h3>
              <p>
                Cuando se relacionen productos con este proveedor
                aparecerán aquí.
              </p>
            </div>
          ) : detalle ? (
            <div className="detalle-tabla-contenedor">
              <div className="detalle-tabla productos">
                <div className="detalle-tabla-cabecera">
                  <div>Producto</div>
                  <div>Código interno</div>
                  <div>Código prov.</div>
                  <div>Precio compra</div>
                  <div>Moneda</div>
                  <div>Disponible</div>
                  <div>Principal</div>
                  <div>Mínimo</div>
                  <div>Entrega</div>
                  <div>Últ. cambio</div>
                </div>

                {detalle.productos.map((producto) => (
                  <div
                    className="detalle-tabla-fila"
                    key={producto.producto_id}
                  >
                    <div>
                      <strong>
                        {producto.producto_nombre}
                      </strong>
                    </div>
                    <div className="secundario">
                      {producto.codigo_interno || '—'}
                    </div>
                    <div className="secundario">
                      {producto.codigo_proveedor || '—'}
                    </div>
                    <div>
                      {producto.precio_compra !== null &&
                      producto.precio_compra !== undefined
                        ? '$' + formatearNumero(producto.precio_compra)
                        : <span className="sin-costo-texto">Sin precio</span>}
                    </div>
                    <div className="secundario">
                      {producto.moneda || 'UYU'}
                    </div>
                    <div
                      className={
                        producto.disponible
                          ? 'positivo'
                          : 'negativo'
                      }
                    >
                      {producto.disponible ? 'Sí' : 'No'}
                    </div>
                    <div>
                      {producto.es_principal ? (
                        <span className="chip-tipo mayorista">
                          Principal
                        </span>
                      ) : (
                        <span className="secundario">—</span>
                      )}
                    </div>
                    <div className="secundario">
                      {producto.cantidad_minima !== null &&
                      producto.cantidad_minima !== undefined
                        ? formatearNumero(producto.cantidad_minima)
                        : '—'}
                    </div>
                    <div className="secundario">
                      {producto.tiempo_entrega || '—'}
                    </div>
                    <div className="secundario">
                      {producto.ultimo_cambio_precio
                        ? formatearFecha(producto.ultimo_cambio_precio)
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

        </section>

        <section className="panel detalle-panel">

          <div className="panel-header">
            <div>
              <h2>
                Historial de compras
              </h2>
              <p>
                Compras realizadas a este proveedor.
              </p>
            </div>
            {detalle && (
              <span className="cantidad-productos">
                {detalle.compras.length} compras
              </span>
            )}
          </div>

          {cargandoDetalle ? (
            <div className="vacio">
              <RefreshCw size={30} />
              <p>Cargando compras...</p>
            </div>
          ) : errorDetalle || proveedorNoEncontrado ? (
            <div className="vacio">
              <p>
                No se pudo cargar el historial.
              </p>
            </div>
          ) : detalle && detalle.compras.length === 0 ? (
            <div className="vacio">
              <div className="vacio-icono">
                <Truck size={30} />
              </div>
              <h3>
                Todavía no hay compras registradas
              </h3>
              <p>
                Cuando registres compras a este proveedor
                aparecerán aquí.
              </p>
            </div>
          ) : detalle ? (
            <div className="detalle-tabla-contenedor">
              <div className="detalle-tabla compras">
                <div className="detalle-tabla-cabecera">
                  <div>Fecha</div>
                  <div>Comprobante</div>
                  <div>Observaciones</div>
                  <div>Total</div>
                  <div>Ítems</div>
                </div>

                {detalle.compras.map((compra) => (
                  <div
                    className="detalle-tabla-fila"
                    key={compra.compra_id}
                  >
                    <div>
                      <strong>
                        {formatearFecha(compra.fecha)}
                      </strong>
                    </div>
                    <div className="secundario">
                      {compra.comprobante || '—'}
                    </div>
                    <div className="secundario">
                      {compra.observaciones || '—'}
                    </div>
                    <div>
                      {compra.total !== null &&
                      compra.total !== undefined
                        ? '$' + formatearNumero(compra.total)
                        : '—'}
                    </div>
                    <div className="secundario">
                      {compra.items}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

        </section>

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
            Proveedores
          </h1>
          <p>
            Administrá tus proveedores y sus precios de compra.
          </p>
        </div>
        <button
          className="nuevo-pedido"
          type="button"
          onClick={() =>
            setMostrarFormulario((actual) => !actual)
          }
        >
          <Plus size={19} />
          {mostrarFormulario
            ? 'Cancelar'
            : 'Nuevo proveedor'}
        </button>
      </header>

      {mostrarFormulario && (
        <section
          className="panel detalle-panel"
          style={{ marginBottom: '20px' }}
        >
          <div className="panel-header">
            <div>
              <h2>
                Nuevo proveedor
              </h2>
              <p>
                Completá los datos del proveedor.
              </p>
            </div>
          </div>

          <form
            className="proveedor-form"
            onSubmit={crearProveedor}
          >
            <div className="cliente-form-campo">
              <label htmlFor="nuevo-prov-nombre">Nombre *</label>
              <input
                id="nuevo-prov-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Disershop"
                required
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="nuevo-prov-telefono">Teléfono</label>
              <input
                id="nuevo-prov-telefono"
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="nuevo-prov-whatsapp">WhatsApp</label>
              <input
                id="nuevo-prov-whatsapp"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="nuevo-prov-email">Email</label>
              <input
                id="nuevo-prov-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="nuevo-prov-web">Sitio web</label>
              <input
                id="nuevo-prov-web"
                type="text"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
              />
            </div>
            <div className="cliente-form-campo ancho-completo">
              <label htmlFor="nuevo-prov-obs">Observaciones</label>
              <textarea
                id="nuevo-prov-obs"
                rows="2"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
            <div className="cliente-form-campo ancho-completo">
              <label
                className="editar-toggle"
                style={{ alignSelf: 'flex-start' }}
              >
                <input
                  type="checkbox"
                  checked={nuevoActivo}
                  onChange={(e) => setNuevoActivo(e.target.checked)}
                />
                <span>
                  Proveedor activo
                </span>
              </label>
            </div>
            <div className="cliente-form-acciones">
              <button
                className="crear"
                type="submit"
                disabled={guardando}
              >
                <Save size={18} />
                {guardando
                  ? 'Guardando...'
                  : 'Crear proveedor'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">

        <div className="productos-toolbar">

          <div className="buscador">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <button
            className="sutil"
            type="button"
            onClick={cargarDatos}
            title="Actualizar"
          >
            <RefreshCw size={17} />
          </button>

          <span className="cantidad-productos">
            {proveedoresFiltrados.length} proveedores
          </span>

        </div>

        {cargando ? (
          <div className="vacio">
            <RefreshCw size={30} />
            <p>Cargando proveedores...</p>
          </div>
        ) : proveedoresFiltrados.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <Truck size={30} />
            </div>
            <h3>
              No hay proveedores
            </h3>
            <p>
              Creá tu primer proveedor con el botón
              "Nuevo proveedor".
            </p>
          </div>
        ) : (
          <div className="lista-configuracion">
            {proveedoresFiltrados.map((proveedor) => (
              <div
                className="configuracion-item"
                key={proveedor.id}
                onClick={() => setSeleccionado(proveedor)}
                style={{ cursor: 'pointer' }}
              >
                <div className="configuracion-icono">
                  <Truck size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong>
                    {proveedor.nombre}
                  </strong>
                  <span>
                    {proveedor.email ||
                      proveedor.telefono ||
                      proveedor.whatsapp ||
                      'Sin contacto'}
                    {proveedor.web
                      ? ` · ${proveedor.web}`
                      : ''}
                  </span>
                  <small>
                    {conteos[proveedor.id] || 0} productos
                  </small>
                </div>
                <span
                  className={
                    'estado-badge-adm' +
                    (proveedor.activo
                      ? ' activo'
                      : ' inactivo')
                  }
                >
                  {proveedor.activo
                    ? 'Activo'
                    : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        )}

      </section>

      {mensaje && (
        <div className="toast-aviso">
          <Check size={16} />
          {mensaje}
        </div>
      )}
    </>
  )
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function formatearFecha(fecha) {
  if (!fecha) return '—'

  return new Date(fecha).toLocaleString(
    'es-UY',
    { dateStyle: 'short', timeStyle: 'short' }
  )
}