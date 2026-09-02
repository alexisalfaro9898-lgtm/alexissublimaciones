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
  LogOut,
  Pencil,
  Check,
  X,
  ListChecks,
  LayoutGrid,
  List,
  GitCompareArrows,
  BarChart3,
  Sparkles,
  ImageOff,
  MessageSquare,
  Bell
} from 'lucide-react'

import { supabase } from './lib/supabase'
import DashboardAdmin from './components/DashboardAdmin'
import ProveedoresPage from './components/ProveedoresPage'
import ComparacionProveedoresPage from './components/ComparacionProveedoresPage'
import ComprasPage from './components/ComprasPage'
import ChatAdmin from './components/ChatAdmin'
import {
  proponerNormalizaciones,
  decodificarNombre
} from './lib/nombres'
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


const nombreProducto = (p) => p?.nombre_comercial || p?.nombre


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

  const [orden, setOrden] = useState('orden')

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

  function actualizarProducto(productoActualizado) {

    setProductos((actuales) =>
      actuales.map((producto) =>
        producto.id === productoActualizado.id
          ? {
              ...producto,
              ...productoActualizado,
              categorias:
                categorias.find(
                  (categoria) =>
                    categoria.id ===
                    productoActualizado.categoria_id
                ) || producto.categorias
            }
          : producto
      )
    )
  }

  function actualizarProductos(lista) {

    if (!lista || lista.length === 0) return

    const porId = new Map(
      lista.map((producto) => [producto.id, producto])
    )

    setProductos((actuales) =>
      actuales.map((producto) => {
        const actualizado = porId.get(producto.id)

        if (!actualizado) return producto

        return {
          ...producto,
          ...actualizado,
          categorias:
            categorias.find(
              (categoria) =>
                categoria.id === actualizado.categoria_id
            ) || producto.categorias
        }
      })
    )
  }

  function eliminarProductos(ids) {

    const conjunto = new Set(ids)

    setProductos((actuales) =>
      actuales.filter((producto) => !conjunto.has(producto.id))
    )
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

    ...(usuario?.rol_id === 1
      ? [
          {
            nombre: 'Dashboard',
            icono: BarChart3
          }
        ]
      : []),

    {
      nombre: 'Inicio',
      icono: Home
    },

    {
      nombre: 'Mensajes',
      icono: MessageSquare
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
      nombre: 'Comparación proveedores',
      icono: GitCompareArrows
    },

    {
      nombre: 'Compras',
      icono: ClipboardList
    },

    {
      nombre: 'Configuración',
      icono: Settings
    }

  ]


  const productosFiltrados =
    productos.filter((producto) =>
      ((producto.nombre_comercial || '') + ' ' + (producto.nombre || ''))
        .toLowerCase()
        .includes(
          busqueda.toLowerCase()
        )
    )

  const productosOrdenados = [...productosFiltrados].sort((a, b) => {
    if (orden === 'nombre_asc') {
      return (a.nombre_comercial || a.nombre).localeCompare(
        b.nombre_comercial || b.nombre,
        'es'
      )
    }
    if (orden === 'nombre_desc') {
      return (b.nombre_comercial || b.nombre).localeCompare(
        a.nombre_comercial || a.nombre,
        'es'
      )
    }
    const pa = Number(a.precio_publico ?? a.precio ?? 0)
    const pb = Number(b.precio_publico ?? b.precio ?? 0)
    if (orden === 'precio_asc') {
      return pa - pb
    }
    if (orden === 'precio_desc') {
      return pb - pa
    }
    return 0
  })


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
            onNuevoPedido={() =>
              setPagina('NuevoPedido')
            }
          />

        )}


        {pagina === 'Mensajes' && <ChatAdmin />}


        {pagina === 'Dashboard' &&
          usuario?.rol_id === 1 && (
          <DashboardAdmin onVerProducto={abrirProducto} />
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
            productos={productosOrdenados}
            categorias={categorias}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            orden={orden}
            setOrden={setOrden}
            cargando={cargandoProductos}
            onAbrirProducto={abrirProducto}
            onProductoCreado={cargarProductos}
            onActualizarProducto={actualizarProducto}
            onActualizarProductos={actualizarProductos}
            onEliminarProductos={eliminarProductos}
          />

        )}


        {pagina === 'Clientes' && (

          <ClientesPage />

        )}


        {pagina === 'Proveedores' && (

          <ProveedoresPage />

        )}


        {pagina === 'Comparación proveedores' && (

          <ComparacionProveedoresPage />

        )}


        {pagina === 'Compras' && (

          <ComprasPage />

        )}


        {pagina === 'ProductoDetalle' &&
          productoSeleccionado && (

            <ProductoDetalle
              producto={productoSeleccionado}
              volver={volverAProductos}
            />

          )}


        {pagina !== 'Dashboard' &&
          pagina !== 'Inicio' &&
          pagina !== 'Pedidos' &&
          pagina !== 'NuevoPedido' &&
          pagina !== 'PedidoDetalle' &&
          pagina !== 'Productos' &&
          pagina !== 'Clientes' &&
          pagina !== 'Proveedores' &&
          pagina !== 'Comparación proveedores' &&
          pagina !== 'Compras' &&
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
  onNuevoPedido
}) {

  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargarResumen() {
    setCargando(true)

    const { data, error } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, cliente_nombre, cliente_telefono, cliente_email, origen, estado, total, creado_en')
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
                    <OrigenPedido origen={pedido.origen} />
                  </div>
                </div>
              ))}
            </div>
          )}

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

                    <OrigenPedido
                      origen={
                        pedido.origen
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
   CLIENTES
   ============================================================ */

function ClientesPage() {

  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)

    const [respuestaClientes, respuestaPedidos] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .order('id', { ascending: false }),

      supabase
        .from('pedidos')
        .select('id, numero_pedido, cliente_id, cliente_email, cliente_nombre, estado, total, creado_en, origen')
        .order('creado_en', { ascending: false })
    ])

    if (respuestaClientes.error) {
      console.error('Error cargando clientes:', respuestaClientes.error)
      setCargando(false)
      return
    }

    setClientes(respuestaClientes.data || [])
    setPedidos(respuestaPedidos.data || [])
    setCargando(false)
  }

  const pedidosDelCliente = (cliente) =>
    pedidos.filter(
      (p) =>
        (p.cliente_id !== null && p.cliente_id === cliente.id) ||
        (cliente.email &&
          p.cliente_email &&
          p.cliente_email.toLowerCase() === cliente.email.toLowerCase())
    )

  const clientesFiltrados = clientes.filter((cliente) => {
    const texto =
      `${cliente.nombre || ''} ${cliente.email || ''} ${cliente.telefono || ''} ${cliente.whatsapp || ''}`
        .toLowerCase()

    const coincideBusqueda =
      texto.includes(busqueda.toLowerCase())

    const coincideFiltro =
      filtro === 'todos' ||
      (filtro === 'mayorista' && cliente.tipo_cliente === 'mayorista') ||
      (filtro === 'minorista' && cliente.tipo_cliente === 'minorista') ||
      (filtro === 'registrados' && cliente.auth_user_id) ||
      (filtro === 'manuales' && !cliente.auth_user_id)

    return coincideBusqueda && coincideFiltro
  })

  async function cambiarTipo(cliente, tipo) {
    const { error } = await supabase
      .from('clientes')
      .update({ tipo_cliente: tipo })
      .eq('id', cliente.id)

    if (error) {
      console.error('Error actualizando tipo de cliente:', error)
      alert('No se pudo actualizar el tipo: ' + error.message)
      return
    }

    setClientes((actuales) =>
      actuales.map((c) =>
        c.id === cliente.id ? { ...c, tipo_cliente: tipo } : c
      )
    )

    if (seleccionado?.id === cliente.id) {
      setSeleccionado({ ...seleccionado, tipo_cliente: tipo })
    }
  }

  async function guardarCliente(e) {
    e.preventDefault()

    if (!seleccionado?.nombre?.trim()) {
      alert('El nombre del cliente es obligatorio.')
      return
    }

    setGuardando(true)

    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre: seleccionado.nombre.trim(),
        telefono: seleccionado.telefono?.trim() || null,
        whatsapp: seleccionado.whatsapp?.trim() || null,
        email: seleccionado.email?.trim().toLowerCase() || null,
        direccion: seleccionado.direccion?.trim() || null,
        ciudad: seleccionado.ciudad?.trim() || null,
        observaciones: seleccionado.observaciones?.trim() || null,
        razon_social: seleccionado.razon_social?.trim() || null,
        documento: seleccionado.documento?.trim() || null,
        notas_mayorista: seleccionado.notas_mayorista?.trim() || null
      })
      .eq('id', seleccionado.id)
      .select()
      .single()

    if (error) {
      console.error('Error guardando cliente:', error)
      alert('No se pudo guardar el cliente: ' + error.message)
      setGuardando(false)
      return
    }

    setClientes((actuales) =>
      actuales.map((c) => (c.id === data.id ? data : c))
    )
    setSeleccionado(data)
    setGuardando(false)
  }

  function setCampo(campo, valor) {
    setSeleccionado((actual) => ({ ...actual, [campo]: valor }))
  }

  if (seleccionado) {
    const pedidosCliente = pedidosDelCliente(seleccionado)

    return (
      <>
        <header className="topbar">
          <div>
            <button
              className="boton-volver"
              onClick={() => setSeleccionado(null)}
            >
              <ArrowLeft size={18} />
              Volver a clientes
            </button>
            <h1>
              {seleccionado.nombre}
            </h1>
            <p>
              {seleccionado.email || 'Sin email'}
              {seleccionado.telefono
                ? ` · ${seleccionado.telefono}`
                : ''}
            </p>
          </div>
        </header>

        <section className="panel detalle-panel">

          <div className="panel-header">
            <div>
              <h2>
                Datos del cliente
              </h2>
            </div>
            <span
              className={
                seleccionado.tipo_cliente === 'mayorista'
                  ? 'chip-tipo mayorista'
                  : 'chip-tipo'
              }
            >
              {seleccionado.tipo_cliente === 'mayorista'
                ? 'Mayorista'
                : 'Minorista'}
            </span>
          </div>

          <div className="cliente-tipo-acciones">
            <button
              type="button"
              disabled={seleccionado.tipo_cliente === 'mayorista'}
              onClick={() => cambiarTipo(seleccionado, 'mayorista')}
            >
              Hacer mayorista
            </button>
            <button
              type="button"
              disabled={seleccionado.tipo_cliente === 'minorista'}
              onClick={() => cambiarTipo(seleccionado, 'minorista')}
            >
              Hacer minorista
            </button>
          </div>

          <div className="detalle-datos">
            <div>
              <span>Nombre</span>
              <strong>{seleccionado.nombre}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{seleccionado.email || '—'}</strong>
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
              <span>Dirección</span>
              <strong>{seleccionado.direccion || '—'}</strong>
            </div>
            <div>
              <span>Ciudad</span>
              <strong>{seleccionado.ciudad || '—'}</strong>
            </div>
            <div>
              <span>Cuenta</span>
              <strong>
                {seleccionado.auth_user_id
                  ? 'Registrado en el portal'
                  : 'Cargado manualmente'}
              </strong>
            </div>
            <div>
              <span>Cliente desde</span>
              <strong>
                {formatearFecha(seleccionado.created_at)}
              </strong>
            </div>
          </div>

          {pedidosCliente.length > 0 && (
            <>
              <div className="panel-header">
                <div>
                  <h2>
                    Pedidos ({pedidosCliente.length})
                  </h2>
                </div>
              </div>
              <div className="lista-configuracion">
                {pedidosCliente.map((pedido) => (
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
                        {formatearFecha(pedido.creado_en)}
                        {' · '}
                        <OrigenPedido origen={pedido.origen} />
                      </span>
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
            </>
          )}

        </section>

        <section className="panel detalle-panel">

          <div className="panel-header">
            <div>
              <h2>
                Editar datos
              </h2>
              <p>
                Cambiá la información del cliente.
              </p>
            </div>
          </div>

          <form
            className="cliente-form"
            onSubmit={guardarCliente}
          >
            <div className="cliente-form-campo">
              <label htmlFor="cliente-nombre">Nombre *</label>
              <input
                id="cliente-nombre"
                type="text"
                value={seleccionado.nombre || ''}
                onChange={(e) => setCampo('nombre', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-email">Email</label>
              <input
                id="cliente-email"
                type="email"
                value={seleccionado.email || ''}
                onChange={(e) => setCampo('email', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-telefono">Teléfono</label>
              <input
                id="cliente-telefono"
                type="text"
                value={seleccionado.telefono || ''}
                onChange={(e) => setCampo('telefono', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-whatsapp">WhatsApp</label>
              <input
                id="cliente-whatsapp"
                type="text"
                value={seleccionado.whatsapp || ''}
                onChange={(e) => setCampo('whatsapp', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-direccion">Dirección</label>
              <input
                id="cliente-direccion"
                type="text"
                value={seleccionado.direccion || ''}
                onChange={(e) => setCampo('direccion', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-ciudad">Ciudad</label>
              <input
                id="cliente-ciudad"
                type="text"
                value={seleccionado.ciudad || ''}
                onChange={(e) => setCampo('ciudad', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-razon">Razón social</label>
              <input
                id="cliente-razon"
                type="text"
                value={seleccionado.razon_social || ''}
                onChange={(e) => setCampo('razon_social', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo">
              <label htmlFor="cliente-documento">Documento</label>
              <input
                id="cliente-documento"
                type="text"
                value={seleccionado.documento || ''}
                onChange={(e) => setCampo('documento', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo ancho-completo">
              <label htmlFor="cliente-observaciones">Observaciones</label>
              <textarea
                id="cliente-observaciones"
                rows="2"
                value={seleccionado.observaciones || ''}
                onChange={(e) => setCampo('observaciones', e.target.value)}
              />
            </div>
            <div className="cliente-form-campo ancho-completo">
              <label htmlFor="cliente-notas-mayorista">Notas mayorista</label>
              <textarea
                id="cliente-notas-mayorista"
                rows="2"
                value={seleccionado.notas_mayorista || ''}
                onChange={(e) => setCampo('notas_mayorista', e.target.value)}
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
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            Clientes
          </h1>
          <p>
            Administrá los clientes de tu negocio
            y su tipo de precio.
          </p>
        </div>
        <button
          className="nuevo-pedido"
          type="button"
          onClick={cargarDatos}
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

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
            activo={filtro === 'todos'}
            onClick={() => setFiltro('todos')}
          >
            Todos
          </FiltroPedido>
          <FiltroPedido
            activo={filtro === 'mayorista'}
            onClick={() => setFiltro('mayorista')}
          >
            Mayoristas
          </FiltroPedido>
          <FiltroPedido
            activo={filtro === 'minorista'}
            onClick={() => setFiltro('minorista')}
          >
            Minoristas
          </FiltroPedido>
          <FiltroPedido
            activo={filtro === 'registrados'}
            onClick={() => setFiltro('registrados')}
          >
            Registrados
          </FiltroPedido>
          <FiltroPedido
            activo={filtro === 'manuales'}
            onClick={() => setFiltro('manuales')}
          >
            Manuales
          </FiltroPedido>
        </div>

        {cargando ? (
          <div className="vacio">
            <RefreshCw size={30} />
            <p>Cargando clientes...</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">
              <Users size={30} />
            </div>
            <h3>
              No hay clientes
            </h3>
            <p>
              Los clientes que se registren en el portal
              o que cargues aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="lista-configuracion">
            {clientesFiltrados.map((cliente) => {
              const cantidadPedidos = pedidosDelCliente(cliente).length

              return (
                <div
                  className="configuracion-item"
                  key={cliente.id}
                  onClick={() => setSeleccionado(cliente)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="configuracion-icono">
                    <Users size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>
                      {cliente.nombre}
                    </strong>
                    <span>
                      {cliente.email || 'Sin email'}
                      {cliente.telefono
                        ? ` · ${cliente.telefono}`
                        : ''}
                      {cliente.auth_user_id
                        ? ' · Registrado'
                        : ''}
                    </span>
                    <small>
                      {formatearFecha(cliente.created_at)}
                    </small>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '6px'
                    }}
                  >
                    <span
                      className={
                        cliente.tipo_cliente === 'mayorista'
                          ? 'chip-tipo mayorista'
                          : 'chip-tipo'
                      }
                    >
                      {cliente.tipo_cliente === 'mayorista'
                        ? 'Mayorista'
                        : 'Minorista'}
                    </span>
                    <small>
                      {cantidadPedidos} pedidos
                    </small>
                    {cliente.tipo_cliente !== 'mayorista' && (
                      <button
                        type="button"
                        className="hacer-mayorista"
                        onClick={(e) => {
                          e.stopPropagation()
                          cambiarTipo(cliente, 'mayorista')
                        }}
                      >
                        Hacer mayorista
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </section>
    </>
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
        items,
        origen: 'admin'
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
                  {nombreProducto(producto)}
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

        <OrigenPedido
          origen={pedido.origen}
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

function OrigenPedido({
  origen
}) {

  const nombres = {

    web:
      '🌐 Web',

    whatsapp:
      '💬 WhatsApp',

    admin:
      '👤 Admin'

  }

  if (!origen || origen === 'web') {
    return null
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
          origen === 'whatsapp'
            ? '#e8f5e9'
            : '#e3f2fd',
        whiteSpace:
          'nowrap',
        marginLeft:
          '6px'
      }}
    >

      {nombres[
        origen
      ] ||
        origen}

    </small>

  )
}

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
  orden,
  setOrden,
  cargando,
  onAbrirProducto,
  onProductoCreado,
  onActualizarProducto,
  onActualizarProductos,
  onEliminarProductos
}) {

  const [
    mostrarFormulario,
    setMostrarFormulario
  ] = useState(false)

  const [
    modoEdicion,
    setModoEdicion
  ] = useState(false)

  const [
    seleccion,
    setSeleccion
  ] = useState(() => new Set())

  const [
    filtroCategoria,
    setFiltroCategoria
  ] = useState('')

  const [
    filtroEstado,
    setFiltroEstado
  ] = useState('todos')

  const [
    modal,
    setModal
  ] = useState(null)

  const [
    guardandoCampo,
    setGuardandoCampo
  ] = useState({})

  const [
    preview,
    setPreview
  ] = useState(null)

  const [
    vista,
    setVista
  ] = useState('lista')

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    guardando,
    setGuardando
  ] = useState(false)

  const [costo, setCosto] = useState('')

  const [proveedorInfo, setProveedorInfo] = useState({})

  useEffect(() => {
    let activo = true

    async function cargarProveedoresDeProductos() {
      const [respuestaRelaciones, respuestaProveedores] =
        await Promise.all([
          supabase
            .from('producto_proveedores')
            .select(
              'producto_id, proveedor_id, precio_compra, disponible, es_principal'
            ),
          supabase
            .from('proveedores')
            .select('id, nombre, activo')
        ])

      if (!activo) return

      if (respuestaRelaciones.error || respuestaProveedores.error) {
        console.error(
          'Error cargando proveedores de productos:',
          respuestaRelaciones.error || respuestaProveedores.error
        )
        return
      }

      const nombres = {}
      for (const proveedor of respuestaProveedores.data || []) {
        nombres[proveedor.id] = proveedor
      }

      const mapa = {}
      for (const relacion of respuestaRelaciones.data || []) {
        const proveedor = nombres[relacion.proveedor_id]
        if (!proveedor || !proveedor.activo) continue

        const existente = mapa[relacion.producto_id]

        if (
          !existente ||
          (relacion.es_principal && !existente.es_principal)
        ) {
          mapa[relacion.producto_id] = {
            proveedor: proveedor.nombre,
            precio_compra: relacion.precio_compra,
            disponible: relacion.disponible,
            es_principal: relacion.es_principal
          }
        }
      }

      setProveedorInfo(mapa)
    }

    cargarProveedoresDeProductos()

    return () => {
      activo = false
    }
  }, [])

  function avisar(texto) {
    setMensaje(texto)

    setTimeout(() => {
      setMensaje('')
    }, 2800)
  }

  const visibles = productos.filter((producto) => {
    const coincideCategoria =
      !filtroCategoria ||
      producto.categoria_id === Number(filtroCategoria)

    const coincideEstado =
      filtroEstado === 'todos' ||
      (filtroEstado === 'activos'
        ? producto.activo
        : !producto.activo)

    return coincideCategoria && coincideEstado
  })

  const idsVisibles = visibles.map((producto) => producto.id)

  const todosVisiblesSeleccionados =
    idsVisibles.length > 0 &&
    idsVisibles.every((id) => seleccion.has(id))

  const seleccionados = productos.filter((producto) =>
    seleccion.has(producto.id)
  )

  function alternarSeleccion(id) {
    setSeleccion((actual) => {
      const nuevo = new Set(actual)

      if (nuevo.has(id)) {
        nuevo.delete(id)
      } else {
        nuevo.add(id)
      }

      return nuevo
    })
  }

  function alternarTodosVisibles() {
    setSeleccion((actual) => {
      const nuevo = new Set(actual)

      if (todosVisiblesSeleccionados) {
        idsVisibles.forEach((id) => nuevo.delete(id))
      } else {
        idsVisibles.forEach((id) => nuevo.add(id))
      }

      return nuevo
    })
  }

  function limpiarSeleccion() {
    setSeleccion(new Set())
  }

  async function guardarCampo(producto, cambios, campo) {
    setGuardandoCampo((actual) => ({
      ...actual,
      [producto.id]: campo
    }))

    const { data, error } = await supabase
      .from('productos')
      .update({
        ...cambios,
        updated_at: new Date().toISOString()
      })
      .eq('id', producto.id)
      .select()
      .single()

    setGuardandoCampo((actual) => {
      const nuevo = { ...actual }
      delete nuevo[producto.id]
      return nuevo
    })

    if (error) {
      console.error(error)
      alert('No se pudo guardar:\n\n' + error.message)
      return
    }

    onActualizarProducto(data)
    avisar('Guardado correctamente.')
  }

  function productoGuardado(productoActualizado) {
    onActualizarProducto(productoActualizado)
    setModal(null)
    avisar('Producto actualizado.')
  }

  function productosActualizados(lista, detalle) {
    onActualizarProductos(lista)

    if (detalle) {
      avisar(detalle)
    }
  }

  function productosEliminados(ids) {
    onEliminarProductos(ids)

    setSeleccion((actual) => {
      const nuevo = new Set(actual)
      ids.forEach((id) => nuevo.delete(id))
      return nuevo
    })

    avisar(
      ids.length === 1
        ? 'Producto eliminado.'
        : `${ids.length} productos eliminados.`
    )
  }

  function productosDesactivados(ids) {
    const lista = seleccionados
      .filter((producto) => ids.includes(producto.id))
      .map((producto) => ({ ...producto, activo: false }))

    onActualizarProductos(lista)
    avisar(`${ids.length} producto(s) desactivado(s).`)
  }

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
                  placeholder="Ej: Taza personalizable"
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


          <label className="editar-toggle">

            <input
              type="checkbox"
              checked={modoEdicion}
              onChange={(e) => {
                setModoEdicion(e.target.checked)

                if (!e.target.checked) {
                  limpiarSeleccion()
                }
              }}
            />

            <span>
              Editar
            </span>

          </label>


          <div
            className="vista-toggle"
            role="group"
            aria-label="Cambiar vista de productos"
          >

            <button
              type="button"
              className={
                'vista-boton' +
                (vista === 'lista'
                  ? ' activa'
                  : '')
              }
              title="Ver como lista"
              onClick={() => setVista('lista')}
            >
              <List size={16} />
            </button>

            <button
              type="button"
              className={
                'vista-boton' +
                (vista === 'cuadricula'
                  ? ' activa'
                  : '')
              }
              title="Ver como cuadrícula"
              onClick={() => setVista('cuadricula')}
            >
              <LayoutGrid size={16} />
            </button>

          </div>


          <select
            className="filtro-productos"
            value={filtroCategoria}
            onChange={(e) =>
              setFiltroCategoria(e.target.value)
            }
            aria-label="Filtrar por categoría"
          >

            <option value="">
              Categoría: todas
            </option>

            {categorias.map((categoria) => (
              <option
                key={categoria.id}
                value={categoria.id}
              >
                {categoria.nombre}
              </option>
            ))}

          </select>


          <select
            className="filtro-productos"
            value={filtroEstado}
            onChange={(e) =>
              setFiltroEstado(e.target.value)
            }
            aria-label="Filtrar por estado"
          >

            <option value="todos">
              Estado: todos
            </option>

            <option value="activos">
              Activos
            </option>

            <option value="inactivos">
              Inactivos
            </option>

          </select>


          <div className="catalogo-orden-caja">

            <span>Ordenar:</span>

            <select
              className="catalogo-orden"
              value={orden}
              onChange={(e) =>
                setOrden(e.target.value)
              }
              aria-label="Ordenar productos"
            >
              <option value="orden">
                Destacados
              </option>
              <option value="nombre_asc">
                Nombre A-Z
              </option>
              <option value="nombre_desc">
                Nombre Z-A
              </option>
              <option value="precio_asc">
                Precio $ ↑
              </option>
              <option value="precio_desc">
                Precio $ ↓
              </option>
            </select>

          </div>


          <span className="cantidad-productos">

            {visibles.length}
            {' '}
            productos

          </span>

        </div>

      )}


{!mostrarFormulario && (

        <div className="productos-tabla-contenedor">

          {cargando && (
            <div className="cargando">
              Cargando productos...
            </div>
          )}

          {!cargando &&
            visibles.length > 0 &&
            vista === 'lista' && (
            <div className="productos-tabla">

              <div className="productos-tabla-cabecera">

                {modoEdicion && (
                  <div className="celda-check">
                    <input
                      type="checkbox"
                      checked={todosVisiblesSeleccionados}
                      onChange={alternarTodosVisibles}
                      aria-label="Seleccionar todos los productos visibles"
                      title="Seleccionar todos los visibles"
                    />
                  </div>
                )}

                <div className="celda-producto">
                  Producto
                </div>

                <div className="celda-categoria">
                  Categoría
                </div>

                <div className="celda-proveedor">
                  Proveedor
                </div>

                <div className="celda-precio">
                  Precio
                </div>

                <div className="celda-estado">
                  Estado
                </div>

                <div className="celda-acciones">
                  Acciones
                </div>

              </div>

              {visibles.map((producto) => {

                const categoria = categorias.find(
                  (c) => c.id === producto.categoria_id
                )

                const precioVisible =
                  producto.precio_publico ??
                  producto.precio

                const guardandoEste =
                  guardandoCampo[producto.id]

                return (
                  <div
                    className={
                      'productos-fila' +
                      (seleccion.has(producto.id)
                        ? ' seleccionada'
                        : '') +
                      (producto.activo ? '' : ' inactiva')
                    }
                    key={producto.id}
                    onMouseEnter={(e) => {
                      const rect =
                        e.currentTarget.getBoundingClientRect()
                      setPreview({
                        id: producto.id,
                        left: Math.min(
                          rect.right + 14,
                          window.innerWidth - 190
                        ),
                        top: Math.max(
                          Math.min(
                            rect.top + rect.height / 2,
                            window.innerHeight - 100
                          ),
                          90
                        )
                      })
                    }}
                    onMouseLeave={() => setPreview(null)}
                  >

                    {preview &&
                      preview.id === producto.id && (
                        <div
                          className="producto-hover-imagen"
                          style={{
                            left: preview.left,
                            top: preview.top
                          }}
                        >
                          {producto.imagen_principal ? (
                            <img
                              src={
                                producto.usa_mockup
                                  ? (producto.imagen_mockup || producto.imagen_principal)
                                  : (producto.imagen_original || producto.imagen_principal)
                              }
                              alt={nombreProducto(producto)}
                            />
                          ) : (
                            <div className="sin-imagen">
                              <Package size={26} />
                              Sin imagen
                            </div>
                          )}
                        </div>
                      )}

                    {modoEdicion && (
                      <div className="celda-check">
                        <input
                          type="checkbox"
                          checked={seleccion.has(producto.id)}
                          onChange={() =>
                            alternarSeleccion(producto.id)
                          }
                          aria-label={`Seleccionar ${nombreProducto(producto)}`}
                        />
                      </div>
                    )}

                    <div className="celda-producto">

                      <div
                        className="producto-nombre-comercial"
                        onClick={() =>
                          onAbrirProducto(producto)
                        }
                        title="Ver detalle completo"
                      >
                        {nombreProducto(producto)}
                      </div>

                      {producto.nombre &&
                        producto.nombre !==
                          (producto.nombre_comercial ||
                            producto.nombre) && (
                          <div className="producto-nombre-proveedor">
                            {producto.nombre}
                          </div>
                        )}

                      {producto.codigo_interno && (
                        <div className="producto-codigo">
                          {producto.codigo_interno}
                        </div>
                      )}

                    </div>

                    <div className="celda-categoria">

                      {modoEdicion ? (

                        <select
                          className="edicion-inline"
                          value={
                            producto.categoria_id ?? ''
                          }
                          disabled={!!guardandoEste}
                          onChange={(e) => {
                            if (!e.target.value) return

                            guardarCampo(
                              producto,
                              {
                                categoria_id:
                                  Number(e.target.value)
                              },
                              'categoria'
                            )
                          }}
                        >
                          <option value="">
                            Sin categoría
                          </option>

                          {categorias.map((categoriaF) => (
                            <option
                              key={categoriaF.id}
                              value={categoriaF.id}
                            >
                              {categoriaF.nombre}
                            </option>
                          ))}

                        </select>

                      ) : (

                        <span>
                          {categoria?.nombre ||
                            'Sin categoría'}
                        </span>

                      )}

                    </div>

                    <div className="celda-proveedor">

                      {proveedorInfo[producto.id] ? (

                        <>

                          <strong>
                            {
                              proveedorInfo[
                                producto.id
                              ].proveedor
                            }
                          </strong>

                          {proveedorInfo[
                            producto.id
                          ].precio_compra !== null &&
                          proveedorInfo[
                            producto.id
                          ].precio_compra !==
                            undefined ? (

                            <span>
                              Compra: $
                              {Number(
                                proveedorInfo[
                                  producto.id
                                ].precio_compra
                              ).toLocaleString(
                                'es-UY'
                              )}
                            </span>

                          ) : (

                            <span className="sin-costo-texto">
                              Sin precio
                            </span>

                          )}

                          <small
                            className={
                              proveedorInfo[
                                producto.id
                              ].disponible
                                ? 'positivo'
                                : 'negativo'
                            }
                          >
                            {proveedorInfo[
                              producto.id
                            ].disponible
                              ? 'Disponible'
                              : 'No disponible'}
                          </small>

                        </>

                      ) : (

                        <span className="secundario">
                          —
                        </span>

                      )}

                    </div>

                    <div className="celda-precio">

                      {modoEdicion ? (

                        <input
                          className="edicion-inline precio"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={
                            producto.precio_publico ?? ''
                          }
                          disabled={!!guardandoEste}
                          title="Precio público (minorista). Enter o salir del campo para guardar."
                          onBlur={(e) => {
                            const valor =
                              e.target.value.trim()

                            if (valor === '') return

                            if (
                              Number(valor) ===
                              Number(
                                producto.precio_publico
                              )
                            ) {
                              return
                            }

                            guardarCampo(
                              producto,
                              {
                                precio_publico:
                                  Number(valor)
                              },
                              'precio'
                            )
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur()
                            }
                          }}
                        />

                      ) : (

                        <span>
                          {precioVisible !== null &&
                          precioVisible !== undefined
                            ? '$' +
                              Number(
                                precioVisible
                              ).toLocaleString(
                                'es-UY'
                              )
                            : '—'}
                        </span>

                      )}

                    </div>

                    <div className="celda-estado">

                      {modoEdicion ? (

                        <button
                          type="button"
                          className={
                            'estado-toggle' +
                            (producto.activo
                              ? ' activo'
                              : ' inactivo')
                          }
                          disabled={!!guardandoEste}
                          title="Clic para cambiar el estado"
                          onClick={() =>
                            guardarCampo(
                              producto,
                              {
                                activo:
                                  !producto.activo
                              },
                              'estado'
                            )
                          }
                        >
                          {producto.activo
                            ? 'Activo'
                            : 'Inactivo'}
                        </button>

                      ) : (

                        <span
                          className={
                            'estado-badge-adm' +
                            (producto.activo
                              ? ' activo'
                              : ' inactivo')
                          }
                        >
                          {producto.activo
                            ? 'Activo'
                            : 'Inactivo'}
                        </span>

                      )}

                    </div>

                    <div className="celda-acciones">

                      <button
                        type="button"
                        className="accion-icono"
                        title="Editar producto"
                        onClick={() =>
                          setModal({
                            tipo: 'editar',
                            producto
                          })
                        }
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        type="button"
                        className="accion-icono peligro"
                        title="Eliminar producto"
                        onClick={() =>
                          setModal({
                            tipo: 'eliminar',
                            ids: [producto.id]
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>

                    </div>

                  </div>
                )
              })}

            </div>
          )}

          {!cargando &&
            visibles.length > 0 &&
            vista === 'cuadricula' && (

            <div className="productos-cuadricula">

              {visibles.map((producto) => {

                const categoria = categorias.find(
                  (c) => c.id === producto.categoria_id
                )

                const precioVisible =
                  producto.precio_publico ??
                  producto.precio

                const guardandoEste =
                  guardandoCampo[producto.id]

                return (
                  <div
                    className={
                      'producto-tarjeta' +
                      (seleccion.has(producto.id)
                        ? ' seleccionada'
                        : '') +
                      (producto.activo ? '' : ' inactiva')
                    }
                    key={producto.id}
                  >

                    <div className="tarjeta-imagen">

                      {producto.imagen_principal ? (
                        <img
                          src={
                            producto.usa_mockup
                              ? (producto.imagen_mockup || producto.imagen_principal)
                              : (producto.imagen_original || producto.imagen_principal)
                          }
                          alt={nombreProducto(producto)}
                          loading="lazy"
                          onClick={() =>
                            onAbrirProducto(producto)
                          }
                        />
                      ) : (
                        <div
                          className="tarjeta-sin-imagen"
                          onClick={() =>
                            onAbrirProducto(producto)
                          }
                        >
                          <Package size={30} />
                          <span>
                            Sin imagen
                          </span>
                        </div>
                      )}

                      {modoEdicion && (
                        <label
                          className="tarjeta-check"
                          onClick={(e) =>
                            e.stopPropagation()
                          }
                        >
                          <input
                            type="checkbox"
                            checked={seleccion.has(
                              producto.id
                            )}
                            onChange={() =>
                              alternarSeleccion(
                                producto.id
                              )
                            }
                            aria-label={`Seleccionar ${nombreProducto(producto)}`}
                          />
                        </label>
                      )}

                      <div className="tarjeta-acciones">

                        <button
                          type="button"
                          className="accion-icono"
                          title="Editar producto"
                          onClick={() =>
                            setModal({
                              tipo: 'editar',
                              producto
                            })
                          }
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className={
                            'accion-icono' +
                            (producto.usa_mockup && producto.imagen_mockup
                              ? ' activa-mockup'
                              : '')
                          }
                          title={
                            producto.usa_mockup && producto.imagen_mockup
                              ? 'Mostrando mockup. Clic para ver original'
                              : 'Mostrando original. Clic para ver mockup'
                          }
                          onClick={() =>
                            guardarCampo(
                              producto,
                              {
                                usa_mockup:
                                  !producto.usa_mockup
                              },
                              'usa_mockup'
                            )
                          }
                        >
                          {producto.usa_mockup && producto.imagen_mockup
                            ? <Sparkles size={16} />
                            : <ImageOff size={16} />}
                        </button>

                        <button
                          type="button"
                          className="accion-icono peligro"
                          title="Eliminar producto"
                          onClick={() =>
                            setModal({
                              tipo: 'eliminar',
                              ids: [producto.id]
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>

                      </div>

                    </div>

                    <div className="tarjeta-cuerpo">

                      <div
                        className="producto-nombre-comercial"
                        onClick={() =>
                          onAbrirProducto(producto)
                        }
                        title="Ver detalle completo"
                      >
                        {nombreProducto(producto)}
                      </div>

                      {producto.nombre &&
                        producto.nombre !==
                          (producto.nombre_comercial ||
                            producto.nombre) && (
                          <div className="producto-nombre-proveedor">
                            {producto.nombre}
                          </div>
                        )}

                      {producto.codigo_interno && (
                        <div className="producto-codigo">
                          {producto.codigo_interno}
                        </div>
                      )}

                      <div className="tarjeta-fila">

                        {modoEdicion ? (

                          <select
                            className="edicion-inline"
                            value={
                              producto.categoria_id ?? ''
                            }
                            disabled={!!guardandoEste}
                            onChange={(e) => {
                              if (!e.target.value) return

                              guardarCampo(
                                producto,
                                {
                                  categoria_id:
                                    Number(
                                      e.target.value
                                    )
                                },
                                'categoria'
                              )
                            }}
                          >
                            <option value="">
                              Sin categoría
                            </option>

                            {categorias.map(
                              (categoriaF) => (
                                <option
                                  key={categoriaF.id}
                                  value={categoriaF.id}
                                >
                                  {categoriaF.nombre}
                                </option>
                              )
                            )}

                          </select>

                        ) : (

                          <span className="tarjeta-categoria">
                            {categoria?.nombre ||
                              'Sin categoría'}
                          </span>

                        )}

                        <span className="tarjeta-precio">

                          {precioVisible !== null &&
                          precioVisible !== undefined
                            ? '$' +
                              Number(
                                precioVisible
                              ).toLocaleString(
                                'es-UY'
                              )
                            : '—'}

                        </span>

                      </div>

                      <div className="tarjeta-fila">

                        {modoEdicion ? (

                          <input
                            className="edicion-inline precio"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={
                              producto.precio_publico ?? ''
                            }
                            disabled={!!guardandoEste}
                            title="Precio público (minorista). Enter o salir del campo para guardar."
                            onBlur={(e) => {
                              const valor =
                                e.target.value.trim()

                              if (valor === '') return

                              if (
                                Number(valor) ===
                                Number(
                                  producto.precio_publico
                                )
                              ) {
                                return
                              }

                              guardarCampo(
                                producto,
                                {
                                  precio_publico:
                                    Number(valor)
                                },
                                'precio'
                              )
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur()
                              }
                            }}
                          />

                        ) : (
                          <span className="tarjeta-precio-editable">
                            Precio editable
                          </span>
                        )}

                        {modoEdicion ? (

                          <button
                            type="button"
                            className={
                              'estado-toggle' +
                              (producto.activo
                                ? ' activo'
                                : ' inactivo')
                            }
                            disabled={!!guardandoEste}
                            title="Clic para cambiar el estado"
                            onClick={() =>
                              guardarCampo(
                                producto,
                                {
                                  activo:
                                    !producto.activo
                                },
                                'estado'
                              )
                            }
                          >
                            {producto.activo
                              ? 'Activo'
                              : 'Inactivo'}
                          </button>

                        ) : (

                          <span
                            className={
                              'estado-badge-adm' +
                              (producto.activo
                                ? ' activo'
                                : ' inactivo')
                            }
                          >
                            {producto.activo
                              ? 'Activo'
                              : 'Inactivo'}
                          </span>

                        )}

                      </div>

                    </div>

                  </div>
                )
              })}

            </div>
          )}

          {!cargando && visibles.length === 0 && (

            <div className="sin-productos">

              <Package size={42} />

              <h3>
                No encontramos productos
              </h3>

              <p>
                {productos.length === 0
                  ? 'Creá tu primer producto con "Nuevo producto".'
                  : 'Probá con otra búsqueda o cambiá los filtros.'}
              </p>

            </div>

          )}

        </div>

      )}

      {modoEdicion && seleccion.size > 0 && (

        <div className="seleccion-barra">

          <span className="seleccion-conteo">

            <ListChecks size={17} />

            {seleccion.size}{' '}
            {seleccion.size === 1
              ? 'producto seleccionado'
              : 'productos seleccionados'}

          </span>

          <div className="seleccion-acciones">

            <button
              type="button"
              onClick={() =>
                setModal({ tipo: 'masivo' })
              }
            >
              Editar seleccionados
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  tipo: 'accion',
                  campo: 'categoria'
                })
              }
            >
              Cambiar categoría
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  tipo: 'accion',
                  campo: 'precio'
                })
              }
            >
              Cambiar precio
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  tipo: 'accion',
                  campo: 'nombre'
                })
              }
            >
              Cambiar nombre
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({
                  tipo: 'accion',
                  campo: 'estado'
                })
              }
            >
              Activar / Desactivar
            </button>

            <button
              type="button"
              onClick={() =>
                setModal({ tipo: 'normalizar' })
              }
            >
              Normalizar nombres
            </button>

            <button
              type="button"
              className="peligro"
              onClick={() =>
                setModal({
                  tipo: 'eliminar',
                  ids: [...seleccion]
                })
              }
            >
              Eliminar {seleccion.size}
            </button>

            <button
              type="button"
              className="sutil"
              onClick={limpiarSeleccion}
            >
              Limpiar
            </button>

          </div>

        </div>

      )}

      {mensaje && (

        <div className="toast-aviso">

          <Check size={16} />

          {mensaje}

        </div>

      )}

      {modal?.tipo === 'editar' && (

        <ModalEditarProducto
          producto={modal.producto}
          categorias={categorias}
          onCerrar={() => setModal(null)}
          onGuardado={productoGuardado}
        />

      )}

      {modal?.tipo === 'masivo' && (

        <ModalEdicionMasiva
          ids={[...seleccion]}
          productos={productos}
          categorias={categorias}
          onCerrar={() => setModal(null)}
          onAplicado={(lista, detalle) => {
            setModal(null)
            productosActualizados(lista, detalle)
          }}
        />

      )}

      {modal?.tipo === 'accion' && (

        <ModalAccionRapida
          campo={modal.campo}
          ids={[...seleccion]}
          productos={productos}
          categorias={categorias}
          onCerrar={() => setModal(null)}
          onAplicado={(lista, detalle) => {
            setModal(null)
            productosActualizados(lista, detalle)
          }}
        />

      )}

      {modal?.tipo === 'normalizar' && (

        <ModalNormalizar
          ids={[...seleccion]}
          productos={productos}
          onCerrar={() => setModal(null)}
          onAplicado={(lista, detalle) => {
            setModal(null)
            productosActualizados(lista, detalle)
          }}
        />

      )}

      {modal?.tipo === 'eliminar' && (

        <ModalEliminar
          ids={modal.ids}
          productos={productos}
          onCerrar={() => setModal(null)}
          onEliminados={(ids) => {
            setModal(null)
            productosEliminados(ids)
          }}
          onDesactivados={(ids) => {
            setModal(null)
            productosDesactivados(ids)
          }}
        />

      )}
    </>

  )
}



const TABLAS_RELACIONADAS = [
  { tabla: 'pedido_detalles', nombre: 'detalles de pedidos' },
  { tabla: 'pedido_items', nombre: 'items de pedidos' },
  { tabla: 'pedidos', nombre: 'pedidos' },
  { tabla: 'producto_variantes', nombre: 'variantes' },
  { tabla: 'producto_proveedores', nombre: 'relación con proveedores' },
  { tabla: 'producto_personalizaciones', nombre: 'personalizaciones' },
  { tabla: 'producto_preguntas', nombre: 'preguntas' },
  { tabla: 'precios_productos', nombre: 'precios' }
]

async function verificarRelaciones(ids) {
  const bloqueados = []

  const porId = new Map(
    ids.map((id) => [id, []])
  )

  for (const { tabla, nombre } of TABLAS_RELACIONADAS) {
    const { data, error } = await supabase
      .from(tabla)
      .select('producto_id')
      .in('producto_id', ids)

    if (error) {
      console.error('Error verificando ' + tabla + ':', error)
      continue
    }

    for (const fila of data || []) {
      if (porId.has(fila.producto_id)) {
        porId.get(fila.producto_id).push(nombre)
      }
    }
  }

  for (const [id, tablas] of porId) {
    if (tablas.length > 0) {
      bloqueados.push({ id, tablas })
    }
  }

  return bloqueados
}

/* ============================================================
   MODAL: EDITAR PRODUCTO (INDIVIDUAL)
   ============================================================ */

function ModalEditarProducto({
  producto,
  categorias,
  onCerrar,
  onGuardado
}) {

  const [form, setForm] = useState({
    nombre: producto.nombre || '',
    nombre_comercial: producto.nombre_comercial || '',
    categoria_id: producto.categoria_id || '',
    descripcion: producto.descripcion || '',
    codigo_interno: producto.codigo_interno || '',
    precio_costo:
      producto.precio_costo !== null &&
      producto.precio_costo !== undefined
        ? String(Number(producto.precio_costo))
        : '',
    precio_mayorista:
      producto.precio_mayorista !== null &&
      producto.precio_mayorista !== undefined
        ? String(Number(producto.precio_mayorista))
        : '',
    precio_publico:
      producto.precio_publico !== null &&
      producto.precio_publico !== undefined
        ? String(Number(producto.precio_publico))
        : '',
    activo: producto.activo !== false,
    permite_personalizacion:
      producto.permite_personalizacion !== false,
    orden:
      producto.orden !== null && producto.orden !== undefined
        ? String(producto.orden)
        : ''
  })

  const [variantes, setVariantes] = useState([])
  const [personalizaciones, setPersonalizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('producto_variantes')
        .select('*')
        .eq('producto_id', producto.id)
        .eq('activo', true)
        .order('id'),

      supabase
        .from('producto_personalizaciones')
        .select(`
          *,
          tipos_personalizacion (
            nombre,
            descripcion
          )
        `)
        .eq('producto_id', producto.id)
        .eq('activo', true)
        .order('id')
    ])
      .then(([respuestaVariantes, respuestaPersonalizaciones]) => {
        if (respuestaVariantes.error) {
          console.error('Error cargando variantes:', respuestaVariantes.error)
        }

        if (respuestaPersonalizaciones.error) {
          console.error(
            'Error cargando personalizaciones:',
            respuestaPersonalizaciones.error
          )
        }

        setVariantes(
          (respuestaVariantes.data || []).map((variante) => ({
            ...variante,
            _nuevo: false
          }))
        )

        setPersonalizaciones(
          respuestaPersonalizaciones.data || []
        )

        setCargando(false)
      })
  }, [producto.id])

  function setCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }))
  }

  function cambiarVariante(clave, campo, valor) {
    setVariantes((actuales) =>
      actuales.map((variante) => {
        const esLaVariante = variante.id
          ? variante.id === clave
          : variante._tmp === clave

        return esLaVariante
          ? { ...variante, [campo]: valor }
          : variante
      })
    )
  }

  function agregarVariante() {
    setVariantes((actuales) => [
      ...actuales,
      {
        id: null,
        _nuevo: true,
        _tmp:
          typeof crypto !== 'undefined' &&
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'nueva-' + Date.now() + '-' + Math.random(),
        nombre: '',
        precio: ''
      }
    ])
  }

  function quitarVariante(clave) {
    setVariantes((actuales) =>
      actuales.filter((variante) =>
        variante.id
          ? variante.id !== clave
          : variante._tmp !== clave
      )
    )
  }

  async function guardar(e) {
    e.preventDefault()

    if (!form.nombre.trim()) {
      alert('El nombre es obligatorio.')
      return
    }

    if (!form.categoria_id) {
      alert('Seleccioná una categoría.')
      return
    }

    setGuardando(true)

    const actualizacion = {
      nombre: form.nombre.trim(),
      nombre_comercial: form.nombre_comercial.trim() || null,
      categoria_id: Number(form.categoria_id),
      descripcion: form.descripcion.trim() || null,
      codigo_interno: form.codigo_interno.trim() || null,
      precio_costo:
        form.precio_costo === '' ? null : Number(form.precio_costo),
      precio_mayorista:
        form.precio_mayorista === '' ? null : Number(form.precio_mayorista),
      precio_publico:
        form.precio_publico === '' ? null : Number(form.precio_publico),
      activo: form.activo,
      permite_personalizacion: form.permite_personalizacion,
      orden: form.orden === '' ? 0 : Number(form.orden),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('productos')
      .update(actualizacion)
      .eq('id', producto.id)
      .select()
      .single()

    if (error) {
      console.error(error)
      alert('No se pudo guardar el producto:\n\n' + error.message)
      setGuardando(false)
      return
    }

    const originales = new Map(
      variantes
        .filter((variante) => variante.id)
        .map((variante) => [variante.id, variante])
    )

    const idsActuales = [...originales.keys()]

    const operaciones = []

    for (const variante of variantes) {
      const nombreVariante = (variante.nombre || '').trim()

      if (!nombreVariante) continue

      const precioVariante =
        variante.precio === '' || variante.precio === null
          ? null
          : Number(variante.precio)

      if (variante._nuevo) {
        operaciones.push(
          supabase
            .from('producto_variantes')
            .insert({
              producto_id: producto.id,
              nombre: nombreVariante,
              precio: precioVariante,
              activo: true
            })
        )
      } else {
        const original = originales.get(variante.id)

        if (
          original &&
          (original.nombre !== nombreVariante ||
            Number(original.precio) !== Number(precioVariante))
        ) {
          operaciones.push(
            supabase
              .from('producto_variantes')
              .update({
                nombre: nombreVariante,
                precio: precioVariante
              })
              .eq('id', variante.id)
          )
        }
      }
    }

    for (const id of idsActuales) {
      if (!variantes.some((variante) => variante.id === id)) {
        operaciones.push(
          supabase
            .from('producto_variantes')
            .delete()
            .eq('id', id)
        )
      }
    }

    if (operaciones.length > 0) {
      const resultados = await Promise.allSettled(operaciones)

      const errores = resultados.filter(
        (resultado) => resultado.status === 'rejected'
      )

      if (errores.length > 0) {
        console.error('Errores en variantes:', errores)

        if (variantes.some((variante) => !variante._nuevo)) {
          alert(
            'El producto se guardó, pero hubo errores guardando las variantes.'
          )
        }
      }
    }

    setGuardando(false)
    onGuardado(data)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>

      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>

            <h2>
              Editar producto
            </h2>

            <p>
              {producto.codigo_interno || 'Sin código'}
            </p>

          </div>

          <button
            type="button"
            className="accion-icono"
            onClick={onCerrar}
            title="Cerrar"
          >
            <X size={19} />
          </button>

        </div>

        <form onSubmit={guardar}>

          <div className="modal-cuerpo">

            <div className="form-grid">

              <label>

                <strong>
                  Nombre (proveedor) *
                </strong>

                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) =>
                    setCampo('nombre', e.target.value)
                  }
                  placeholder="Nombre que llega del proveedor"
                />

              </label>

              <label>

                <strong>
                  Nombre comercial
                </strong>

                <input
                  type="text"
                  value={form.nombre_comercial}
                  onChange={(e) =>
                    setCampo('nombre_comercial', e.target.value)
                  }
                  placeholder="Nombre que ve el cliente"
                />

                <small>
                  Si está vacío, el cliente ve el nombre del proveedor.
                </small>

              </label>

              <label>

                <strong>
                  Categoría *
                </strong>

                <select
                  value={form.categoria_id}
                  onChange={(e) =>
                    setCampo('categoria_id', e.target.value)
                  }
                >
                  <option value="">
                    Seleccionar categoría...
                  </option>

                  {categorias.map((categoria) => (
                    <option
                      key={categoria.id}
                      value={categoria.id}
                    >
                      {categoria.nombre}
                    </option>
                  ))}

                </select>

              </label>

              <label>

                <strong>
                  Código interno
                </strong>

                <input
                  type="text"
                  value={form.codigo_interno}
                  onChange={(e) =>
                    setCampo('codigo_interno', e.target.value)
                  }
                  placeholder="Ej: TAZA-001"
                />

              </label>

              <label>

                <strong>
                  Precio proveedor
                </strong>

                <input
                  type="number"
                  step="0.01"
                  value={form.precio_costo}
                  onChange={(e) =>
                    setCampo('precio_costo', e.target.value)
                  }
                  placeholder="100"
                />

              </label>

              <label>

                <strong>
                  Precio mayorista
                </strong>

                <input
                  type="number"
                  step="0.01"
                  value={form.precio_mayorista}
                  onChange={(e) =>
                    setCampo('precio_mayorista', e.target.value)
                  }
                  placeholder="300"
                />

              </label>

              <label>

                <strong>
                  Precio minorista / público
                </strong>

                <input
                  type="number"
                  step="0.01"
                  value={form.precio_publico}
                  onChange={(e) =>
                    setCampo('precio_publico', e.target.value)
                  }
                  placeholder="400"
                />

              </label>

              <label>

                <strong>
                  Orden (destacados)
                </strong>

                <input
                  type="number"
                  value={form.orden}
                  onChange={(e) =>
                    setCampo('orden', e.target.value)
                  }
                  placeholder="0"
                />

              </label>

            </div>

            <label className="campo-completo">

              <strong>
                Descripción
              </strong>

              <textarea
                rows="3"
                value={form.descripcion}
                onChange={(e) =>
                  setCampo('descripcion', e.target.value)
                }
                placeholder="Descripción del producto"
              />

            </label>

            <div className="modal-checks">

              <label className="check">

                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setCampo('activo', e.target.checked)
                  }
                />

                <strong>
                  Producto activo (visible en el catálogo)
                </strong>

              </label>

              <label className="check">

                <input
                  type="checkbox"
                  checked={form.permite_personalizacion}
                  onChange={(e) =>
                    setCampo(
                      'permite_personalizacion',
                      e.target.checked
                    )
                  }
                />

                <strong>
                  Permite personalización
                </strong>

              </label>

            </div>

            <div className="modal-seccion">

              <div className="modal-seccion-titulo">

                <strong>
                  Variantes
                </strong>

                <button
                  type="button"
                  className="agregar-chico"
                  onClick={agregarVariante}
                >
                  + Agregar variante
                </button>

              </div>

              {cargando ? (
                <p className="modal-ayuda">
                  Cargando variantes...
                </p>
              ) : variantes.length === 0 ? (
                <p className="modal-ayuda">
                  Este producto no tiene variantes.
                  Podés agregarlas si hace falta
                  (ej: talles, colores).
                </p>
              ) : (
                <div className="variantes-lista">

                  {variantes.map((variante) => (
                    <div
                      className="variante-fila"
                      key={
                        variante.id ?? variante._tmp
                      }
                    >

                      <input
                        type="text"
                        placeholder="Nombre de la variante"
                        value={variante.nombre}
                        onChange={(e) =>
                          cambiarVariante(
                            variante.id ?? variante._tmp,
                            'nombre',
                            e.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={variante.precio ?? ''}
                        onChange={(e) =>
                          cambiarVariante(
                            variante.id ?? variante._tmp,
                            'precio',
                            e.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        className="accion-icono peligro"
                        title="Quitar variante"
                        onClick={() =>
                          quitarVariante(
                            variante.id ?? variante._tmp
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>

                    </div>
                  ))}

                </div>
              )}

            </div>

            {personalizaciones.length > 0 && (

              <div className="modal-seccion">

                <div className="modal-seccion-titulo">

                  <strong>
                    Personalización existente
                  </strong>

                </div>

                <div className="pers-existente">

                  {personalizaciones.map((item) => (
                    <span key={item.id}>
                      {item.tipos_personalizacion?.nombre ||
                        item.nombre}
                    </span>
                  ))}

                </div>

                <p className="modal-ayuda">
                  Estas opciones de personalización
                  se conservan intactas.
                </p>

              </div>

            )}

          </div>

          <div className="modal-pie">

            <button
              type="button"
              className="sutil"
              onClick={onCerrar}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="guardar"
              disabled={guardando}
            >
              <Save size={17} />

              {guardando
                ? 'Guardando...'
                : 'Guardar cambios'}
            </button>

          </div>

        </form>

      </div>

    </div>
  )
}

/* ============================================================
   MODAL: EDICIÓN MASIVA
   ============================================================ */

function ModalEdicionMasiva({
  ids,
  productos,
  categorias,
  onCerrar,
  onAplicado
}) {

  const [campos, setCampos] = useState({
    nombre: false,
    nombre_comercial: false,
    categoria_id: false,
    precio_costo: false,
    precio_mayorista: false,
    precio_publico: false
  })

  const [valores, setValores] = useState({
    nombre: '',
    nombre_comercial: '',
    categoria_id: '',
    precio_costo: '',
    precio_mayorista: '',
    precio_publico: ''
  })

  const [estado, setEstado] = useState('')

  const [guardando, setGuardando] = useState(false)

  const porId = new Map(
    productos.map((producto) => [producto.id, producto])
  )

  function alternarCampo(campo) {
    setCampos((actual) => ({
      ...actual,
      [campo]: !actual[campo]
    }))
  }

  function setValor(campo, valor) {
    setValores((actual) => ({ ...actual, [campo]: valor }))
  }

  async function aplicar() {
    setGuardando(true)

    const actualizados = []
    let errores = 0

    for (const id of ids) {
      const producto = porId.get(id)

      if (!producto) continue

      const patch = {}

      if (campos.nombre && valores.nombre.trim()) {
        patch.nombre = valores.nombre.trim()
      }

      if (campos.nombre_comercial && valores.nombre_comercial.trim()) {
        patch.nombre_comercial = valores.nombre_comercial.trim()
      }

      if (campos.categoria_id && valores.categoria_id) {
        patch.categoria_id = Number(valores.categoria_id)
      }

      if (
        campos.precio_costo &&
        valores.precio_costo !== '' &&
        valores.precio_costo !== null
      ) {
        patch.precio_costo = Number(valores.precio_costo)
      }

      if (
        campos.precio_mayorista &&
        valores.precio_mayorista !== '' &&
        valores.precio_mayorista !== null
      ) {
        patch.precio_mayorista = Number(valores.precio_mayorista)
      }

      if (
        campos.precio_publico &&
        valores.precio_publico !== '' &&
        valores.precio_publico !== null
      ) {
        patch.precio_publico = Number(valores.precio_publico)
      }

      if (estado === 'activar') {
        patch.activo = true
      }

      if (estado === 'desactivar') {
        patch.activo = false
      }

      if (Object.keys(patch).length === 0) continue

      patch.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('productos')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        errores++
        console.error('Error actualizando producto ' + id + ':', error)
        continue
      }

      actualizados.push(data)
    }

    setGuardando(false)

    let detalle = `Se actualizaron ${actualizados.length} producto(s).`

    if (errores > 0) {
      detalle += ` ${errores} con error (revisá la consola).`
    }

    if (actualizados.length === 0) {
      detalle = 'No se aplicaron cambios: completá los campos marcados.'
    }

    onAplicado(actualizados, detalle)
  }

  const hayCamposMarcados = Object.values(campos).some(Boolean)

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>

      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>

            <h2>
              Editar {ids.length} producto(s)
            </h2>

            <p>
              Solo se aplican los campos marcados y completados.
              Los vacíos no se tocan.
            </p>

          </div>

          <button
            type="button"
            className="accion-icono"
            onClick={onCerrar}
            title="Cerrar"
          >
            <X size={19} />
          </button>

        </div>

        <div className="modal-cuerpo">

          <div className="campos-masivos">

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.nombre}
                onChange={() => alternarCampo('nombre')}
              />
              <span>Nombre (proveedor)</span>
              <input
                type="text"
                placeholder="Dejalo vacío para no tocarlo"
                value={valores.nombre}
                onChange={(e) => setValor('nombre', e.target.value)}
                disabled={!campos.nombre}
              />
            </label>

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.nombre_comercial}
                onChange={() => alternarCampo('nombre_comercial')}
              />
              <span>Nombre comercial</span>
              <input
                type="text"
                placeholder="Dejalo vacío para no tocarlo"
                value={valores.nombre_comercial}
                onChange={(e) =>
                  setValor('nombre_comercial', e.target.value)
                }
                disabled={!campos.nombre_comercial}
              />
            </label>

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.categoria_id}
                onChange={() => alternarCampo('categoria_id')}
              />
              <span>Categoría</span>
              <select
                value={valores.categoria_id}
                onChange={(e) =>
                  setValor('categoria_id', e.target.value)
                }
                disabled={!campos.categoria_id}
              >
                <option value="">Seleccionar...</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.precio_costo}
                onChange={() => alternarCampo('precio_costo')}
              />
              <span>Precio proveedor</span>
              <input
                type="number"
                step="0.01"
                placeholder="Dejalo vacío para no tocarlo"
                value={valores.precio_costo}
                onChange={(e) =>
                  setValor('precio_costo', e.target.value)
                }
                disabled={!campos.precio_costo}
              />
            </label>

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.precio_mayorista}
                onChange={() => alternarCampo('precio_mayorista')}
              />
              <span>Precio mayorista</span>
              <input
                type="number"
                step="0.01"
                placeholder="Dejalo vacío para no tocarlo"
                value={valores.precio_mayorista}
                onChange={(e) =>
                  setValor('precio_mayorista', e.target.value)
                }
                disabled={!campos.precio_mayorista}
              />
            </label>

            <label className="campo-masivo">
              <input
                type="checkbox"
                checked={campos.precio_publico}
                onChange={() => alternarCampo('precio_publico')}
              />
              <span>Precio minorista / público</span>
              <input
                type="number"
                step="0.01"
                placeholder="Dejalo vacío para no tocarlo"
                value={valores.precio_publico}
                onChange={(e) =>
                  setValor('precio_publico', e.target.value)
                }
                disabled={!campos.precio_publico}
              />
            </label>

            <div className="campo-masivo estado-masivo">

              <span>
                Estado activo/inactivo
              </span>

              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">
                  No cambiar
                </option>
                <option value="activar">
                  Activar
                </option>
                <option value="desactivar">
                  Desactivar
                </option>
              </select>

            </div>

          </div>

        </div>

        <div className="modal-pie">

          <button
            type="button"
            className="sutil"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="guardar"
            onClick={aplicar}
            disabled={guardando || (!hayCamposMarcados && !estado)}
          >
            <Save size={17} />

            {guardando
              ? 'Aplicando...'
              : 'Aplicar a ' + ids.length}
          </button>

        </div>

      </div>

    </div>
  )
}

/* ============================================================
   MODAL: ACCIÓN RÁPIDA (1 CAMPO PARA VARIOS PRODUCTOS)
   ============================================================ */

function ModalAccionRapida({
  campo,
  ids,
  productos,
  categorias,
  onCerrar,
  onAplicado
}) {

  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState('')
  const [guardando, setGuardando] = useState(false)

  const porId = new Map(
    productos.map((producto) => [producto.id, producto])
  )

  const titulos = {
    categoria: 'Cambiar categoría',
    precio: 'Cambiar precio (minorista / público)',
    nombre: 'Cambiar nombre comercial',
    estado: 'Activar / desactivar'
  }

  const ayudas = {
    categoria: 'La categoría nueva se aplica a todos los seleccionados.',
    precio: 'Se actualiza el precio minorista (el que ve el cliente).',
    nombre: 'Se actualiza el nombre comercial visible. El nombre del proveedor no cambia.',
    estado: 'Elegí si querés activar o desactivar los seleccionados.'
  }

  async function aplicar() {
    setGuardando(true)

    const actualizados = []
    let errores = 0

    for (const id of ids) {
      const producto = porId.get(id)

      if (!producto) continue

      const patch = {}

      if (campo === 'categoria' && valor) {
        patch.categoria_id = Number(valor)
      }

      if (campo === 'precio' && valor !== '' && valor !== null) {
        patch.precio_publico = Number(valor)
      }

      if (campo === 'nombre' && valor.trim()) {
        patch.nombre_comercial = valor.trim()
      }

      if (campo === 'estado') {
        if (estado === 'activar') patch.activo = true
        if (estado === 'desactivar') patch.activo = false
      }

      if (Object.keys(patch).length === 0) continue

      patch.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('productos')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        errores++
        console.error('Error actualizando producto ' + id + ':', error)
        continue
      }

      actualizados.push(data)
    }

    setGuardando(false)

    let detalle = `Se actualizaron ${actualizados.length} producto(s).`

    if (errores > 0) {
      detalle += ` ${errores} con error (revisá la consola).`
    }

    if (actualizados.length === 0) {
      detalle =
        campo === 'estado'
          ? 'Elegí Activar o Desactivar.'
          : 'Completá el valor para poder aplicarlo.'
    }

    onAplicado(actualizados, detalle)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>

      <div
        className="modal modal-chico"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>

            <h2>
              {titulos[campo]}
            </h2>

            <p>
              Se aplicará a {ids.length} producto(s).
            </p>

          </div>

          <button
            type="button"
            className="accion-icono"
            onClick={onCerrar}
            title="Cerrar"
          >
            <X size={19} />
          </button>

        </div>

        <div className="modal-cuerpo">

          <p className="modal-ayuda">
            {ayudas[campo]}
          </p>

          {campo === 'categoria' && (

            <select
              className="campo-grande"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            >
              <option value="">
                Seleccionar categoría...
              </option>

              {categorias.map((categoria) => (
                <option
                  key={categoria.id}
                  value={categoria.id}
                >
                  {categoria.nombre}
                </option>
              ))}

            </select>

          )}

          {campo === 'precio' && (

            <input
              className="campo-grande"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej: 350"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />

          )}

          {campo === 'nombre' && (

            <input
              className="campo-grande"
              type="text"
              placeholder="Nuevo nombre comercial"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />

          )}

          {campo === 'estado' && (

            <select
              className="campo-grande"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">
                Elegir...
              </option>
              <option value="activar">
                Activar
              </option>
              <option value="desactivar">
                Desactivar
              </option>
            </select>

          )}

        </div>

        <div className="modal-pie">

          <button
            type="button"
            className="sutil"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="guardar"
            onClick={aplicar}
            disabled={guardando}
          >
            <Save size={17} />

            {guardando
              ? 'Aplicando...'
              : 'Aplicar'}
          </button>

        </div>

      </div>

    </div>
  )
}

/* ============================================================
   MODAL: NORMALIZAR NOMBRES COMERCIALES
   ============================================================ */

function ModalNormalizar({
  ids,
  productos,
  onCerrar,
  onAplicado
}) {

  const porId = new Map(
    productos.map((producto) => [producto.id, producto])
  )

  const propuestas = proponerNormalizaciones(
    ids.map((id) => porId.get(id)).filter(Boolean)
  )

  const [marcadas, setMarcadas] = useState(
    () => new Set(propuestas.map((propuesta) => propuesta.id))
  )

  const [guardando, setGuardando] = useState(false)

  function alternar(id) {
    setMarcadas((actual) => {
      const nuevo = new Set(actual)

      if (nuevo.has(id)) {
        nuevo.delete(id)
      } else {
        nuevo.add(id)
      }

      return nuevo
    })
  }

  async function aplicar() {
    setGuardando(true)

    const actualizados = []
    let errores = 0

    for (const propuesta of propuestas) {
      if (!marcadas.has(propuesta.id)) continue

      const { data, error } = await supabase
        .from('productos')
        .update({
          nombre_comercial: propuesta.propuesto,
          updated_at: new Date().toISOString()
        })
        .eq('id', propuesta.id)
        .select()
        .single()

      if (error) {
        errores++
        console.error(
          'Error normalizando producto ' + propuesta.id + ':',
          error
        )
        continue
      }

      actualizados.push(data)
    }

    setGuardando(false)

    let detalle = `Se normalizaron ${actualizados.length} nombre(s).`

    if (errores > 0) {
      detalle += ` ${errores} con error (revisá la consola).`
    }

    if (actualizados.length === 0) {
      detalle = 'No se aplicó ningún cambio.'
    }

    onAplicado(actualizados, detalle)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>

      <div
        className="modal modal-grande"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>

            <h2>
              Normalizar nombres comerciales
            </h2>

            <p>
              Reemplaza términos genéricos del proveedor
              (ej: "jarro sublimable" → "Taza personalizada")
              conservando las características del producto.
            </p>

          </div>

          <button
            type="button"
            className="accion-icono"
            onClick={onCerrar}
            title="Cerrar"
          >
            <X size={19} />
          </button>

        </div>

        <div className="modal-cuerpo">

          {propuestas.length === 0 ? (

            <p className="modal-ayuda">
              Ninguno de los productos seleccionados
              coincide con las reglas de normalización.
            </p>

          ) : (

            <div className="normalizar-lista">

              <label className="normalizar-fila cabecera">

                <input
                  type="checkbox"
                  checked={
                    propuestas.length > 0 &&
                    propuestas.every((propuesta) =>
                      marcadas.has(propuesta.id)
                    )
                  }
                  onChange={() => {
                    const todas =
                      propuestas.every((propuesta) =>
                        marcadas.has(propuesta.id)
                      )

                    setMarcadas(() => {
                      const nuevo = new Set()

                      if (!todas) {
                        propuestas.forEach((propuesta) =>
                          nuevo.add(propuesta.id)
                        )
                      }

                      return nuevo
                    })
                  }}
                />

                <span>Nombre actual</span>
                <span>Nombre comercial propuesto</span>

              </label>

              {propuestas.map((propuesta) => (
                <label
                  className="normalizar-fila"
                  key={propuesta.id}
                >

                  <input
                    type="checkbox"
                    checked={marcadas.has(propuesta.id)}
                    onChange={() => alternar(propuesta.id)}
                  />

                  <span
                    className="normalizar-nombre"
                    title={propuesta.nombre}
                  >
                    {decodificarNombre(propuesta.nombre)}
                  </span>

                  <strong>
                    {propuesta.propuesto}
                  </strong>

                </label>
              ))}

            </div>

          )}

        </div>

        <div className="modal-pie">

          <button
            type="button"
            className="sutil"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="guardar"
            onClick={aplicar}
            disabled={guardando || marcadas.size === 0}
          >
            <Check size={17} />

            {guardando
              ? 'Aplicando...'
              : `Aplicar ${marcadas.size} cambio(s)`}
          </button>

        </div>

      </div>

    </div>
  )
}

/* ============================================================
   MODAL: ELIMINAR (VERIFICA RELACIONES ANTES)
   ============================================================ */

function ModalEliminar({
  ids,
  productos,
  onCerrar,
  onEliminados,
  onDesactivados
}) {

  const porId = new Map(
    productos.map((producto) => [producto.id, producto])
  )

  const [verificando, setVerificando] = useState(true)
  const [bloqueados, setBloqueados] = useState([])
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    let activo = true

    verificarRelaciones(ids).then((resultado) => {
      if (!activo) return

      setBloqueados(resultado)
      setVerificando(false)
    })

    return () => {
      activo = false
    }
  }, [ids])

  const eliminables = ids.filter(
    (id) => !bloqueados.some((bloqueado) => bloqueado.id === id)
  )

  async function eliminar() {
    setProcesando(true)

    const { error } = await supabase
      .from('productos')
      .delete()
      .in('id', eliminables)

    setProcesando(false)

    if (error) {
      console.error(error)
      alert('No se pudieron eliminar los productos:\n\n' + error.message)
      return
    }

    onEliminados(eliminables)
  }

  async function desactivar() {
    setProcesando(true)

    const idsBloqueados = bloqueados.map((bloqueado) => bloqueado.id)

    const { error } = await supabase
      .from('productos')
      .update({
        activo: false,
        updated_at: new Date().toISOString()
      })
      .in('id', idsBloqueados)

    setProcesando(false)

    if (error) {
      console.error(error)
      alert('No se pudieron desactivar los productos:\n\n' + error.message)
      return
    }

    onDesactivados(idsBloqueados)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>

      <div
        className="modal modal-grande"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="modal-header">

          <div>

            <h2>
              Eliminar {ids.length} producto(s)
            </h2>

            <p>
              Antes de borrar se verifican las relaciones
              (pedidos, variantes, personalizaciones, etc.).
            </p>

          </div>

          <button
            type="button"
            className="accion-icono"
            onClick={onCerrar}
            title="Cerrar"
          >
            <X size={19} />
          </button>

        </div>

        <div className="modal-cuerpo">

          {verificando ? (

            <p className="modal-ayuda">
              Verificando relaciones...
            </p>

          ) : bloqueados.length === 0 ? (

            <p className="modal-ayuda">
              Todos los productos seleccionados pueden eliminarse
              sin afectar pedidos ni configuraciones.
            </p>

          ) : (

            <div className="bloqueados-lista">

              <div className="bloqueado-cabecera">

                <strong>
                  {bloqueados.length} producto(s) no se pueden eliminar
                  porque tienen relaciones:
                </strong>

              </div>

              {bloqueados.map((bloqueado) => (
                <div
                  className="bloqueado-fila"
                  key={bloqueado.id}
                >

                  <strong>
                    {nombreProducto(porId.get(bloqueado.id))}
                  </strong>

                  <small>
                    {bloqueado.tablas.join(', ')}
                  </small>

                </div>
              ))}

              <p className="modal-ayuda">
                Podés desactivarlos: quedan ocultos del catálogo
                y conservan todas sus relaciones.
              </p>

            </div>

          )}

        </div>

        <div className="modal-pie">

          <button
            type="button"
            className="sutil"
            onClick={onCerrar}
            disabled={procesando}
          >
            Cancelar
          </button>

          {eliminables.length > 0 && !verificando && (
            <button
              type="button"
              className="peligro"
              onClick={eliminar}
              disabled={procesando}
            >
              <Trash2 size={17} />

              {procesando
                ? 'Procesando...'
                : `Eliminar ${eliminables.length}`}
            </button>
          )}

          {bloqueados.length > 0 && !verificando && (
            <button
              type="button"
              className="guardar"
              onClick={desactivar}
              disabled={procesando}
            >
              <Check size={17} />

              {procesando
                ? 'Procesando...'
                : `Desactivar ${bloqueados.length}`}
            </button>
          )}

        </div>

      </div>

    </div>
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

  const [
    relacionesProveedor,
    setRelacionesProveedor
  ] = useState([])

  const [
    cargandoRelaciones,
    setCargandoRelaciones
  ] = useState(true)

  const [
    comparacion,
    setComparacion
  ] = useState(null)

  const [
    cargandoComparacion,
    setCargandoComparacion
  ] = useState(false)

  const [
    errorComparacion,
    setErrorComparacion
  ] = useState('')

  async function cargarRelaciones() {

    const { data, error } = await supabase
      .from('producto_proveedores')
      .select(`
        *,
        proveedores (
          nombre
        )
      `)
      .eq('producto_id', producto.id)
      .order('es_principal', { ascending: false })

    if (error) {
      console.error('Error cargando proveedores del producto:', error)
      setCargandoRelaciones(false)
      return
    }

    setRelacionesProveedor(data || [])
    setCargandoRelaciones(false)
  }

  useEffect(() => {
    cargarRelaciones()
  }, [producto.id])

  async function cargarComparacion() {

    setCargandoComparacion(true)
    setErrorComparacion('')

    const { data, error } = await supabase.rpc(
      'mejor_precio_producto',
      { p_producto_id: producto.id }
    )

    setCargandoComparacion(false)

    if (error) {
      console.error('Error comparando proveedores:', error)
      setErrorComparacion(error.message || 'No se pudo comparar.')
      setComparacion(null)
      return
    }

    setComparacion(data || [])
  }


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
            {nombreProducto(producto)}
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
                producto.usa_mockup
                  ? (producto.imagen_mockup || producto.imagen_principal)
                  : (producto.imagen_original || producto.imagen_principal)
              }
              alt={
                nombreProducto(producto)
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
            {nombreProducto(producto)}
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

                {producto.precio_costo !== null &&
                producto.precio_costo !==
                  undefined ? (
                  <>

                    $
                    {Number(
                      producto.precio_costo
                    ).toLocaleString(
                      'es-UY'
                    )}

                  </>
                ) : (

                  <span className="sin-costo-texto">
                    Sin precio
                  </span>

                )}

              </strong>

            </div>


            <div>

              <span>
                Proveedor principal
              </span>

              <strong>
                {relacionesProveedor.find(
                  (relacion) =>
                    relacion.es_principal
                )?.proveedores?.nombre ||
                  relacionesProveedor[0]
                    ?.proveedores?.nombre ||
                  'Sin proveedor'}
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
              Proveedores
            </h2>

            <p>
              Proveedores que ofrecen este producto
              y sus precios de compra.
            </p>

          </div>

          <button
            className="crear"
            type="button"
            disabled={cargandoComparacion}
            onClick={cargarComparacion}
          >

            <GitCompareArrows size={18} />

            {cargandoComparacion
              ? 'Comparando...'
              : 'Comparar proveedores'}

          </button>

        </div>

        {cargandoRelaciones ? (

          <div className="cargando">
            Cargando proveedores...
          </div>

        ) : relacionesProveedor.length === 0 ? (

          <div className="vacio">

            <div className="vacio-icono">
              <Truck size={30} />
            </div>

            <h3>
              Sin proveedores relacionados
            </h3>

            <p>
              Este producto todavía no está
              vinculado a ningún proveedor.
            </p>

          </div>

        ) : (

          <div className="detalle-tabla-contenedor">

            <div className="detalle-tabla productos-proveedor">

              <div className="detalle-tabla-cabecera">

                <div>Proveedor</div>
                <div>Código prov.</div>
                <div>Precio compra</div>
                <div>Moneda</div>
                <div>Disponible</div>
                <div>Principal</div>
                <div>Mínimo</div>
                <div>Entrega</div>

              </div>

              {relacionesProveedor.map((relacion) => (

                <div
                  className="detalle-tabla-fila"
                  key={relacion.id}
                >

                  <div>
                    <strong>
                      {relacion.proveedores?.nombre ||
                        'Proveedor'}
                    </strong>
                  </div>

                  <div className="secundario">
                    {relacion.codigo_proveedor ||
                      '—'}
                  </div>

                  <div>
                    {relacion.precio_compra !==
                      null &&
                    relacion.precio_compra !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          relacion.precio_compra
                        ).toLocaleString(
                          'es-UY'
                        )}

                      </>
                    ) : (

                      <span className="sin-costo-texto">
                        Sin precio
                      </span>

                    )}
                  </div>

                  <div className="secundario">
                    {relacion.moneda || 'UYU'}
                  </div>

                  <div
                    className={
                      relacion.disponible
                        ? 'positivo'
                        : 'negativo'
                    }
                  >
                    {relacion.disponible
                      ? 'Sí'
                      : 'No'}
                  </div>

                  <div>
                    {relacion.es_principal ? (

                      <span className="chip-tipo mayorista">
                        Principal
                      </span>

                    ) : (

                      <span className="secundario">
                        —
                      </span>

                    )}
                  </div>

                  <div className="secundario">
                    {relacion.cantidad_minima !==
                      null &&
                    relacion.cantidad_minima !==
                      undefined
                      ? Number(
                          relacion.cantidad_minima
                        ).toLocaleString('es-UY')
                      : '—'}
                  </div>

                  <div className="secundario">
                    {relacion.tiempo_entrega ||
                      '—'}
                  </div>

                </div>

              ))}

            </div>

          </div>

        )}

        {cargandoComparacion && (

          <div className="cargando">
            Consultando precios de proveedores...
          </div>

        )}

        {errorComparacion && !cargandoComparacion && (

          <div className="vacio">

            <div className="vacio-icono">
              <Truck size={30} />
            </div>

            <h3>
              No se pudo comparar
            </h3>

            <p>
              {errorComparacion}
            </p>

          </div>

        )}

        {comparacion &&
          !cargandoComparacion &&
          !errorComparacion &&
          (comparacion.length === 0 ||
            comparacion.every(
              (proveedor) =>
                proveedor.precio_actual ===
                  null ||
                proveedor.precio_actual ===
                  undefined
            )) && (

          <div className="vacio">

            <div className="vacio-icono">
              <Truck size={30} />
            </div>

            <h3>
              No hay precios disponibles
            </h3>

            <p>
              Ningún proveedor tiene precio de
              compra cargado para este producto.
            </p>

          </div>

        )}

        {comparacion &&
          !cargandoComparacion &&
          !errorComparacion &&
          comparacion.some(
            (proveedor) =>
              proveedor.precio_actual !==
                null &&
              proveedor.precio_actual !==
                undefined
          ) && (

          <div className="detalle-tabla-contenedor">

            <div className="detalle-tabla comparacion">

              <div className="detalle-tabla-cabecera">

                <div>Proveedor</div>
                <div>Precio actual</div>
                <div>Último pagado</div>
                <div>Fecha precio</div>
                <div>Disponible</div>
                <div>Principal</div>
                <div>Mejor precio</div>
                <div>Diferencia</div>

              </div>

              {comparacion.map((proveedor) => (

                <div
                  className={
                    'detalle-tabla-fila' +
                    (proveedor.es_mejor
                      ? ' mejor-precio'
                      : '')
                  }
                  key={proveedor.proveedor_id}
                >

                  <div>
                    <strong>
                      {proveedor.proveedor_nombre}
                    </strong>
                  </div>

                  <div>
                    {proveedor.precio_actual !==
                      null &&
                    proveedor.precio_actual !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          proveedor.precio_actual
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (

                      <span className="sin-costo-texto">
                        Sin precio
                      </span>

                    )}
                  </div>

                  <div className="secundario">
                    {proveedor.ultimo_pagado !==
                      null &&
                    proveedor.ultimo_pagado !==
                      undefined ? (
                      <>

                        $
                        {Number(
                          proveedor.ultimo_pagado
                        ).toLocaleString('es-UY')}

                      </>
                    ) : (
                      '—'
                    )}
                  </div>

                  <div className="secundario">
                    {formatearFecha(
                      proveedor.fecha_precio
                    )}
                  </div>

                  <div
                    className={
                      proveedor.disponible
                        ? 'positivo'
                        : 'negativo'
                    }
                  >
                    {proveedor.disponible
                      ? 'Sí'
                      : 'No'}
                  </div>

                  <div>
                    {proveedor.es_principal ? (

                      <span className="chip-tipo mayorista">
                        Principal
                      </span>

                    ) : (

                      <span className="secundario">
                        —
                      </span>

                    )}
                  </div>

                  <div>
                    {proveedor.es_mejor ? (

                      <span className="badge-mejor-precio">
                        Mejor precio
                      </span>

                    ) : proveedor.precio_actual !==
                        null &&
                      proveedor.precio_actual !==
                        undefined ? (

                      <span className="secundario">
                        No
                      </span>

                    ) : (

                      <span className="secundario">
                        —
                      </span>

                    )}
                  </div>

                  <div>
                    {proveedor.es_mejor ? (

                      <span className="secundario">
                        —
                      </span>

                    ) : proveedor.diferencia_vs_mejor !==
                        null &&
                      proveedor.diferencia_vs_mejor !==
                        undefined ? (

                      <span className="badge-mas-caro">
                        $
                        {Number(
                          proveedor.diferencia_vs_mejor
                        ).toLocaleString('es-UY')}{' '}
                        más
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