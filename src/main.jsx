/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Auth from './Auth.jsx'
import { supabase } from './lib/supabase'
import {
  RECARGO_NOMBRE_TEXTO,
  RECARGO_BOLSITA,
  TAMANO_MAX_ARCHIVO,
  TIPOS_ARCHIVO_PERMITIDOS,
  crearPedido,
  etiquetaEstado,
  cargarArchivosDePedido,
  obtenerUrlFirmada
} from './lib/pedidos'

/* ============================================================
   PORTAL CLIENTE
   ============================================================ */

function PortalCliente({ cliente, cerrarSesion, tipo }) {
  const [vista, setVista] = useState('catalogo')
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargarCatalogo() {
    setCargando(true)

    const [
      respuestaProductos,
      respuestaCategorias
    ] = await Promise.all([
      supabase
        .from('productos')
        .select(`
          *,
          categorias (
            id,
            nombre
          )
        `)
        .eq('activo', true)
        .order('orden'),

      supabase
        .from('categorias')
        .select('*')
        .eq('activo', true)
        .order('orden')
    ])

    if (respuestaProductos.error) {
      console.error(
        'Error cargando productos:',
        respuestaProductos.error
      )
    }

    if (respuestaCategorias.error) {
      console.error(
        'Error cargando categorías:',
        respuestaCategorias.error
      )
    }

    setProductos(respuestaProductos.data || [])
    setCategorias(respuestaCategorias.data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarCatalogo()
  }, [])

  const productosFiltrados = productos.filter((producto) => {
    const coincideBusqueda =
      producto.nombre
        ?.toLowerCase()
        .includes(busqueda.toLowerCase())

    const coincideCategoria =
      !categoriaSeleccionada ||
      producto.categoria_id === categoriaSeleccionada

    return coincideBusqueda && coincideCategoria
  })

  function cerrarProducto() {
    setProductoSeleccionado(null)
  }

  function cerrarPedido() {
    setPedidoSeleccionado(null)
  }

  return (
    <div className="portal-cliente">

      <header className="portal-header">

        <div>
          <h1>Sistema de Pedidos</h1>

          <p>
            Hola, {cliente?.nombre || 'cliente'} 👋
          </p>
        </div>

        <div className="portal-header-derecha">

          <span className="tipo-cliente">
            {tipo === 'mayorista'
              ? 'Cliente mayorista'
              : 'Cliente minorista'}
          </span>

          <button
            onClick={cerrarSesion}
            className="boton-salir"
          >
            Cerrar sesión
          </button>

        </div>

      </header>

      <nav className="portal-nav">
        <button
          className={
            vista === 'catalogo'
              ? 'portal-nav-item activo'
              : 'portal-nav-item'
          }
          onClick={() => {
            setVista('catalogo')
            setPedidoSeleccionado(null)
          }}
        >
          Catálogo
        </button>

        <button
          className={
            vista === 'misPedidos'
              ? 'portal-nav-item activo'
              : 'portal-nav-item'
          }
          onClick={() => {
            setVista('misPedidos')
            setPedidoSeleccionado(null)
          }}
        >
          Mis pedidos
        </button>
      </nav>

      <main className="portal-contenido">

        {productoSeleccionado && (
          <DetalleCliente
            producto={productoSeleccionado}
            tipo={tipo}
            cliente={cliente}
            volver={cerrarProducto}
            cerrarSesion={cerrarSesion}
            onPedidoCreado={(pedido) => {
              setProductoSeleccionado(null)
              setVista('misPedidos')
              setPedidoSeleccionado(pedido)
            }}
          />
        )}

        {!productoSeleccionado &&
          vista === 'catalogo' && (
            <>
              <section className="catalogo-titulo">
                <div>
                  <h2>Catálogo</h2>
                  <p>
                    Elegí el producto que querés personalizar.
                  </p>
                </div>
              </section>

              <div className="catalogo-buscador">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) =>
                    setBusqueda(e.target.value)
                  }
                />
              </div>

              <div className="catalogo-categorias">
                <button
                  className={
                    categoriaSeleccionada === null
                      ? 'categoria-filtro activo'
                      : 'categoria-filtro'
                  }
                  onClick={() =>
                    setCategoriaSeleccionada(null)
                  }
                >
                  Todos
                </button>

                {categorias.map((categoria) => (
                  <button
                    key={categoria.id}
                    className={
                      categoriaSeleccionada === categoria.id
                        ? 'categoria-filtro activo'
                        : 'categoria-filtro'
                    }
                    onClick={() =>
                      setCategoriaSeleccionada(categoria.id)
                    }
                  >
                    {categoria.nombre}
                  </button>
                ))}
              </div>

              {cargando ? (
                <div className="catalogo-cargando">
                  Cargando catálogo...
                </div>
              ) : (
                <div className="catalogo-grid">
                  {productosFiltrados.map((producto) => (
                    <TarjetaProducto
                      key={producto.id}
                      producto={producto}
                      tipo={tipo}
                      abrir={() =>
                        setProductoSeleccionado(producto)
                      }
                    />
                  ))}
                </div>
              )}

              {!cargando &&
                productosFiltrados.length === 0 && (
                  <div className="catalogo-vacio">
                    <h3>
                      No encontramos productos
                    </h3>
                    <p>
                      Probá con otra búsqueda o categoría.
                    </p>
                  </div>
                )}
            </>
          )}

        {!productoSeleccionado &&
          vista === 'misPedidos' && (
            <MisPedidos
              cliente={cliente}
              pedidoSeleccionado={pedidoSeleccionado}
              abrirPedido={(pedido) =>
                setPedidoSeleccionado(pedido)
              }
              cerrarPedido={cerrarPedido}
              onNuevoPedido={() =>
                setVista('catalogo')
              }
            />
          )}

      </main>

    </div>
  )
}

