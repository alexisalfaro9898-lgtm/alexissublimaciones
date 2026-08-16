import { useEffect, useState } from 'react'

import {
  Home,
  ShoppingBag,
  Users,
  Package,
  Palette,
  Truck,
  Settings,
  Plus,
  Clock,
  CheckCircle,
  ClipboardList,
  Search,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Save,
  Image,
  Gift,
  Type,
  Upload,
  RefreshCw,
  LogOut
} from 'lucide-react'

import { supabase } from './lib/supabase'
import {
  RECARGO_NOMBRE_TEXTO,
  RECARGO_BOLSITA,
  precioBaseItem,
  calcularRecargoItem,
  crearPedido,
  cargarEstados,
  cargarArchivosDePedido,
  obtenerUrlFirmada
} from './lib/pedidos'


/* ============================================================
   APP PRINCIPAL
   ============================================================ */

function App({ usuario, cerrarSesion }) {

  const [pagina, setPagina] = useState('Inicio')

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])

  const [productoSeleccionado, setProductoSeleccionado] =
    useState(null)

  const [pedidoSeleccionado, setPedidoSeleccionado] =
    useState(null)

  const [busqueda, setBusqueda] = useState('')

  const [cargandoProductos, setCargandoProductos] =
    useState(false)


async function cargarCategorias() {

    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('activo', true)
      .order('orden')


    if (error) {

      console.error(
        'Error cargando categorías:',
        error
      )

      return
    }


    setCategorias(data || [])
  }


  async function cargarProductos() {

    setCargandoProductos(true)


    const todos = []

    let desde = 0


    while (true) {

      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          categorias (
            nombre
          )
        `)
        .order('id', { ascending: false })
        .range(desde, desde + 999)


      if (error) {

        console.error(
          'Error cargando productos:',
          error
        )

        setCargandoProductos(false)

        return
      }


      todos.push(...(data || []))


      if (!data || data.length < 1000) {

        break
      }


      desde += 1000
    }


    setProductos(todos)

    setCargandoProductos(false)
  }  useEffect(() => {
    cargarCategorias()
  }, [])


  useEffect(() => {

    if (pagina === 'Productos') {
      cargarProductos()
    }

  }, [pagina])


  


  function abrirProducto(producto) {

    setProductoSeleccionado(producto)

    setPagina('ProductoDetalle')
  }


  function volverAProductos() {

    setProductoSeleccionado(null)

    setPagina('Productos')
  }


  function abrirPedido(pedido) {

    setPedidoSeleccionado(pedido)

    setPagina('PedidoDetalle')
  }


  function volverAPedidos() {

    setPedidoSeleccionado(null)

    setPagina('Pedidos')
  }


  const menu = [

    {
      nombre: 'Inicio',
      icono: Home
    },

    {
      nombre: 'Pedidos',
      icono: ShoppingBag
    },

    {
      nombre: 'Clientes',
      icono: Users
    },

    {
      nombre: 'Productos',
      icono: Package
    },

    {
      nombre: 'Diseños',
      icono: Palette
    },

    {
      nombre: 'Proveedores',
      icono: Truck
    },

    {
      nombre: 'Configuración',
      icono: Settings
    }

  ]


  const productosFiltrados =
    productos.filter((producto) =>
      (producto.nombre || '')
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        )
    )


  return (

    <div className="app">


      {/* ======================================================
          SIDEBAR
          ====================================================== */}

      <aside className="sidebar">


        <div className="logo">

          <div className="logo-icon">
            SP
          </div>

          <div>

            <strong>
              Sistema
            </strong>

            <span>
              Pedidos
            </span>

          </div>

        </div>


        <nav>

          {menu.map((item) => {

            const Icon = item.icono


            return (

              <button
                key={item.nombre}
                className={
                  `menu-item ${
                    pagina === item.nombre ||
                    (
                      item.nombre === 'Pedidos' &&
                      (
                        pagina === 'NuevoPedido' ||
                        pagina === 'PedidoDetalle'
                      )
                    )
                      ? 'activo'
                      : ''
                  }`
                }
                onClick={() => {

                  setPagina(
                    item.nombre
                  )

                  setProductoSeleccionado(null)

                  setPedidoSeleccionado(null)

                }}
              >

                <Icon size={20} />

                <span>
                  {item.nombre}
                </span>

              </button>

            )

          })}

        </nav>


        <div className="sidebar-bottom">

          <div className="usuario">

            <div className="avatar">
              {(usuario?.nombre || 'A').charAt(0).toUpperCase()}
            </div>

            <div>

              <strong>
                {usuario?.nombre || 'Administrador'}
              </strong>

              <span>
                {usuario?.roles?.nombre || 'Administrador'}
              </span>

            </div>

          </div>

          {cerrarSesion && (
            <button
              className="boton-salir"
              type="button"
              onClick={cerrarSesion}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          )}

        </div>

      </aside>


      {/* ======================================================
          CONTENIDO
          ====================================================== */}

      <main className="contenido">


        {pagina === 'Inicio' && (

          <Dashboard
            categorias={categorias}
            onNuevoPedido={() =>
              setPagina('NuevoPedido')
            }
          />

        )}


        {pagina === 'Pedidos' && (

          <Pedidos
            onNuevoPedido={() =>
              setPagina('NuevoPedido')
            }
            onAbrirPedido={abrirPedido}
          />

        )}


        {pagina === 'NuevoPedido' && (

          <NuevoPedido
            volver={() =>
              setPagina('Pedidos')
            }
            onCreado={(pedido) => {

              setPedidoSeleccionado(pedido)

              setPagina('PedidoDetalle')

            }}
          />

        )}


        {pagina === 'PedidoDetalle' &&
          pedidoSeleccionado && (

            <PedidoDetalle
              pedido={pedidoSeleccionado}
              volver={volverAPedidos}
              onEstadoCambiado={(estado) =>
                setPedidoSeleccionado((actual) =>
                  actual ? { ...actual, estado } : actual
                )
              }
            />

          )}


        {pagina === 'Productos' && (

          <Productos
            productos={productosFiltrados}
            categorias={categorias}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            cargando={cargandoProductos}
            onAbrirProducto={abrirProducto}
            onProductoCreado={cargarProductos}
          />

        )}


        {pagina === 'ProductoDetalle' &&
          productoSeleccionado && (

            <ProductoDetalle
              producto={productoSeleccionado}
              volver={volverAProductos}
            />

          )}


        {pagina !== 'Inicio' &&
          pagina !== 'Pedidos' &&
          pagina !== 'NuevoPedido' &&
          pagina !== 'PedidoDetalle' &&
          pagina !== 'Productos' &&
          pagina !== 'ProductoDetalle' && (

            <div className="pagina-proximamente">

              <Package size={50} />

              <h2>
                {pagina}
              </h2>

              <p>
                Esta sección la construiremos
                a continuación.
              </p>

            </div>

          )}

      </main>

    </div>

  )
}


/* ============================================================
   DASHBOARD
   ============================================================ */

function Dashboard({
  categorias,
  onNuevoPedido
}) {

  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarResumen() {
    setCargando(true)

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, cliente_nombre, cliente_telefono, estado, total, creado_en')
      .order('creado_en', { ascending: false })

    if (error) {
      console.error('Error cargando resumen:', error)
      setPedidos([])
      setCargando(false)
      return
    }

    setPedidos(data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarResumen()
  }, [])

  const contar = (estado) =>
    pedidos.filter((p) => p.estado === estado).length

  const pedidosNuevos = contar('nuevo')
  const enDiseno = contar('diseno')
  const enProduccion = contar('produccion')
  const listos = contar('listo')

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            Resumen
          </h1>
          <p>
            Este es el resumen de tu negocio.
          </p>
        </div>

        <button
          className="nuevo-pedido"
          type="button"
          onClick={onNuevoPedido}
        >
          <Plus size={19} />
          Nuevo pedido
        </button>
      </header>

      <section className="estadisticas">

        <div className="tarjeta">
          <div className="tarjeta-icono azul">
            <ClipboardList size={22} />
          </div>
          <div>
            <span>
              Pedidos nuevos
            </span>
            <strong>
              {cargando ? '—' : pedidosNuevos}
            </strong>
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-icono violeta">
            <Palette size={22} />
          </div>
          <div>
            <span>
              En diseño
            </span>
            <strong>
              {cargando ? '—' : enDiseno}
            </strong>
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-icono naranja">
            <Clock size={22} />
          </div>
          <div>
            <span>
              En producción
            </span>
            <strong>
              {cargando ? '—' : enProduccion}
            </strong>
          </div>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-icono verde">
            <CheckCircle size={22} />
          </div>
          <div>
            <span>
              Listos
            </span>
            <strong>
              {cargando ? '—' : listos}
            </strong>
          </div>
        </div>

      </section>

      <section className="grid-principal">

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                Últimos pedidos
              </h2>
              <p>
                Actividad reciente
              </p>
            </div>

          </div>

          {cargando ? (
            <div className="vacio">
              <RefreshCw size={30} />
              <p>Cargando pedidos...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="vacio">
              <div className="vacio-icono">
                <ShoppingBag size={30} />
              </div>
              <h3>
                No hay pedidos todavía
              </h3>
              <p>
                Cuando recibas tu primer pedido
                aparecerá aquí.
              </p>
              <button
                className="crear"
                onClick={onNuevoPedido}
              >
                <Plus size={18} />
                Crear pedido
              </button>
            </div>
          ) : (
            <div className="lista-configuracion">
              {pedidos.slice(0, 5).map((pedido) => (
                <div
                  className="configuracion-item"
                  key={pedido.id}
                >
                  <div className="configuracion-icono">
                    <ShoppingBag size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>
                      Pedido #{pedido.numero_pedido || pedido.id}
                    </strong>
                    <span>
                      {pedido.cliente_nombre || 'Cliente sin nombre'}
                      {pedido.cliente_telefono ? ` · ${pedido.cliente_telefono}` : ''}
                    </span>
                    <small>
                      {formatearFecha(pedido.creado_en)}
                    </small>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>
                      ${Number(pedido.total || 0).toLocaleString('es-UY')}
                    </strong>
                    <br />
                    <EstadoPedido estado={pedido.estado} />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        <div className="panel">

          <div className="panel-header">

            <div>
              <h2>
                Categorías
              </h2>
              <p>
                Productos disponibles
              </p>
            </div>

          </div>

          <div className="categorias">

            {categorias.map((categoria) => (
              <div
                className="categoria"
                key={categoria.id}
              >
                <div className="categoria-icono">
                  <Package size={20} />
                </div>
                <div>
                  <strong>
                    {categoria.nombre}
                  </strong>
                  <span>
                    {categoria.descripcion}
                  </span>
                </div>
              </div>
            ))}

          </div>

        </div>

      </section>

    </>
  )
}

/* ============================================================
   PEDIDOS
   ============================================================ */

function Pedidos({
  onNuevoPedido,
  onAbrirPedido
}) {

  const [pedidos, setPedidos] =
    useState([])

  const [cargando, setCargando] =
    useState(true)

  const [busqueda, setBusqueda] =
    useState('')

  const [filtro, setFiltro] =
    useState('todos')


  useEffect(() => {

    cargarPedidos()

  }, [])


  async function cargarPedidos() {

    setCargando(true)


    const {
      data,
      error
    } = await supabase
      .from('pedidos')
      .select('*')
      .order(
        'creado_en',
        {
          ascending: false
        }
      )


    if (error) {

      console.error(
        'Error cargando pedidos:',
        error
      )

      alert(
        'No se pudieron cargar los pedidos:\n\n' +
        error.message
      )

      setCargando(false)

      return
    }


    setPedidos(data || [])

    setCargando(false)
  }


  const pedidosFiltrados =
    pedidos.filter((pedido) => {

      const texto =
        `${pedido.numero_pedido || ''} ${pedido.cliente_nombre || ''} ${pedido.cliente_telefono || ''}`
          .toLowerCase()


      const coincideBusqueda =
        texto.includes(
          busqueda.toLowerCase()
        )


      const coincideEstado =
        filtro === 'todos' ||
        pedido.estado === filtro


      return (
        coincideBusqueda &&
        coincideEstado
      )

    })


  return (

    <>

      <header className="topbar">

        <div>

          <h1>
            Pedidos
          </h1>

          <p>
            Administrá todos los pedidos
            de tu negocio.
          </p>

        </div>


        <button
          className="nuevo-pedido"
          onClick={onNuevoPedido}
        >

          <Plus size={19} />

          Nuevo pedido

        </button>

      </header>


      <section className="panel">


        <div className="productos-toolbar">

          <div className="buscador">

            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar pedido o cliente..."
              value={busqueda}
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
            />

          </div>


          <button
            onClick={cargarPedidos}
            title="Actualizar"
          >

            <RefreshCw size={18} />

          </button>

        </div>


        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px'
          }}
        >

          <FiltroPedido
            activo={
              filtro === 'todos'
            }
            onClick={() =>
              setFiltro('todos')
            }
          >
            Todos
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'nuevo'
            }
            onClick={() =>
              setFiltro('nuevo')
            }
          >
            Nuevos
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'diseno'
            }
            onClick={() =>
              setFiltro('diseno')
            }
          >
            En diseño
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'revisar'
            }
            onClick={() =>
              setFiltro('revisar')
            }
          >
            En revisión
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'aprobacion'
            }
            onClick={() =>
              setFiltro('aprobacion')
            }
          >
            Aprobados
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'produccion'
            }
            onClick={() =>
              setFiltro('produccion')
            }
          >
            Producción
          </FiltroPedido>


          <FiltroPedido
            activo={
              filtro === 'listo'
            }
            onClick={() =>
              setFiltro('listo')
            }
          >
            Listos
          </FiltroPedido>

        </div>


        {cargando ? (

          <div className="vacio">

            <RefreshCw size={30} />

            <p>
              Cargando pedidos...
            </p>

          </div>

        ) : pedidosFiltrados.length === 0 ? (

          <div className="vacio">

            <div className="vacio-icono">

              <ShoppingBag size={30} />

            </div>

            <h3>
              No hay pedidos
            </h3>

            <p>
              Los pedidos que crees
              aparecerán aquí.
            </p>

            <button
              className="crear"
              onClick={onNuevoPedido}
            >

              <Plus size={18} />

              Crear pedido

            </button>

          </div>

        ) : (

          <div className="lista-configuracion">

            {pedidosFiltrados.map(
              (pedido) => (

                <div
                  className="configuracion-item"
                  key={pedido.id}
                  onClick={() =>
                    onAbrirPedido(
                      pedido
                    )
                  }
                  style={{
                    cursor:
                      'pointer'
                  }}
                >

                  <div
                    className="configuracion-icono"
                  >

                    <ShoppingBag
                      size={20}
                    />

                  </div>


                  <div
                    style={{
                      flex: 1
                    }}
                  >

                    <strong>

                      Pedido #
                      {pedido.numero_pedido ||
                        pedido.id}

                    </strong>


                    <span>

                      {pedido.cliente_nombre ||
                        'Cliente sin nombre'}

                      {pedido.cliente_telefono
                        ? ` · ${pedido.cliente_telefono}`
                        : ''}

                    </span>


                    <small>

                      {formatearFecha(
                        pedido.creado_en
                      )}

                    </small>

                  </div>


                  <div
                    style={{
                      textAlign:
                        'right'
                    }}
                  >

                    <strong>

                      $
                      {Number(
                        pedido.total ||
                        0
                      ).toLocaleString(
                        'es-UY'
                      )}

                    </strong>


                    <br />


                    <EstadoPedido
                      estado={
                        pedido.estado
                      }
                    />

                  </div>


                  <ChevronRight
                    size={18}
                  />

                </div>

              )
            )}

          </div>

        )}

      </section>

    </>

  )
}


/* ============================================================
   FILTRO PEDIDOS
   ============================================================ */

function FiltroPedido({
  activo,
  onClick,
  children
}) {

  return (

    <button
      type="button"
      onClick={onClick}
      style={{
        padding:
          '8px 13px',
        borderRadius:
          '20px',
        border:
          '1px solid #ddd',
        background:
          activo
            ? '#111827'
            : '#fff',
        color:
          activo
            ? '#fff'
            : '#333',
        cursor:
          'pointer'
      }}
    >

      {children}

    </button>

  )
}


/* ============================================================
   NUEVO PEDIDO
   ============================================================ */

function NuevoPedido({
  volver,
  onCreado
}) {

  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  const [cliente, setCliente] = useState({
    nombre: '',
    telefono: '',
    email: ''
  })

  const [items, setItems] = useState([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [guardando, setGuardando] = useState(false)

  async function cargarProductos() {
    setCargando(true)

    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        categorias (
          nombre
        )
      `)
      .eq('activo', true)
      .order('nombre')

    if (error) {
      console.error('Error cargando productos:', error)
      alert(
        'No se pudieron cargar los productos:\n\n' +
        error.message
      )
      setProductos([])
      setCargando(false)
      return
    }

    setProductos(data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarProductos()
  }, [])

  async function agregarProducto() {
    if (!productoId) {
      alert('Seleccioná un producto.')
      return
    }

    const producto = productos.find(
      (item) => String(item.id) === String(productoId)
    )

    if (!producto || producto.id === null || producto.id === undefined) {
      alert('El producto seleccionado no es válido. Volvé a seleccionarlo.')
      return
    }

    const cantidadNumero = Math.max(1, Number(cantidad) || 1)

    const { data: variantesData, error: errorVariantes } = await supabase
      .from('producto_variantes')
      .select('id, nombre, color, talle, capacidad, precio, activo')
      .eq('producto_id', producto.id)
      .eq('activo', true)
      .order('id')

    if (errorVariantes) {
      console.error('Error cargando variantes:', errorVariantes)
    }

    const variantes = variantesData || []
    const variante = variantes.length > 0 ? variantes[0] : null

    const existenteIndex = items.findIndex(
      (item) =>
        String(item.producto?.id) === String(producto.id) &&
        String(item.variante?.id ?? '') === String(variante?.id ?? '')
    )

    if (existenteIndex >= 0) {
      setItems((actuales) =>
        actuales.map((item, index) =>
          index === existenteIndex
            ? {
                ...item,
                cantidad: Number(item.cantidad || 0) + cantidadNumero
              }
            : item
        )
      )
    } else {
      setItems((actuales) => [
        ...actuales,
        {
          producto,
          variantes,
          variante,
          cantidad: cantidadNumero,
          nombreActivo: true,
          nombre: '',
          imagenActivo: true,
          imagenArchivo: null,
          detalleActivo: true,
          detalle: '',
          bolsitaActivo: true,
          respuestas: []
        }
      ])
    }

    setProductoId('')
    setCantidad(1)
  }

  function eliminarItem(index) {
    setItems((actuales) => actuales.filter((_, i) => i !== index))
  }

  function actualizarItem(index, campo, valor) {
    setItems((actuales) =>
      actuales.map((item, i) =>
        i === index
          ? { ...item, [campo]: valor }
          : item
      )
    )
  }

  function precioBase(item) {
    return precioBaseItem(item)
  }

  function calcularRecargo(item) {
    return calcularRecargoItem(item)
  }

  function calcularSubtotal(item) {
    return precioBase(item) * Math.max(1, Number(item.cantidad) || 1)
  }

  const subtotal = items.reduce(
    (total, item) => total + calcularSubtotal(item),
    0
  )

  const recargos = items.reduce(
    (total, item) => total + calcularRecargo(item),
    0
  )

  const total = subtotal + recargos

  async function guardarPedido() {
    setGuardando(true)

    try {
      const pedidoCreado = await crearPedido({
        cliente: {
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          email: cliente.email
        },
        items
      })

      alert('Pedido creado correctamente.')
      onCreado(pedidoCreado)

    } catch (error) {
      console.error('Error creando pedido:', error)

      alert(
        'No se pudo crear el pedido:\n\n' +
        (error?.message || 'Error desconocido.')
      )

    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <button
            className="boton-volver"
            onClick={volver}
          >
            <ArrowLeft size={18} />
            Volver a pedidos
          </button>

          <h1>Nuevo pedido</h1>
          <p>Cargá el pedido del cliente paso a paso.</p>
        </div>
      </header>

      <section className="panel detalle-panel">
        <div className="panel-header">
          <div>
            <h2>1. Datos del cliente</h2>
            <p>Información básica para identificar el pedido.</p>
          </div>
        </div>

        <div className="form-grid">
          <Campo
            label="Nombre *"
            value={cliente.nombre}
            onChange={(valor) => setCliente({ ...cliente, nombre: valor })}
            placeholder="Ej: Juan Pérez"
          />

          <Campo
            label="Teléfono"
            value={cliente.telefono}
            onChange={(valor) => setCliente({ ...cliente, telefono: valor })}
            placeholder="Ej: 099 123 456"
          />

          <Campo
            label="Email"
            value={cliente.email}
            onChange={(valor) => setCliente({ ...cliente, email: valor })}
            placeholder="cliente@email.com"
            type="email"
          />
        </div>
      </section>

      <section className="panel detalle-panel">
        <div className="panel-header">
          <div>
            <h2>2. Productos</h2>
            <p>Agregá los productos que quiere el cliente.</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px auto',
            gap: '10px',
            alignItems: 'end'
          }}
        >
          <label>
            <span>Producto *</span>

            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              disabled={cargando || guardando}
              required
              style={{ width: '100%', padding: '11px' }}
            >
              <option value="">
                {cargando ? 'Cargando productos...' : 'Seleccionar producto...'}
              </option>

              {productos.map((producto) => (
                <option
                  key={producto.id}
                  value={producto.id}
                >
                  {producto.nombre}
                  {' — $'}
                  {Number(
                    producto.precio_publico ?? producto.precio ?? 0
                  ).toLocaleString('es-UY')}
                </option>
              ))}
            </select>
          </label>

          <Campo
            label="Cantidad"
            type="number"
            value={cantidad}
            onChange={(valor) => setCantidad(valor)}
            placeholder="1"
          />

          <button
            className="boton-guardar"
            type="button"
            onClick={agregarProducto}
            disabled={cargando || guardando}
          >
            <Plus size={17} />
            Agregar
          </button>
        </div>

        {items.length > 0 && (
          <div
            style={{
              marginTop: '25px',
              display: 'grid',
              gap: '18px'
            }}
          >
            {items.map((item, index) => (
              <PedidoProductoEditor
                key={`${item.producto.id}-${index}`}
                item={item}
                index={index}
                onChange={actualizarItem}
                onDelete={eliminarItem}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel detalle-panel">
        <div className="panel-header">
          <div>
            <h2>3. Resumen</h2>
            <p>Revisá el pedido antes de guardarlo.</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="seccion-vacia">
            <ShoppingBag size={30} />
            <span>Todavía no agregaste productos.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '10px' }}>
              {items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  <div>
                    <strong>
                      {item.cantidad}
                      {' × '}
                      {item.producto.nombre}
                    </strong>
                  </div>

                  <strong>
                    $
                    {calcularSubtotal(item).toLocaleString('es-UY')}
                  </strong>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '20px',
                marginLeft: 'auto',
                maxWidth: '380px',
                display: 'grid',
                gap: '10px'
              }}
            >
              <LineaPrecio titulo="Subtotal" valor={subtotal} />
              <LineaPrecio titulo="Personalización" valor={recargos} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '2px solid #222',
                  fontSize: '20px'
                }}
              >
                <strong>Total</strong>
                <strong>
                  $
                  {total.toLocaleString('es-UY')}
                </strong>
              </div>
            </div>

            <div className="precios-acciones">
              <button
                className="boton-cancelar"
                type="button"
                onClick={volver}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                className="boton-guardar"
                type="button"
                disabled={guardando}
                onClick={guardarPedido}
              >
                <Save size={17} />
                {guardando ? 'Guardando pedido...' : 'Confirmar pedido'}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  )
}

