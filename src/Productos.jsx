import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [sku, setSku] = useState('')
  const [permitePersonalizacion, setPermitePersonalizacion] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function cargarProductos() {
    setCargando(true)

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error('Error cargando productos:', error)
      setCargando(false)
      return
    }

    setProductos(data || [])
    setCargando(false)
  }
useEffect(() => {
    cargarProductos()
  }, [])

  function abrirFormulario() {
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
  }

  async function guardarProducto(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      alert('Ingresá el nombre del producto.')
      return
    }

    setGuardando(true)

    const { data, error } = await supabase
      .from('productos')
      .insert({
        nombre: nombre.trim(),
        categoria: categoria.trim() || null,
        descripcion: descripcion.trim() || null,
        precio: precio ? Number(precio) : null,
        proveedor: proveedor.trim() || null,
        sku: sku.trim() || null,
        permite_personalizacion: permitePersonalizacion,
        activo: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando producto:', error)
      alert('No se pudo crear el producto: ' + error.message)
      setGuardando(false)
      return
    }

    setProductos((actuales) => [data, ...actuales])

    setNombre('')
    setCategoria('')
    setDescripcion('')
    setPrecio('')
    setProveedor('')
    setSku('')
    setPermitePersonalizacion(true)
    setMostrarFormulario(false)
    setGuardando(false)
  }

  async function eliminarProducto(id) {
    const confirmar = window.confirm(
      '¿Seguro que querés eliminar este producto?'
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando producto:', error)
      alert('No se pudo eliminar el producto: ' + error.message)
      return
    }

    setProductos((actuales) =>
      actuales.filter((producto) => producto.id !== id)
    )
  }

  return (
    <div style={{ padding: '30px' }}>

      {/* CABECERA */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}
      >

        <div>
          <h1 style={{ margin: 0 }}>
            Productos
          </h1>

          <p style={{ color: '#666' }}>
            Administrá los productos disponibles para personalizar.
          </p>
        </div>

        <button
          type="button"
          onClick={mostrarFormulario
            ? cerrarFormulario
            : abrirFormulario}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '15px'
          }}
        >
          {mostrarFormulario
            ? 'Cancelar'
            : '+ Nuevo producto'}
        </button>

      </div>


      {/* FORMULARIO */}

      {mostrarFormulario && (

        <div
          style={{
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '30px'
          }}
        >

          <h2 style={{ marginTop: 0 }}>
            Nuevo producto
          </h2>

          <form onSubmit={guardarProducto}>

            <div
              style={{
                display: 'grid',
                gap: '18px'
              }}
            >

              <label>
                <div>Nombre *</div>

                <input
                  type="text"
                  value={nombre}
                  onChange={(e) =>
                    setNombre(e.target.value)
                  }
                  placeholder="Ej: Taza sublimable"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label>
                <div>Categoría</div>

                <input
                  type="text"
                  value={categoria}
                  onChange={(e) =>
                    setCategoria(e.target.value)
                  }
                  placeholder="Ej: Tazas"
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label>
                <div>Descripción</div>

                <textarea
                  value={descripcion}
                  onChange={(e) =>
                    setDescripcion(e.target.value)
                  }
                  placeholder="Descripción del producto"
                  rows="4"
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label>
                <div>Precio</div>

                <input
                  type="number"
                  step="0.01"
                  value={precio}
                  onChange={(e) =>
                    setPrecio(e.target.value)
                  }
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label>
                <div>Proveedor</div>

                <input
                  type="text"
                  value={proveedor}
                  onChange={(e) =>
                    setProveedor(e.target.value)
                  }
                  placeholder="Nombre del proveedor"
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label>
                <div>SKU / Código</div>

                <input
                  type="text"
                  value={sku}
                  onChange={(e) =>
                    setSku(e.target.value)
                  }
                  placeholder="Ej: TAZA-001"
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginTop: '5px',
                    boxSizing: 'border-box'
                  }}
                />
              </label>


              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >

                <input
                  type="checkbox"
                  checked={permitePersonalizacion}
                  onChange={(e) =>
                    setPermitePersonalizacion(
                      e.target.checked
                    )
                  }
                />

                Permite personalización

              </label>


              <button
                type="submit"
                disabled={guardando}
                style={{
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#111',
                  color: '#fff',
                  cursor: guardando
                    ? 'wait'
                    : 'pointer',
                  fontSize: '15px'
                }}
              >

                {guardando
                  ? 'Guardando...'
                  : 'Guardar producto'}

              </button>

            </div>

          </form>

        </div>

      )}


      {/* LISTADO */}

      <div
        style={{
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >

        {cargando ? (

          <div style={{ padding: '30px' }}>
            Cargando productos...
          </div>

        ) : productos.length === 0 ? (

          <div
            style={{
              padding: '40px',
              textAlign: 'center'
            }}
          >

            <h2>
              No hay productos todavía
            </h2>

            <p>
              Creá el primer producto usando el botón
              "+ Nuevo producto".
            </p>

          </div>

        ) : (

          productos.map((producto) => (

            <div
              key={producto.id}
              style={{
                padding: '20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '20px'
              }}
            >

              <div>

                <h3
                  style={{
                    margin: '0 0 8px'
                  }}
                >
                  {producto.nombre}
                </h3>

                <div
                  style={{
                    color: '#666'
                  }}
                >
                  {producto.categoria ||
                    'Sin categoría'}
                </div>

                {producto.descripcion && (

                  <p
                    style={{
                      color: '#777'
                    }}
                  >
                    {producto.descripcion}
                  </p>

                )}

                {producto.precio !== null &&
                  producto.precio !== undefined && (

                    <strong>
                      ${Number(
                        producto.precio
                      ).toLocaleString('es-UY')}
                    </strong>

                  )}

                {producto.sku && (

                  <div
                    style={{
                      marginTop: '5px',
                      fontSize: '13px'
                    }}
                  >
                    SKU: {producto.sku}
                  </div>

                )}

              </div>


              <button
                type="button"
                onClick={() =>
                  eliminarProducto(producto.id)
                }
                style={{
                  height: '40px',
                  alignSelf: 'center',
                  cursor: 'pointer'
                }}
              >
                Eliminar
              </button>

            </div>

          ))

        )}

      </div>

    </div>
  )
}