/* ============================================================
   PORTAL MAYORISTA
   ============================================================ */

function PortalMayorista({
  cliente,
  cerrarSesion
}) {
  return (
    <PortalCliente
      cliente={cliente}
      cerrarSesion={cerrarSesion}
      tipo="mayorista"
    />
  )
}

/* ============================================================
   TARJETA PRODUCTO
   ============================================================ */

function TarjetaProducto({
  producto,
  tipo,
  abrir
}) {
  const precio = obtenerPrecio(producto, tipo)

  return (
    <div
      className="catalogo-producto"
      onClick={abrir}
    >

      <div className="catalogo-producto-imagen">

        {producto.imagen_principal ? (

          <img
            src={producto.imagen_principal}
            alt={producto.nombre}
          />

        ) : (

          <div className="catalogo-sin-imagen">
            Sin imagen
          </div>

        )}

      </div>

      <div className="catalogo-producto-info">

        <span>
          {producto.categorias?.nombre || 'Producto'}
        </span>

        <h3>
          {producto.nombre}
        </h3>

        {producto.descripcion && (
          <p>
            {producto.descripcion}
          </p>
        )}

        <div className="catalogo-producto-precio">

          {precio !== null ? (

            <>
              <small>Precio</small>

              <strong>
                $ {formatearPrecio(precio)}
              </strong>
            </>

          ) : (

            <strong>
              Consultar precio
            </strong>

          )}

        </div>

      </div>

    </div>
  )
}

/* ============================================================
   DETALLE PRODUCTO CLIENTE (FLUJO DE PEDIDO)
   ============================================================ */