/* ============================================================
   EDITOR PRODUCTO DEL PEDIDO
   ============================================================ */

function PedidoProductoEditor({
  item,
  index,
  onChange,
  onDelete
}) {

  const precio = precioBaseItem(item)


  return (

    <div
      style={{
        border:
          '1px solid #e2e5e9',
        borderRadius:
          '14px',
        padding:
          '18px',
        background:
          '#fff'
      }}
    >

      {item.variantes?.length > 0 && (
        <div
          style={{
            marginBottom:
              '15px'
          }}
        >
          <label>
            <span>
              Variante
            </span>

            <select
              value={
                item.variante?.id ?? ''
              }
              onChange={(e) => {
                const id = Number(e.target.value)

                onChange(
                  index,
                  'variante',
                  item.variantes.find(
                    (v) => v.id === id
                  ) || null
                )
              }}
              style={{
                width: '100%',
                padding: '10px'
              }}
            >
              {item.variantes.map(
                (variante) => (
                  <option
                    key={variante.id}
                    value={variante.id}
                  >
                    {variante.nombre}

                    {Number(
                      variante.precio
                    ) > 0
                      ? ` — $${Number(variante.precio).toLocaleString('es-UY')}`
                      : ''}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      )}


      <div
        style={{
          display:
            'flex',
          justifyContent:
            'space-between',
          gap:
            '15px'
        }}
      >

        <div>

          <span className="producto-categoria">

            {item.producto.categorias
              ?.nombre ||
              'Producto'}

          </span>


          <h3
            style={{
              margin:
                '5px 0'
            }}
          >

            {item.producto.nombre}

          </h3>


          <span>

            {item.cantidad}
            {' × $'}
            {precio.toLocaleString(
              'es-UY'
            )}

          </span>

        </div>


        <button
          type="button"
          onClick={() =>
            onDelete(
              index
            )
          }
          title="Eliminar producto"
        >

          <Trash2 size={18} />

        </button>

      </div>


      <div
        style={{
          marginTop:
            '20px',
          display:
            'grid',
          gap:
            '12px'
        }}
      >


        {/* ==================================================
            NOMBRE
            ================================================== */}

        <div
          className="opcion-cliente"
        >

          <label
            className="check"
          >

            <input
              type="checkbox"
              checked={
                item.nombreActivo
              }
              onChange={(e) =>
                onChange(
                  index,
                  'nombreActivo',
                  e.target.checked
                )
              }
            />

            <strong>
              Nombre o texto
            </strong>

          </label>


          {item.nombreActivo && (

            <div
              style={{
                marginTop:
                  '8px'
              }}
            >

              <input
                type="text"
                value={
                  item.nombre
                }
                onChange={(e) =>
                  onChange(
                    index,
                    'nombre',
                    e.target.value
                  )
                }
                placeholder="Ej: Sofía, Feliz cumpleaños, etc."
              />

              <small
                style={{
                  display:
                    'block',
                  marginTop:
                    '5px'
                }}
              >

                Si se utiliza,
                se agrega un
                <strong>
                  {' '}
                  +{RECARGO_NOMBRE_TEXTO}%
                </strong>
                {' '}al precio.

              </small>

            </div>

          )}

        </div>


        {/* ==================================================
            FOTO
            ================================================== */}

        <div
          className="opcion-cliente"
        >

          <label
            className="check"
          >

            <input
              type="checkbox"
              checked={
                item.imagenActivo
              }
              onChange={(e) =>
                onChange(
                  index,
                  'imagenActivo',
                  e.target.checked
                )
              }
            />

            <strong>
              Foto o imagen
            </strong>

          </label>


          {item.imagenActivo && (

            <div
              style={{
                marginTop:
                  '10px'
              }}
            >

              <label
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap:
                    '8px',
                  padding:
                    '12px',
                  border:
                    '1px dashed #bbb',
                  borderRadius:
                    '10px',
                  cursor:
                    'pointer'
                }}
              >

                <Upload size={18} />

                <span>

                  {item.imagenArchivo
                    ? item.imagenArchivo.name
                    : 'Adjuntar imagen'}

                </span>


                <input
                  type="file"
                  accept="image/*"
                  style={{
                    display:
                      'none'
                  }}
                  onChange={(e) =>
                    onChange(
                      index,
                      'imagenArchivo',
                      e.target.files?.[0] ||
                      null
                    )
                  }
                />

              </label>

            </div>

          )}

        </div>


        {/* ==================================================
            DETALLE
            ================================================== */}

        <div
          className="opcion-cliente"
        >

          <label
            className="check"
          >

            <input
              type="checkbox"
              checked={
                item.detalleActivo
              }
              onChange={(e) =>
                onChange(
                  index,
                  'detalleActivo',
                  e.target.checked
                )
              }
            />

            <strong>
              Detalle del diseño
            </strong>

          </label>


          {item.detalleActivo && (

            <textarea
              value={
                item.detalle
              }
              onChange={(e) =>
                onChange(
                  index,
                  'detalle',
                  e.target.value
                )
              }
              placeholder="Explicá cómo querés el diseño, colores, ubicación, detalles, etc."
              rows="4"
              style={{
                marginTop:
                  '10px'
              }}
            />

          )}

        </div>


        {/* ==================================================
            BOLSITA
            ================================================== */}

        <div
          className="opcion-cliente"
        >

          <label
            className="check"
          >

            <input
              type="checkbox"
              checked={
                item.bolsitaActivo
              }
              onChange={(e) =>
                onChange(
                  index,
                  'bolsitaActivo',
                  e.target.checked
                )
              }
            />

            <strong>
              Bolsita de regalo
            </strong>

            <span
              style={{
                marginLeft:
                  'auto'
              }}
            >

              +$
              {RECARGO_BOLSITA}

            </span>

          </label>

        </div>

      </div>

    </div>

  )
}


/* ============================================================
   DETALLE PEDIDO
   ============================================================ */

function PedidoDetalle({
  pedido,
  volver,
  onEstadoCambiado
}) {

  const [
    detalles,
    setDetalles
  ] = useState([])

  const [
    personalizaciones,
    setPersonalizaciones
  ] = useState([])

  const [
    respuestas,
    setRespuestas
  ] = useState([])

  const [
    preguntas,
    setPreguntas
  ] = useState([])

  const [
    archivos,
    setArchivos
  ] = useState([])

  const [
    urlsFirmadas,
    setUrlsFirmadas
  ] = useState({})

  const [
    historial,
    setHistorial
  ] = useState([])

  const [
    estados,
    setEstados
  ] = useState([])

  const [
    cargando,
    setCargando
  ] = useState(true)

  const [
    estado,
    setEstado
  ] = useState(
    pedido.estado ||
    'nuevo'
  )

  const [
    guardandoEstado,
    setGuardandoEstado
  ] = useState(false)


  useEffect(() => {
    cargarDetalle()
  }, [pedido.id])


  async function cargarDetalle() {
    setCargando(true)

    const [
      resultadoDetalles,
      resultadoEstados,
      resultadoHistorial,
      resultadoPreguntas
    ] = await Promise.all([
      supabase
        .from('pedido_detalles')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('id'),

      cargarEstados(),

      supabase
        .from('historial_pedidos')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('created_at'),

      supabase
        .from('preguntas')
        .select(`
          id,
          titulo,
          tipo_respuesta,
          pregunta_opciones (
            id,
            nombre
          )
        `)
    ])

    if (resultadoDetalles.error) {
      console.error(resultadoDetalles.error)
      setCargando(false)
      return
    }

    const detallesData = resultadoDetalles.data || []

    setDetalles(detallesData)
    setEstados(resultadoEstados)
    setHistorial(resultadoHistorial.data || [])
    setPreguntas(resultadoPreguntas.data || [])

    if (detallesData.length > 0) {
      const ids = detallesData.map((item) => item.id)

      const [
        resultadoPersonalizaciones,
        resultadoRespuestas
      ] = await Promise.all([
        supabase
          .from('pedido_personalizaciones')
          .select('*')
          .in('pedido_detalle_id', ids),

        supabase
          .from('pedido_respuestas')
          .select('*')
          .in('pedido_item_id', ids)
      ])

      if (!resultadoPersonalizaciones.error) {
        setPersonalizaciones(resultadoPersonalizaciones.data || [])
      }

      if (!resultadoRespuestas.error) {
        setRespuestas(resultadoRespuestas.data || [])
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


  async function guardarEstado() {
    if (estado === pedido.estado) {
      return
    }

    setGuardandoEstado(true)

    const estadoAnterior = pedido.estado
    const estadoNuevo = estados.find((e) => e.valor === estado)

    const { error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', pedido.id)

    if (error) {
      console.error(error)

      setGuardandoEstado(false)

      alert(
        'No se pudo actualizar el estado:\n\n' +
        error.message
      )

      return
    }

    if (estadoNuevo) {
      const anterior = estados.find((e) => e.valor === estadoAnterior)

      const { error: errorHistorial } = await supabase
        .from('historial_pedidos')
        .insert({
          pedido_id: pedido.id,
          estado_anterior_id: anterior?.id ?? null,
          estado_nuevo_id: estadoNuevo.id,
          accion: `Estado: ${estadoAnterior} → ${estado}`,
          comentario: null
        })

      if (errorHistorial) {
        console.error(errorHistorial)
      }
    }

    if (onEstadoCambiado) {
      onEstadoCambiado(estado)
    }

    setGuardandoEstado(false)

    alert('Estado actualizado.')

    cargarDetalle()
  }


    return (
    <>
      <header className="topbar">
        <div>
          <button
            className="boton-volver"
            onClick={volver}
          >
            <ArrowLeft size={18} />
            Volver a pedidos
          </button>

          <h1>
            Pedido #
            {pedido.numero_pedido ||
              pedido.id}
          </h1>

          <p>
            Creado el{' '}
            {formatearFecha(
              pedido.creado_en
            )}
          </p>
        </div>

        <EstadoPedido
          estado={estado}
        />
      </header>

      <section className="panel detalle-panel">

        <div className="panel-header">
          <div>
            <h2>
              Cliente
            </h2>
          </div>
        </div>

        <div
          className="detalle-datos"
        >
          <div>
            <span>
              Nombre
            </span>
            <strong>
              {pedido.cliente_nombre ||
                'Sin nombre'}
            </strong>
          </div>

          <div>
            <span>
              Teléfono
            </span>
            <strong>
              {pedido.cliente_telefono ||
                'Sin teléfono'}
            </strong>
          </div>

          <div>
            <span>
              Email
            </span>
            <strong>
              {pedido.cliente_email ||
                'Sin email'}
            </strong>
          </div>
        </div>

      </section>

      <section className="panel detalle-panel">

        <div className="panel-header">
          <div>
            <h2>
              Productos
            </h2>
          </div>
        </div>

        {cargando ? (
          <div className="seccion-vacia">
            Cargando...
          </div>
        ) : (
          <div
            style={{
              display:
                'grid',
              gap:
                '15px'
            }}
          >
            {detalles.map(
              (detalle) => {

                const opciones =
                  personalizaciones.filter(
                    (item) =>
                      item.pedido_detalle_id ===
                      detalle.id
                  )

                const respuestasDetalle =
                  respuestas.filter(
                    (item) =>
                      item.pedido_item_id ===
                      detalle.id
                  )

                const archivosDetalle =
                  archivos.filter(
                    (item) =>
                      item.pedido_detalle_id ===
                      detalle.id
                  )

                return (
                  <div
                    key={
                      detalle.id
                    }
                    style={{
                      border:
                        '1px solid #e5e7eb',
                      borderRadius:
                        '12px',
                      padding:
                        '16px'
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between'
                      }}
                    >
                      <div>
                        <strong>
                          {detalle.cantidad}
                          {' × '}
                          {detalle.producto_nombre}
                        </strong>

                        {detalle.codigo_interno && (
                          <small
                            style={{
                              display:
                                'block',
                              color:
                                '#666'
                            }}
                          >
                            Código: {detalle.codigo_interno}
                          </small>
                        )}

                        <p>
                          $
                          {Number(
                            detalle.precio_unitario
                          ).toLocaleString(
                            'es-UY'
                          )}
                          {' c/u'}
                        </p>
                      </div>

                      <strong>
                        $
                        {Number(
                          detalle.subtotal
                        ).toLocaleString(
                          'es-UY'
                        )}
                      </strong>
                    </div>

                    {detalle.detalle && (
                      <div
                        style={{
                          marginTop:
                            '10px'
                        }}
                      >
                        <small
                          style={{
                            color:
                              '#666'
                          }}
                        >
                          Detalle del diseño
                        </small>
                        <p>
                          {detalle.detalle}
                        </p>
                      </div>
                    )}

                    {opciones.length > 0 && (
                      <div
                        style={{
                          marginTop:
                            '15px',
                          display:
                            'grid',
                          gap:
                            '8px'
                        }}
                      >
                        <strong>
                          Personalización
                        </strong>

                        {opciones.map(
                          (opcion) => (
                            <div
                              key={
                                opcion.id
                              }
                              style={{
                                padding:
                                  '10px',
                                background:
                                  '#f7f8fa',
                                borderRadius:
                                  '8px'
                              }}
                            >
                              <strong>
                                {opcion.nombre}
                              </strong>

                              {opcion.valor_texto && (
                                <div>
                                  {opcion.valor_texto}
                                </div>
                              )}

                              {Number(
                                opcion.recargo_calculado
                              ) > 0 && (
                                <small>
                                  Recargo: $
                                  {Number(
                                    opcion.recargo_calculado
                                  ).toLocaleString(
                                    'es-UY'
                                  )}
                                </small>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {respuestasDetalle.length > 0 && (
                      <div
                        style={{
                          marginTop:
                            '15px',
                          display:
                            'grid',
                          gap:
                            '8px'
                        }}
                      >
                        <strong>
                          Preguntas del producto
                        </strong>

                        {respuestasDetalle.map(
                          (respuesta) => {
                            const pregunta =
                              preguntas.find(
                                (p) =>
                                  p.id ===
                                  respuesta.pregunta_id
                              )

                            const opcion =
                              pregunta?.pregunta_opciones?.find(
                                (o) =>
                                  o.id ===
                                  respuesta.opcion_id
                              )

                            return (
                              <div
                                key={
                                  respuesta.id
                                }
                                style={{
                                  padding:
                                    '10px',
                                  background:
                                    '#f0f9ff',
                                  borderRadius:
                                    '8px'
                                }}
                              >
                                <strong>
                                  {pregunta?.titulo ||
                                    `Pregunta #${respuesta.pregunta_id}`}
                                </strong>

                                <div>
                                  {respuesta.valor_texto ||
                                    (respuesta.valor_booleano
                                      ? 'Sí'
                                      : respuesta.valor_booleano === false
                                        ? 'No'
                                        : '') ||
                                    respuesta.valor_numero ||
                                    (opcion
                                      ? opcion.nombre
                                      : respuesta.opcion_id
                                        ? `Opción #${respuesta.opcion_id}`
                                        : '')}
                                </div>
                              </div>
                            )
                          }
                        )}
                      </div>
                    )}

                    {archivosDetalle.length > 0 && (
                      <div
                        style={{
                          marginTop:
                            '15px',
                          display:
                            'grid',
                          gap:
                            '8px'
                        }}
                      >
                        <strong>
                          Archivos adjuntos
                        </strong>

                        <div
                          style={{
                            display:
                              'flex',
                            flexWrap:
                              'wrap',
                            gap:
                              '10px'
                          }}
                        >
                          {archivosDetalle.map(
                            (archivo) => (
                              <div
                                key={
                                  archivo.id
                                }
                                style={{
                                  maxWidth:
                                    '200px'
                                }}
                              >
                                {urlsFirmadas[
                                  archivo.id
                                ] ? (
                                  <a
                                    href={
                                      urlsFirmadas[
                                        archivo.id
                                      ]
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={
                                        urlsFirmadas[
                                          archivo.id
                                        ]
                                      }
                                      alt={
                                        archivo.nombre_original
                                      }
                                      style={{
                                        width:
                                          '100%',
                                        borderRadius:
                                          '8px',
                                        border:
                                          '1px solid #ddd'
                                      }}
                                    />
                                    <small>
                                      {archivo.nombre_original}
                                    </small>
                                  </a>
                                ) : (
                                  <small>
                                    {archivo.nombre_original}
                                  </small>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            )}
          </div>
        )}

      </section>

      <section className="panel detalle-panel">

        <div className="panel-header">
          <div>
            <h2>
              Estado del pedido
            </h2>
            <p>
              Desde acá podés avanzar el pedido.
            </p>
          </div>
        </div>

        <div
          className="form-grid"
        >
          <label>
            <span>
              Estado
            </span>

            <select
              value={
                estado
              }
              onChange={(e) =>
                setEstado(
                  e.target.value
                )
              }
            >
              {estados.map(
                (estadoDisponible) => (
                  <option
                    key={
                      estadoDisponible.valor
                    }
                    value={
                      estadoDisponible.valor
                    }
                  >
                    {estadoDisponible.nombre}
                  </option>
                )
              )}
            </select>
          </label>

          <div
            style={{
              display:
                'flex',
              alignItems:
                'end'
            }}
          >
            <button
              className="boton-guardar"
              onClick={
                guardarEstado
              }
              disabled={
                guardandoEstado ||
                estados.length === 0
              }
            >
              <Save size={17} />

              {guardandoEstado
                ? 'Guardando...'
                : 'Guardar estado'}
            </button>
          </div>
        </div>

        {historial.length > 0 && (
          <div
            style={{
              marginTop:
                '20px',
              display:
                'grid',
              gap:
                '8px'
            }}
          >
            <strong>
              Historial del pedido
            </strong>

            {historial.map((registro) => {
              const anterior = estados.find(
                (e) => e.id === registro.estado_anterior_id
              )
              const nuevo = estados.find(
                (e) => e.id === registro.estado_nuevo_id
              )

              return (
                <div
                  key={registro.id}
                  style={{
                    padding:
                      '10px',
                    background:
                      '#f7f8fa',
                    borderRadius:
                      '8px'
                  }}
                >
                  <strong>
                    {registro.accion ||
                      `${anterior?.nombre || '—'} → ${nuevo?.nombre || '—'}`}
                  </strong>

                  {registro.comentario && (
                    <div>
                      {registro.comentario}
                    </div>
                  )}

                  <small
                    style={{
                      color:
                        '#666'
                    }}
                  >
                    {formatearFecha(
                      registro.created_at
                    )}
                  </small>
                </div>
              )
            })}
          </div>
        )}

      </section>

      <section className="panel detalle-panel">

        <div
          style={{
            display:
              'flex',
            justifyContent:
              'flex-end',
            gap:
              '30px'
          }}
        >
          <LineaPrecio
            titulo="Subtotal"
            valor={
              Number(
                pedido.subtotal
              )
            }
          />

          <LineaPrecio
            titulo="Recargos"
            valor={
              Number(
                pedido.recargos
              )
            }
          />

          <div>
            <span>
              Total
            </span>
            <h2>
              $
              {Number(
                pedido.total
              ).toLocaleString(
                'es-UY'
              )}
            </h2>
          </div>
        </div>

      </section>

    </>

  )
}

/* ============================================================
   ESTADO
   ============================================================ */

function EstadoPedido({
  estado
}) {

  const nombres = {

    nuevo:
      'Nuevo',

    revisar:
      'Revisar',

    diseno:
      'Diseño',

    aprobacion:
      'Aprobación',

    produccion:
      'Producción',

    listo:
      'Listo',

    entregado:
      'Entregado',

    cancelado:
      'Cancelado'

  }


  return (

    <small
      style={{
        display:
          'inline-block',
        padding:
          '5px 9px',
        borderRadius:
          '20px',
        background:
          '#f1f3f5',
        whiteSpace:
          'nowrap'
      }}
    >

      {nombres[
        estado
      ] ||
        estado}

    </small>

  )
}


/* ============================================================
   PRODUCTOS
   ============================================================ */

function Productos({
  productos,
  categorias,
  busqueda,
  setBusqueda,
  cargando,
  onAbrirProducto,
  onProductoCreado
}) {

  const [
    mostrarFormulario,
    setMostrarFormulario
  ] = useState(false)


  const [
    nombre,
    setNombre
  ] = useState('')


  const [
    categoriaId,
    setCategoriaId
  ] = useState('')


  const [
    descripcion,
    setDescripcion
  ] = useState('')


  const [
    precio,
    setPrecio
  ] = useState('')


  const [
    codigo,
    setCodigo
  ] = useState('')


  const [
    costo,
    setCosto
  ] = useState('')


  const [
    guardando,
    setGuardando
  ] = useState(false)


  async function guardarProducto(e) {

    e.preventDefault()


    if (
      !nombre.trim()
    ) {

      alert(
        'Ingresá el nombre del producto.'
      )

      return
    }


    if (
      !categoriaId
    ) {

      alert(
        'Seleccioná una categoría.'
      )

      return
    }


    setGuardando(true)


    const {
      error
    } = await supabase
      .from('productos')
      .insert({

        nombre:
          nombre.trim(),

        categoria_id:
          Number(
            categoriaId
          ),

        descripcion:
          descripcion.trim() ||
          null,

        precio:
          precio
            ? Number(
                precio
              )
            : null,

        precio_costo:
          costo
            ? Number(
                costo
              )
            : 0,

        codigo_interno:
          codigo.trim() ||
          null,

        activo:
          true

      })
      .select()
      .single()


    if (error) {

      console.error(
        error
      )

      alert(
        'No se pudo crear el producto:\n\n' +
        error.message
      )

      setGuardando(false)

      return
    }


    alert(
      'Producto creado correctamente.'
    )


    setNombre('')
    setCategoriaId('')
    setDescripcion('')
    setPrecio('')
    setCodigo('')
    setCosto('')


    setMostrarFormulario(
      false
    )


    setGuardando(false)


    if (onProductoCreado) {
      onProductoCreado()
    }
  }


  return (

    <>

      <header className="topbar">

        <div>

          <h1>
            Productos
          </h1>

          <p>
            Administrá los productos disponibles
            para tus pedidos.
          </p>

        </div>


        <button
          className="nuevo-pedido"
          type="button"
          onClick={() =>
            setMostrarFormulario(
              true
            )
          }
        >

          <Plus size={19} />

          Nuevo producto

        </button>

      </header>


      {mostrarFormulario && (

        <div
          style={{
            background:
              '#fff',
            border:
              '1px solid #ddd',
            borderRadius:
              '14px',
            padding:
              '25px',
            marginBottom:
              '25px'
          }}
        >

          <div
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              marginBottom:
                '20px'
            }}
          >

            <div>

              <h2
                style={{
                  margin:
                    0
                }}
              >
                Nuevo producto
              </h2>

              <p
                style={{
                  color:
                    '#666'
                }}
              >
                Completá los datos del producto.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                setMostrarFormulario(
                  false
                )
              }
            >
              Cancelar
            </button>

          </div>


          <form
            onSubmit={
              guardarProducto
            }
          >

            <div
              style={{
                display:
                  'grid',
                gap:
                  '18px'
              }}
            >

              <label>

                <strong>
                  Nombre *
                </strong>

                <input
                  type="text"
                  value={
                    nombre
                  }
                  onChange={(e) =>
                    setNombre(
                      e.target.value
                    )
                  }
                  placeholder="Ej: Taza sublimable"
                  required
                />

              </label>


              <label>

                <strong>
                  Categoría *
                </strong>

                <select
                  value={
                    categoriaId
                  }
                  onChange={(e) =>
                    setCategoriaId(
                      e.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Seleccionar categoría...
                  </option>


                  {categorias.map(
                    (
                      categoria
                    ) => (

                      <option
                        key={
                          categoria.id
                        }
                        value={
                          categoria.id
                        }
                      >
                        {categoria.nombre}
                      </option>

                    )
                  )}

                </select>

              </label>


              <label>

                <strong>
                  Descripción
                </strong>

                <textarea
                  value={
                    descripcion
                  }
                  onChange={(e) =>
                    setDescripcion(
                      e.target.value
                    )
                  }
                  placeholder="Descripción del producto"
                  rows="4"
                />

              </label>


              <div
                className="form-grid"
              >

                <label>

                  <strong>
                    Precio proveedor
                  </strong>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      costo
                    }
                    onChange={(e) =>
                      setCosto(
                        e.target.value
                      )
                    }
                    placeholder="100"
                  />

                </label>


                <label>

                  <strong>
                    Precio base
                  </strong>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      precio
                    }
                    onChange={(e) =>
                      setPrecio(
                        e.target.value
                      )
                    }
                    placeholder="300"
                  />

                </label>

              </div>


              <label>

                <strong>
                  Código interno
                </strong>

                <input
                  type="text"
                  value={
                    codigo
                  }
                  onChange={(e) =>
                    setCodigo(
                      e.target.value
                    )
                  }
                  placeholder="Ej: TAZA-001"
                />

              </label>


              <button
                type="submit"
                disabled={
                  guardando
                }
              >

                {guardando
                  ? 'Guardando...'
                  : 'Guardar producto'}

              </button>

            </div>

          </form>

        </div>

      )}


      {!mostrarFormulario && (

        <div className="productos-toolbar">

          <div className="buscador">

            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar producto..."
              value={
                busqueda
              }
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
            />

          </div>


          <span className="cantidad-productos">

            {productos.length}
            {' '}
            productos

          </span>

        </div>

      )}


      {!mostrarFormulario && (

        <div className="productos-grid">


          {cargando && (

            <div className="cargando">
              Cargando productos...
            </div>

          )}


          {!cargando &&
            productos.map(
              (
                producto
              ) => (

                <div
                  className="producto-card"
                  key={
                    producto.id
                  }
                  onClick={() =>
                    onAbrirProducto(
                      producto
                    )
                  }
                  style={{
                    cursor:
                      'pointer'
                  }}
                >

                  <div className="producto-imagen">

                    {producto.imagen_principal ? (

                      <img
                        src={
                          producto.imagen_principal
                        }
                        alt={
                          producto.nombre
                        }
                      />

                    ) : (

                      <Package
                        size={42}
                      />

                    )}

                  </div>


                  <div className="producto-info">

                    <span className="producto-categoria">

                      {producto.categorias
                        ?.nombre ||
                        'Sin categoría'}

                    </span>


                    <h3>
                      {producto.nombre}
                    </h3>


                    <p>
                      {producto.descripcion ||
                        'Sin descripción'}
                    </p>


                    <div className="producto-precios">

                      <div>

                        <span>
                          Proveedor
                        </span>

                        <strong className={
                          producto.precio_costo
                            ? undefined
                            : 'sin-precio'
                        }>

                          {producto.precio_costo ? (
                            '$' +
                            Number(
                              producto.precio_costo
                            ).toLocaleString(
                              'es-UY'
                            )
                          ) : (
                            '—'
                          )}

                        </strong>

                      </div>


                      <div>

                        <span>
                          Mayorista
                        </span>

                        <strong className={
                          producto.precio_mayorista
                            ? undefined
                            : 'sin-precio'
                        }>

                          {producto.precio_mayorista ? (
                            '$' +
                            Number(
                              producto.precio_mayorista
                            ).toLocaleString(
                              'es-UY'
                            )
                          ) : (
                            '—'
                          )}

                        </strong>

                      </div>


                      <div>

                        <span>
                          Minorista
                        </span>

                        <strong className={
                          producto.precio_publico
                            ? undefined
                            : 'sin-precio'
                        }>

                          {producto.precio_publico ? (
                            '$' +
                            Number(
                              producto.precio_publico
                            ).toLocaleString(
                              'es-UY'
                            )
                          ) : (
                            '—'
                          )}

                        </strong>

                      </div>

                    </div>


                    <div className="producto-footer">

                      <span className="producto-codigo">

                        {producto.codigo_interno ||
                          'Sin código'}

                      </span>


                      <span className={
                        producto.stock
                          ? 'producto-stock disponible'
                          : producto.stock === 0
                            ? 'producto-stock agotado'
                            : 'producto-stock'
                      }>

                        {producto.stock
                          ? 'Stock disponible'
                          : producto.stock === 0
                            ? 'Agotado'
                            : 'Stock —'}

                      </span>


                      <ChevronRight
                        size={18}
                      />

                    </div>

                  </div>

                </div>

              )
            )}


          {!cargando &&
            productos.length === 0 && (

              <div className="sin-productos">

                <Package size={42} />

                <h3>
                  No encontramos productos
                </h3>

                <p>
                  Creá tu primer producto
                  con "Nuevo producto".
                </p>

              </div>

            )}

        </div>

      )}

    </>

  )
}


/* ============================================================
   DETALLE PRODUCTO
   ============================================================ */

function ProductoDetalle({
  producto,
  volver
}) {

  const [
    personalizaciones,
    setPersonalizaciones
  ] = useState([])


  async function cargarPersonalizaciones() {

    const {
      data,
      error
    } = await supabase
      .from(
        'producto_personalizaciones'
      )
      .select(`
        *,
        tipos_personalizacion (
          id,
          nombre,
          descripcion
        )
      `)
      .eq(
        'producto_id',
        producto.id
      )
      .eq(
        'activo',
        true
      )
      .order('id')


    if (error) {

      console.error(
        error
      )

      return
    }


    setPersonalizaciones(
      data || []
    )

  }
  useEffect(() => {

    cargarPersonalizaciones()

  }, [
    producto.id
  ])


  return (

    <>

      <header className="topbar">

        <div>

          <button
            className="boton-volver"
            onClick={volver}
          >

            <ArrowLeft size={18} />

            Volver a productos

          </button>


          <h1>
            {producto.nombre}
          </h1>


          <p>
            Configuración completa del producto.
          </p>

        </div>

      </header>


      <section className="detalle-producto">


        <div className="detalle-imagen">

          {producto.imagen_principal ? (

            <img
              src={
                producto.imagen_principal
              }
              alt={
                producto.nombre
              }
            />

          ) : (

            <Package size={70} />

          )}

        </div>


        <div className="detalle-informacion">

          <span className="producto-categoria">

            {producto.categorias
              ?.nombre ||
              'Sin categoría'}

          </span>


          <h2>
            {producto.nombre}
          </h2>


          <p className="detalle-descripcion">

            {producto.descripcion ||
              'Sin descripción'}

          </p>


          <div className="detalle-datos">

            <div>

              <span>
                Código interno
              </span>

              <strong>
                {producto.codigo_interno ||
                  'Sin código'}
              </strong>

            </div>


            <div>

              <span>
                Precio proveedor
              </span>

              <strong>

                $
                {Number(
                  producto.precio_costo ||
                  0
                ).toLocaleString(
                  'es-UY'
                )}

              </strong>

            </div>


            <div>

              <span>
                Estado
              </span>

              <strong>
                {producto.activo
                  ? 'Activo'
                  : 'Inactivo'}
              </strong>

            </div>

          </div>

        </div>

      </section>


      <PreciosProducto
        producto={
          producto
        }
      />


      <section className="panel detalle-panel">

        <div className="panel-header">

          <div>

            <h2>
              Personalización
            </h2>

            <p>
              Estas opciones estarán disponibles
              automáticamente para este producto.
            </p>

          </div>

        </div>


        <div className="lista-configuracion">

          {personalizaciones.length === 0 ? (

            <>
              <OpcionAutomatica
                icono={
                  <Type size={20} />
                }
                nombre="Nombre o texto"
                descripcion="El cliente puede agregar un nombre, frase o texto."
                recargo={`+${RECARGO_NOMBRE_TEXTO}%`}
              />

              <OpcionAutomatica
                icono={
                  <Image size={20} />
                }
                nombre="Foto o imagen"
                descripcion="El cliente puede adjuntar una foto o imagen."
                recargo="Sin recargo"
              />

              <OpcionAutomatica
                icono={
                  <ClipboardList size={20} />
                }
                nombre="Detalle del diseño"
                descripcion="El cliente puede explicar cómo quiere su diseño."
                recargo="Sin recargo"
              />

              <OpcionAutomatica
                icono={
                  <Gift size={20} />
                }
                nombre="Bolsita de regalo"
                descripcion="Presentación del producto en bolsita de regalo."
                recargo={`+$${RECARGO_BOLSITA}`}
              />
            </>

          ) : (

            personalizaciones.map(
              (
                item
              ) => (

                <OpcionAutomatica
                  key={
                    item.id
                  }
                  icono={
                    <Palette size={20} />
                  }
                  nombre={
                    item.tipos_personalizacion
                      ?.nombre ||
                    item.nombre
                  }
                  descripcion={
                    item.tipos_personalizacion
                      ?.descripcion ||
                    ''
                  }
                  recargo={
                    Number(
                      item.recargo_porcentaje
                    ) > 0
                      ? `+${item.recargo_porcentaje}%`
                      : Number(
                          item.recargo_fijo
                        ) > 0
                        ? `+$${item.recargo_fijo}`
                        : 'Sin recargo'
                  }
                />

              )
            )

          )}

        </div>


        <div
          style={{
            marginTop:
              '18px',
            padding:
              '12px 14px',
            borderRadius:
              '10px',
            background:
              '#f5f7fa'
          }}
        >

          <strong>
            Estas opciones son automáticas.
          </strong>

          <p
            style={{
              margin:
                '5px 0 0'
            }}
          >
            No necesitás agregarlas manualmente
            a cada producto.
          </p>

        </div>

      </section>


      <section className="panel detalle-panel">

        <div className="panel-header">

          <div>

            <h2>
              Flujo del pedido
            </h2>

            <p>
              El sistema utilizará este producto
              dentro del flujo de pedidos.
            </p>

          </div>

        </div>


        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(6, 1fr)',
            gap:
              '10px'
          }}
        >

          {[
            'Cliente realiza pedido',
            'Personalización',
            'Diseño',
            'Cliente revisa',
            'Aprobación',
            'Producción'
          ].map(
            (
              texto,
              index
            ) => (

              <div
                key={
                  texto
                }
                style={{
                  textAlign:
                    'center'
                }}
              >

                <div
                  style={{
                    width:
                      '38px',
                    height:
                      '38px',
                    borderRadius:
                      '50%',
                    background:
                      '#f1f3f5',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    margin:
                      '0 auto 8px',
                    fontWeight:
                      'bold'
                  }}
                >

                  {index + 1}

                </div>


                <small>
                  {texto}
                </small>

              </div>

            )
          )}

        </div>

      </section>

    </>

  )
}


/* ============================================================
   OPCIÓN AUTOMÁTICA
   ============================================================ */

function OpcionAutomatica({
  icono,
  nombre,
  descripcion,
  recargo
}) {

  return (

    <div
      className="configuracion-item"
    >

      <div className="configuracion-icono">

        {icono}

      </div>


      <div
        style={{
          flex: 1
        }}
      >

        <strong>
          {nombre}
        </strong>

        <span>
          {descripcion}
        </span>

      </div>


      <small>
        {recargo}
      </small>

    </div>

  )
}


/* ============================================================
   PRECIOS PRODUCTO
   ============================================================ */

function PreciosProducto({
  producto
}) {

  const [
    precioCosto,
    setPrecioCosto
  ] = useState(
    producto.precio_costo
      ? String(
          Number(
            producto.precio_costo
          )
        )
      : ''
  )


  const [
    multiplicadorMayorista,
    setMultiplicadorMayorista
  ] = useState(2)


  const [
    multiplicadorPublico,
    setMultiplicadorPublico
  ] = useState(2.5)


  const [
    precioMayorista,
    setPrecioMayorista
  ] = useState(
    producto.precio_mayorista
      ? String(
          Number(
            producto.precio_mayorista
          )
        )
      : ''
  )


  const [
    precioPublico,
    setPrecioPublico
  ] = useState(
    producto.precio_publico
      ? String(
          Number(
            producto.precio_publico
          )
        )
      : ''
  )


  const [
    guardando,
    setGuardando
  ] = useState(false)


  const costo =
    Number(
      precioCosto
    ) || 0


  const precioMayoristaAuto =
    costo *
    Number(
      multiplicadorMayorista
    )


  const precioMinoristaAuto =
    costo *
    Number(
      multiplicadorPublico
    )


  const precioMayoristaFinal =
    precioMayorista === ''
      ? precioMayoristaAuto
      : Number(
          precioMayorista
        )


  const precioMinoristaFinal =
    precioPublico === ''
      ? precioMinoristaAuto
      : Number(
          precioPublico
        )


  async function guardarPrecios() {

    setGuardando(true)


    const {
      error
    } = await supabase
      .from('productos')
      .update({

        precio_costo:
          precioCosto === ''
            ? null
            : Number(
                precioCosto
              ),

        precio_mayorista:
          precioMayoristaFinal,

        precio_publico:
          precioMinoristaFinal

      })
      .eq(
        'id',
        producto.id
      )


    setGuardando(false)


    if (error) {

      console.error(
        error
      )

      alert(
        'No se pudieron guardar los precios:\n\n' +
        error.message
      )

      return
    }


    setPrecioMayorista(
      String(
        precioMayoristaFinal
      )
    )

    setPrecioPublico(
      String(
        precioMinoristaFinal
      )
    )


    alert(
      'Precios guardados correctamente.'
    )

  }


  return (

    <section className="panel detalle-panel">


      <div className="panel-header">

        <div>

          <h2>
            Precios
          </h2>

          <p>
            El mayorista y el minorista se calculan
            automáticamente desde el precio proveedor.
            Podés modificarlos y guardar.
          </p>

        </div>

      </div>


      <div className="precios-grid">


        <div className="precio-box">

          <span className="precio-label">
            Precio proveedor
          </span>

          <label>

            <span>
              Precio pagado al proveedor
            </span>

            <input
              type="number"
              step="0.01"
              value={
                precioCosto
              }
              onChange={(e) =>
                setPrecioCosto(
                  e.target.value
                )
              }
              placeholder="Ej: 1000"
            />

          </label>

          <small>
            Base para calcular el resto
          </small>

        </div>


        <div className="precio-box">

          <span className="precio-label">
            Precio mayorista
          </span>


          <label>

            <span>
              Multiplicador
            </span>


            <select
              value={
                multiplicadorMayorista
              }
              onChange={(e) =>
                setMultiplicadorMayorista(
                  Number(
                    e.target.value
                  )
                )
              }
            >

              <option value="2">
                ×2
              </option>

              <option value="2.5">
                ×2,5
              </option>

              <option value="3">
                ×3
              </option>

              <option value="3.5">
                ×3,5
              </option>

              <option value="4">
                ×4
              </option>

            </select>

          </label>


          <div className="precio-sugerido">

            <span>
              Automático
            </span>

            <strong>

              $
              {precioMayoristaAuto.toLocaleString(
                'es-UY',
                {
                  minimumFractionDigits:
                    2
                }
              )}

            </strong>

          </div>


          <label>

            <span>
              Modificar si querés
            </span>

            <input
              type="number"
              value={
                precioMayorista
              }
              onChange={(e) =>
                setPrecioMayorista(
                  e.target.value
                )
              }
              placeholder={
                precioMayoristaAuto
                  ? `${
                      precioMayoristaAuto.toLocaleString(
                        'es-UY'
                      )
                    } (auto)`
                  : 'Ingresá el precio'
              }
            />

          </label>

        </div>


        <div className="precio-box">

          <span className="precio-label">
            Precio minorista
          </span>


          <label>

            <span>
              Multiplicador
            </span>


            <select
              value={
                multiplicadorPublico
              }
              onChange={(e) =>
                setMultiplicadorPublico(
                  Number(
                    e.target.value
                  )
                )
              }
            >

              <option value="2">
                ×2
              </option>

              <option value="2.5">
                ×2,5
              </option>

              <option value="3">
                ×3
              </option>

              <option value="3.5">
                ×3,5
              </option>

              <option value="4">
                ×4
              </option>

            </select>

          </label>


          <div className="precio-sugerido">

            <span>
              Automático
            </span>

            <strong>

              $
              {precioMinoristaAuto.toLocaleString(
                'es-UY',
                {
                  minimumFractionDigits:
                    2
                }
              )}

            </strong>

          </div>


          <label>

            <span>
              Modificar si querés
            </span>

            <input
              type="number"
              value={
                precioPublico
              }
              onChange={(e) =>
                setPrecioPublico(
                  e.target.value
                )
              }
              placeholder={
                precioMinoristaAuto
                  ? `${
                      precioMinoristaAuto.toLocaleString(
                        'es-UY'
                      )
                    } (auto)`
                  : 'Ingresá el precio'
              }
            />

          </label>

        </div>

      </div>


      <div className="precios-acciones">

        <button
          className="boton-guardar"
          onClick={
            guardarPrecios
          }
          disabled={
            guardando
          }
        >

          <Save size={17} />

          {guardando
            ? 'Guardando...'
            : 'Guardar precios'}

        </button>

      </div>

    </section>

  )
}


/* ============================================================
   CAMPO
   ============================================================ */

function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}) {

  return (

    <label>

      <span>
        {label}
      </span>

      <input
        type={
          type
        }
        value={
          value
        }
        placeholder={
          placeholder
        }
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
      />

    </label>

  )
}


/* ============================================================
   LÍNEA DE PRECIO
   ============================================================ */

function LineaPrecio({
  titulo,
  valor
}) {

  return (

    <div
      style={{
        display:
          'flex',
        justifyContent:
          'space-between',
        gap:
          '30px'
      }}
    >

      <span>
        {titulo}
      </span>

      <strong>

        $
        {Number(
          valor || 0
        ).toLocaleString(
          'es-UY'
        )}

      </strong>

    </div>

  )
}


/* ============================================================
   FECHA
   ============================================================ */

function formatearFecha(
  fecha
) {

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
   EXPORT
   ============================================================ */

export default App