function DetalleCliente({
  producto,
  tipo,
  cliente,
  volver,
  cerrarSesion,
  onPedidoCreado
}) {
  const [variantes, setVariantes] = useState([])
  const [variante, setVariante] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [nombreActivo, setNombreActivo] = useState(true)
  const [nombre, setNombre] = useState('')
  const [imagenActivo, setImagenActivo] = useState(true)
  const [imagenArchivo, setImagenArchivo] = useState(null)
  const [detalleActivo, setDetalleActivo] = useState(true)
  const [detalle, setDetalle] = useState('')
  const [bolsitaActivo, setBolsitaActivo] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const [respuestaVariantes, respuestaPreguntas] = await Promise.all([
      supabase
        .from('producto_variantes')
        .select('*')
        .eq('producto_id', producto.id)
        .eq('activo', true)
        .order('id'),

      supabase
        .from('producto_preguntas')
        .select(`
          *,
          preguntas (
            *,
            pregunta_opciones (
              *
            )
          )
        `)
        .eq('producto_id', producto.id)
        .eq('activo', true)
        .order('orden')
    ])

    if (respuestaVariantes.error) {
      console.error('Error cargando variantes:', respuestaVariantes.error)
    }

    if (respuestaPreguntas.error) {
      console.error('Error cargando preguntas:', respuestaPreguntas.error)
    }

    const variantesData = respuestaVariantes.data || []

    setVariantes(variantesData)
    setVariante(
      variantesData.length > 0 ? variantesData[0] : null
    )

    setPreguntas(respuestaPreguntas.data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarDatos()
  }, [producto.id])

  const precio =
    Number(variante?.precio) > 0
      ? Number(variante.precio)
      : obtenerPrecio(producto, tipo)

  const cantidadNumero = Math.max(1, Number(cantidad) || 1)
  const subtotal = (precio || 0) * cantidadNumero

  const recargoNombre =
    nombreActivo && nombre.trim()
      ? (precio || 0) * (RECARGO_NOMBRE_TEXTO / 100) * cantidadNumero
      : 0

  const recargoBolsita =
    bolsitaActivo
      ? RECARGO_BOLSITA * cantidadNumero
      : 0

  const recargos = recargoNombre + recargoBolsita
  const total = subtotal + recargos

  function setRespuesta(preguntaId, campo, valor) {
    setRespuestas((actuales) => ({
      ...actuales,
      [preguntaId]: {
        ...(actuales[preguntaId] || {}),
        [campo]: valor
      }
    }))
  }

  function manejarArchivo(e) {
    const archivo = e.target.files?.[0] || null

    setError('')
    setImagenArchivo(null)

    if (!archivo) {
      return
    }

    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
      setError('Formato no permitido. Usá PNG, JPG, WEBP, GIF, BMP, HEIC, HEIF o AVIF.')
      return
    }

    if (archivo.size > TAMANO_MAX_ARCHIVO) {
      setError('La imagen supera el máximo de 5 MB.')
      return
    }

    setImagenArchivo(archivo)
  }

  function validar() {
    if (!(precio > 0)) {
      return 'Este producto todavía no tiene precio configurado. Consultá al vendedor.'
    }

    for (const relacion of preguntas) {
      const pregunta = relacion.preguntas

      if (!pregunta || !relacion.obligatoria) {
        continue
      }

      const respuesta = respuestas[pregunta.id] || {}

      if (pregunta.tipo_respuesta === 'booleano') {
        if (respuesta.valorBooleano === undefined) {
          return `Respondé: ${pregunta.titulo}`
        }
        continue
      }

      if (pregunta.tipo_respuesta === 'opcion') {
        if (!respuesta.opcionId) {
          return `Elegí una opción: ${pregunta.titulo}`
        }
        continue
      }

      if (!respuesta.valorTexto?.trim()) {
        return `Respondé: ${pregunta.titulo}`
      }
    }

    return null
  }

  async function confirmarPedido() {
    const errorValidacion = validar()

    if (errorValidacion) {
      setError(errorValidacion)
      return
    }

    setGuardando(true)
    setError('')

    try {
      const items = [{
        producto,
        variante,
        cantidad: cantidadNumero,
        nombreActivo,
        nombre,
        imagenActivo,
        imagenArchivo,
        detalleActivo,
        detalle,
        bolsitaActivo,
        respuestas: preguntas
          .filter((relacion) => respuestas[relacion.preguntas?.id])
          .map((relacion) => {
            const pregunta = relacion.preguntas
            const respuesta = respuestas[pregunta.id]

            return {
              preguntaId: pregunta.id,
              tipo: pregunta.tipo_respuesta,
              valorTexto: respuesta.valorTexto,
              valorBooleano: respuesta.valorBooleano,
              opcionId: respuesta.opcionId
            }
          })
      }]

      const pedido = await crearPedido({
        cliente: {
          nombre: cliente?.nombre,
          telefono: cliente?.telefono,
          email: cliente?.email
        },
        items,
        tipo
      })

      onPedidoCreado(pedido)

    } catch (errorPedido) {
      console.error('Error creando pedido:', errorPedido)
      setError(
        errorPedido?.message ||
        'No se pudo enviar el pedido. Intentalo nuevamente.'
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="detalle-cliente">

      <header className="detalle-cliente-header">

        <button
          className="boton-volver-cliente"
          onClick={volver}
        >
          ← Volver al catálogo
        </button>

        <button
          onClick={cerrarSesion}
          className="boton-salir"
        >
          Cerrar sesión
        </button>

      </header>

      <section className="detalle-cliente-producto">

        <div className="detalle-cliente-imagen">

          {producto.imagen_principal ? (

            <img
              src={producto.imagen_principal}
              alt={producto.nombre}
            />

          ) : (

            <div>
              Sin imagen
            </div>

          )}

        </div>

        <div className="detalle-cliente-info">

          <span>
            {producto.categorias?.nombre || 'Producto'}
          </span>

          <h1>
            {producto.nombre}
          </h1>

          {producto.descripcion && (
            <p>
              {producto.descripcion}
            </p>
          )}

          <div className="detalle-precio">

            {precio !== null ? (

              <>
                <small>
                  Precio {tipo === 'mayorista'
                    ? 'mayorista'
                    : 'público'}
                </small>

                <strong>
                  $ {formatearPrecio(precio)}
                </strong>
              </>

            ) : (

              <strong>
                Consultar precio
              </strong>

            )}

          </div>

        </div>

      </section>

      <section className="detalle-cliente-form">

        <h2>
          Configurá tu pedido
        </h2>

        {cargando ? (
          <p>
            Cargando opciones...
          </p>
        ) : (
          <>
            {variantes.length > 0 && (
              <label className="detalle-campo">
                <span>
                  Variante
                </span>

                <select
                  value={variante?.id ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setVariante(
                      variantes.find((v) => v.id === id) || null
                    )
                  }}
                >
                  {variantes.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                    >
                      {v.nombre}

                      {Number(v.precio) > 0
                        ? ` — $${formatearPrecio(v.precio)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="detalle-campo">
              <span>
                Cantidad
              </span>

              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) =>
                  setCantidad(e.target.value)
                }
              />
            </label>

            {preguntas.map((relacion) => {
              const pregunta = relacion.preguntas

              if (!pregunta) {
                return null
              }

              const respuesta = respuestas[pregunta.id] || {}

              return (
                <div
                  className="detalle-pregunta"
                  key={pregunta.id}
                >
                  <strong>
                    {pregunta.titulo}
                    {relacion.obligatoria && (
                      <span className="obligatorio"> *</span>
                    )}
                  </strong>

                  {pregunta.tipo_respuesta === 'booleano' && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={
                          respuesta.valorBooleano === true
                        }
                        onChange={(e) =>
                          setRespuesta(
                            pregunta.id,
                            'valorBooleano',
                            e.target.checked
                          )
                        }
                      />
                      <span>Sí</span>
                    </label>
                  )}

                  {pregunta.tipo_respuesta === 'opcion' && (
                    <select
                      value={respuesta.opcionId ?? ''}
                      onChange={(e) =>
                        setRespuesta(
                          pregunta.id,
                          'opcionId',
                          e.target.value
                            ? Number(e.target.value)
                            : null
                        )
                      }
                    >
                      <option value="">
                        Seleccionar...
                      </option>

                      {(pregunta.pregunta_opciones || []).map((opcion) => (
                        <option
                          key={opcion.id}
                          value={opcion.id}
                        >
                          {opcion.nombre}
                        </option>
                      ))}
                    </select>
                  )}

                  {(pregunta.tipo_respuesta === 'texto' ||
                    pregunta.tipo_respuesta === 'numero') && (
                    <input
                      type={
                        pregunta.tipo_respuesta === 'numero'
                          ? 'number'
                          : 'text'
                      }
                      placeholder={
                        pregunta.placeholder ||
                        'Escribí tu respuesta...'
                      }
                      value={respuesta.valorTexto ?? ''}
                      onChange={(e) =>
                        setRespuesta(
                          pregunta.id,
                          'valorTexto',
                          e.target.value
                        )
                      }
                    />
                  )}
                </div>
              )
            })}

            <div className="detalle-opcion">
              <label className="check">
                <input
                  type="checkbox"
                  checked={nombreActivo}
                  onChange={(e) =>
                    setNombreActivo(e.target.checked)
                  }
                />
                <strong>
                  Nombre o texto (+{RECARGO_NOMBRE_TEXTO}%)
                </strong>
              </label>

              {nombreActivo && (
                <input
                  type="text"
                  placeholder="Ej: Sofía, Feliz cumpleaños, etc."
                  value={nombre}
                  onChange={(e) =>
                    setNombre(e.target.value)
                  }
                />
              )}
            </div>

            <div className="detalle-opcion">
              <label className="check">
                <input
                  type="checkbox"
                  checked={detalleActivo}
                  onChange={(e) =>
                    setDetalleActivo(e.target.checked)
                  }
                />
                <strong>
                  Detalle del diseño
                </strong>
              </label>

              {detalleActivo && (
                <textarea
                  rows="4"
                  placeholder="Explicá cómo querés el diseño, colores, ubicación, detalles, etc."
                  value={detalle}
                  onChange={(e) =>
                    setDetalle(e.target.value)
                  }
                />
              )}
            </div>

            <div className="detalle-opcion">
              <label className="check">
                <input
                  type="checkbox"
                  checked={bolsitaActivo}
                  onChange={(e) =>
                    setBolsitaActivo(e.target.checked)
                  }
                />
                <strong>
                  Bolsita de regalo (+${RECARGO_BOLSITA})
                </strong>
              </label>
            </div>

            <div className="detalle-opcion">
              <label className="check">
                <input
                  type="checkbox"
                  checked={imagenActivo}
                  onChange={(e) => {
                    setImagenActivo(e.target.checked)
                    if (!e.target.checked) {
                      setImagenArchivo(null)
                    }
                  }}
                />
                <strong>
                  Adjuntar foto o imagen de referencia
                </strong>
              </label>

              {imagenActivo && (
                <label className="detalle-archivo">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={manejarArchivo}
                  />
                  <span>
                    {imagenArchivo
                      ? imagenArchivo.name
                      : 'Elegir archivo'}
                  </span>
                </label>
              )}
            </div>

            <div className="detalle-resumen">
              <div>
                <span>Subtotal</span>
                <strong>$ {formatearPrecio(subtotal)}</strong>
              </div>
              <div>
                <span>Personalización</span>
                <strong>$ {formatearPrecio(recargos)}</strong>
              </div>
              <div className="detalle-resumen-total">
                <span>Total</span>
                <strong>$ {formatearPrecio(total)}</strong>
              </div>
            </div>

            {error && (
              <div className="detalle-error">
                {error}
              </div>
            )}

            <button
              className="boton-pedir"
              disabled={guardando}
              onClick={confirmarPedido}
            >
              {guardando
                ? 'Enviando pedido...'
                : 'Confirmar pedido'}
            </button>
          </>
        )}

      </section>

    </div>
  )
}

/* ============================================================
   MIS PEDIDOS
   ============================================================ */

function MisPedidos({
  cliente,
  pedidoSeleccionado,
  abrirPedido,
  cerrarPedido,
  onNuevoPedido
}) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarPedidos() {
    setCargando(true)

    const email = cliente?.email?.toLowerCase()

    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_email', email)
      .order('creado_en', { ascending: false })

    if (error) {
      console.error('Error cargando mis pedidos:', error)
      setPedidos([])
      setCargando(false)
      return
    }

    setPedidos(data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarPedidos()
  }, [])

  if (pedidoSeleccionado) {
    return (
      <PedidoClienteDetalle
        pedido={pedidoSeleccionado}
        volver={cerrarPedido}
        onNuevoPedido={onNuevoPedido}
      />
    )
  }

  return (
    <>
      <section className="catalogo-titulo">
        <div>
          <h2>Mis pedidos</h2>
          <p>
            Seguí el estado de tus pedidos.
          </p>
        </div>
      </section>

      {cargando ? (
        <div className="catalogo-cargando">
          Cargando pedidos...
        </div>
      ) : pedidos.length === 0 ? (
        <div className="catalogo-vacio">
          <h3>No tenés pedidos todavía</h3>
          <p>
            Cuando hagas tu primer pedido aparecerá acá.
          </p>
          <button
            className="boton-pedir"
            onClick={onNuevoPedido}
          >
            Hacer un pedido
          </button>
        </div>
      ) : (
        <div className="mis-pedidos">
          {pedidos.map((pedido) => (
            <div
              className="mis-pedidos-item"
              key={pedido.id}
              onClick={() => abrirPedido(pedido)}
            >
              <div>
                <strong>
                  Pedido #{pedido.numero_pedido || pedido.id}
                </strong>
                <small>
                  {formatearFecha(pedido.creado_en)}
                </small>
              </div>

              <div>
                <span className={`estado-badge estado-${pedido.estado}`}>
                  {etiquetaEstado(pedido.estado)}
                </span>
                <strong>
                  $ {formatearPrecio(pedido.total)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ============================================================
   DETALLE DE PEDIDO PARA EL CLIENTE
   ============================================================ */

function PedidoClienteDetalle({
  pedido,
  volver,
  onNuevoPedido
}) {
  const [detalles, setDetalles] = useState([])
  const [personalizaciones, setPersonalizaciones] = useState([])
  const [archivos, setArchivos] = useState([])
  const [urlsFirmadas, setUrlsFirmadas] = useState({})
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarDetalle() {
    setCargando(true)

    const [
      respuestaDetalles,
      respuestaHistorial
    ] = await Promise.all([
      supabase
        .from('pedido_detalles')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('id'),

      supabase
        .from('historial_pedidos')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('created_at')
    ])

    const detallesData = respuestaDetalles.data || []

    setDetalles(detallesData)
    setHistorial(respuestaHistorial.data || [])

    if (detallesData.length > 0) {
      const ids = detallesData.map((item) => item.id)

      const { data: personalizacionesData, error: errorPers } = await supabase
        .from('pedido_personalizaciones')
        .select('*')
        .in('pedido_detalle_id', ids)

      if (!errorPers) {
        setPersonalizaciones(personalizacionesData || [])
      }
    }

    const archivosData = await cargarArchivosDePedido(pedido.id)
    setArchivos(archivosData)

    const urls = {}
    for (const archivo of archivosData) {
      const url = await obtenerUrlFirmada(archivo)
      if (url) {
        urls[archivo.id] = url
      }
    }
    setUrlsFirmadas(urls)

    setCargando(false)
  }
useEffect(() => {
    cargarDetalle()
  }, [pedido.id])

  return (
    <>
      <section className="catalogo-titulo">
        <div>
          <button
            className="boton-volver-cliente"
            onClick={volver}
          >
            ← Volver a mis pedidos
          </button>

          <h2>
            Pedido #{pedido.numero_pedido || pedido.id}
          </h2>

          <p>
            Creado el {formatearFecha(pedido.creado_en)}
          </p>

          <span className={`estado-badge estado-${pedido.estado}`}>
            {etiquetaEstado(pedido.estado)}
          </span>
        </div>
      </section>

      {cargando ? (
        <div className="catalogo-cargando">
          Cargando pedido...
        </div>
      ) : (
        <>
          <div className="mis-pedidos">
            {detalles.map((detalle) => {
              const opciones = personalizaciones.filter(
                (item) => item.pedido_detalle_id === detalle.id
              )

              const archivosDetalle = archivos.filter(
                (item) => item.pedido_detalle_id === detalle.id
              )

              return (
                <div
                  className="mis-pedidos-item detalle"
                  key={detalle.id}
                >
                  <div>
                    <strong>
                      {detalle.cantidad} × {detalle.producto_nombre}
                    </strong>
                    <small>
                      $ {formatearPrecio(detalle.precio_unitario)} c/u · $
                      {formatearPrecio(detalle.subtotal)}
                    </small>
                  </div>

                  {detalle.detalle && (
                    <div className="detalle-info-bloque">
                      <strong>Detalle del diseño</strong>
                      <p>{detalle.detalle}</p>
                    </div>
                  )}

                  {opciones.length > 0 && (
                    <div className="detalle-info-bloque">
                      <strong>Personalización</strong>
                      {opciones.map((opcion) => (
                        <p key={opcion.id}>
                          {opcion.nombre}: {opcion.valor_texto}
                          {Number(opcion.recargo_calculado) > 0
                            ? ` (+$${formatearPrecio(opcion.recargo_calculado)})`
                            : ''}
                        </p>
                      ))}
                    </div>
                  )}

                  {archivosDetalle.length > 0 && (
                    <div className="detalle-info-bloque">
                      <strong>Archivos</strong>
                      <div className="archivos-cliente">
                        {archivosDetalle.map((archivo) => (
                          urlsFirmadas[archivo.id] ? (
                            <a
                              key={archivo.id}
                              href={urlsFirmadas[archivo.id]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={urlsFirmadas[archivo.id]}
                                alt={archivo.nombre_original}
                              />
                            </a>
                          ) : (
                            <span key={archivo.id}>
                              {archivo.nombre_original}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="detalle-resumen">
            <div>
              <span>Subtotal</span>
              <strong>$ {formatearPrecio(pedido.subtotal)}</strong>
            </div>
            <div>
              <span>Personalización</span>
              <strong>$ {formatearPrecio(pedido.recargos)}</strong>
            </div>
            <div className="detalle-resumen-total">
              <span>Total</span>
              <strong>$ {formatearPrecio(pedido.total)}</strong>
            </div>
          </div>

          {historial.length > 0 && (
            <div className="detalle-info-bloque">
              <strong>Historial del pedido</strong>
              {historial.map((registro) => (
                <p key={registro.id}>
                  {registro.accion} — {formatearFecha(registro.created_at)}
                </p>
              ))}
            </div>
          )}

          <button
            className="boton-pedir"
            onClick={onNuevoPedido}
          >
            Hacer otro pedido
          </button>
        </>
      )}
    </>
  )
}

/* ============================================================
   PRECIOS
   ============================================================ */

function obtenerPrecio(producto, tipo) {

  if (tipo === 'mayorista') {

    if (
      producto.precio_mayorista !== null &&
      producto.precio_mayorista !== undefined
    ) {
      return Number(producto.precio_mayorista)
    }

    if (
      producto.precio_mayorista_sugerido !== null &&
      producto.precio_mayorista_sugerido !== undefined
    ) {
      return Number(
        producto.precio_mayorista_sugerido
      )
    }
  }

  if (tipo === 'minorista') {

    if (
      producto.precio_publico !== null &&
      producto.precio_publico !== undefined
    ) {
      return Number(producto.precio_publico)
    }

    if (
      producto.precio_publico_sugerido !== null &&
      producto.precio_publico_sugerido !== undefined
    ) {
      return Number(
        producto.precio_publico_sugerido
      )
    }
  }

  if (
    producto.precio !== null &&
    producto.precio !== undefined
  ) {
    return Number(producto.precio)
  }

  return null
}


function formatearPrecio(valor) {

  return Number(valor || 0).toLocaleString(
    'es-UY',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )
}


function formatearFecha(fecha) {

  if (!fecha) {
    return ''
  }

  return new Date(
    fecha
  ).toLocaleString(
    'es-UY',
    {
      dateStyle:
        'short',
      timeStyle:
        'short'
    }
  )
}

/* ============================================================
   SISTEMA
   ============================================================ */

function Sistema() {

  const [usuario, setUsuario] = useState(null)
  const [tipoCuenta, setTipoCuenta] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {

    verificarSesion()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {

        if (!session) {

          setUsuario(null)
          setTipoCuenta(null)
          setCargando(false)

        }

      }
    )

    return () => {
      subscription.unsubscribe()
    }

  }, [])


  async function verificarSesion() {

    const { data, error } =
      await supabase.auth.getSession()

    if (error) {

      console.error(
        'Error obteniendo sesión:',
        error
      )

      setCargando(false)
      return

    }

    if (!data.session) {

      setCargando(false)
      return

    }

    await cargarPerfil(
      data.session.user
    )

    setCargando(false)
  }


  async function cargarPerfil(authUser) {

    /* ========================================================
       USUARIO INTERNO
       ======================================================== */

    const {
      data: usuarioDB,
      error: errorUsuario
    } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()

    if (errorUsuario) {

      console.error(
        'Error buscando usuario interno:',
        errorUsuario
      )

    }

    if (usuarioDB) {

      const {
        data: rolDB,
        error: errorRol
      } = await supabase
        .from('roles')
        .select('id, nombre')
        .eq('id', usuarioDB.rol_id)
        .maybeSingle()

      if (errorRol) {

        console.error(
          'Error buscando rol:',
          errorRol
        )

      }

      setUsuario({
        ...usuarioDB,
        roles: rolDB
      })

      setTipoCuenta('usuario')

      return
    }


    /* ========================================================
       CLIENTE
       ======================================================== */

    const {
      data: clienteDB,
      error: errorCliente
    } = await supabase
      .from('clientes')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()

    if (errorCliente) {

      console.error(
        'Error buscando cliente:',
        errorCliente
      )

      return
    }

    if (clienteDB) {

      setUsuario(clienteDB)

      if (
        clienteDB.tipo_cliente === 'mayorista'
      ) {

        setTipoCuenta('mayorista')

      } else {

        setTipoCuenta('minorista')

      }

      return
    }

    console.error(
      'La cuenta existe pero no tiene usuario ni cliente.'
    )
  }


  async function cerrarSesion() {

    await supabase.auth.signOut()

    setUsuario(null)
    setTipoCuenta(null)
  }


  /* ==========================================================
     CARGANDO
     ========================================================== */

  if (cargando) {

    return (

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >

        <h2>
          Cargando sistema...
        </h2>

      </div>

    )
  }


  /* ==========================================================
     SIN SESIÓN
     ========================================================== */

  if (!usuario) {

    return (

      <Auth
        onAuthenticated={({
          authUser,
          tipo,
          usuario,
          cliente
        }) => {

          if (tipo === 'usuario') {

            setUsuario(usuario)
            setTipoCuenta('usuario')

            return
          }

          if (tipo === 'cliente') {

            setUsuario(cliente)

            if (
              cliente?.tipo_cliente === 'mayorista'
            ) {

              setTipoCuenta('mayorista')

            } else {

              setTipoCuenta('minorista')

            }

            return
          }

          if (authUser) {

            cargarPerfil(authUser)

          }

        }}
      />

    )
  }


  /* ==========================================================
     PANEL INTERNO
     ========================================================== */

  if (tipoCuenta === 'usuario') {

    const rol = usuario.rol_id

    if (
      rol === 1 ||
      rol === 2 ||
      rol === 3 ||
      rol === 4
    ) {

      return (

        <App
          usuario={usuario}
          cerrarSesion={cerrarSesion}
        />

      )
    }

    return (

      <div className="pantalla-centro">

        <h2>
          Cuenta sin configurar
        </h2>

        <p>
          Tu usuario interno todavía no tiene
          un rol válido.
        </p>

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>

      </div>

    )
  }


  /* ==========================================================
     MAYORISTA
     ========================================================== */

  if (tipoCuenta === 'mayorista') {

    return (

      <PortalMayorista
        cliente={usuario}
        cerrarSesion={cerrarSesion}
      />

    )
  }


  /* ==========================================================
     MINORISTA
     ========================================================== */

  if (tipoCuenta === 'minorista') {

    return (

      <PortalCliente
        cliente={usuario}
        cerrarSesion={cerrarSesion}
        tipo="minorista"
      />

    )
  }


  return (

    <div className="pantalla-centro">

      <h2>
        Cuenta sin configurar
      </h2>

      <p>
        No se pudo determinar el tipo de cuenta.
      </p>

      <button onClick={cerrarSesion}>
        Cerrar sesión
      </button>

    </div>

  )
}


/* ============================================================
   INICIO
   ============================================================ */

createRoot(
  document.getElementById('root')
).render(

  <StrictMode>
    <Sistema />
  </StrictMode>

)
