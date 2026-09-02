import { useEffect, useState } from 'react'
import { RECARGO_NOMBRE_TEXTO, RECARGO_BOLSITA } from './lib/pedidos'

const nombreGenerico = (nombre) =>
  (nombre || '').replace(/\s*\([^)]*\)\s*$/g, '').trim()

const extraerColor = (nombre) => {
  const texto = nombre || ''
  const m = texto.match(/color\s+(.+)$/i)
  if (m) {
    return m[1].trim()
  }
  const limpiado = nombreGenerico(texto)
  return limpiado
}

function obtenerPrecioReal(producto, tipo) {
  if (tipo === 'mayorista') {
    const pm = Number(producto.precio_mayorista)
    if (Number.isFinite(pm) && pm > 0) return pm
    const pms = Number(producto.precio_mayorista_sugerido)
    if (Number.isFinite(pms) && pms > 0) return pms
  }
  if (tipo === 'minorista') {
    const pp = Number(producto.precio_publico)
    if (Number.isFinite(pp) && pp > 0) return pp
    const pps = Number(producto.precio_publico_sugerido)
    if (Number.isFinite(pps) && pps > 0) return pps
  }
  const p = Number(producto.precio)
  if (Number.isFinite(p) && p > 0) return p
  return null
}

export function formatearPrecioFicha(valor) {
  return Number(valor || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

export default function FichaProducto({
  familia,
  variaciones,
  categorias,
  tipo,
  onAgregar,
  volver
}) {
  const ordenadas = variaciones || []
  const [variante, setVariante] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [nombreActivo, setNombreActivo] = useState(true)
  const [nombre, setNombre] = useState('')
  const [detalleActivo, setDetalleActivo] = useState(true)
  const [detalle, setDetalle] = useState('')
  const [bolsitaActivo, setBolsitaActivo] = useState(true)
  const [imagenActivo, setImagenActivo] = useState(true)
  const [imagenArchivo, setImagenArchivo] = useState(null)
  const [error, setError] = useState('')
  const [agregado, setAgregado] = useState(false)

  useEffect(() => {
    setVariante(ordenadas[0] || null)
    setAgregado(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familia?.modelo])

  const producto = variante || ordenadas[0] || {}
  const categoria = categorias.find(
    (c) => c.id === (producto.categoria_id ?? familia?.categoria_id)
  )

  const titulo =
    familia?.nombre_familia || nombreGenerico(producto.nombre)

  const precio = obtenerPrecioReal(producto, tipo)
  const precioMinorista =
    tipo === 'mayorista'
      ? obtenerPrecioReal(producto, 'minorista')
      : null

  const cantidadNumero = Math.max(1, Number(cantidad) || 1)
  const subtotal = (precio || 0) * cantidadNumero
  const recargoNombre =
    nombreActivo && nombre.trim()
      ? (precio || 0) * (RECARGO_NOMBRE_TEXTO / 100) * cantidadNumero
      : 0
  const recargoBolsita = bolsitaActivo ? RECARGO_BOLSITA * cantidadNumero : 0
  const recargos = recargoNombre + recargoBolsita
  const total = subtotal + recargos

  function manejarArchivo(e) {
    const archivo = e.target.files?.[0] || null
    setError('')
    setImagenArchivo(null)
    if (!archivo) return
    if (archivo.size > 5 * 1024 * 1024) {
      setError('La imagen supera el máximo de 5 MB.')
      return
    }
    setImagenArchivo(archivo)
  }

  function agregarAlCarrito() {
    const v = variante || ordenadas[0]
    if (!v) {
      setError('Este producto no está disponible en este momento.')
      return
    }
    onAgregar({
      producto: v,
      variante: null,
      cantidad: cantidadNumero,
      nombreActivo,
      nombre,
      detalleActivo,
      detalle,
      bolsitaActivo,
      imagenActivo,
      imagenArchivo,
      respuestas: []
    })
    setAgregado(true)
    setError('')
  }

  return (
    <div className="ficha-producto">
      <nav className="ficha-breadcrumb">
        <button className="ficha-crumb" onClick={volver} type="button">
          ← Volver al catálogo
        </button>
        <span className="ficha-crumb-sep">/</span>
        <span className="ficha-crumb-actual">
          {categoria?.nombre || 'Producto'}
        </span>
      </nav>

      <div className="ficha-layout">
        <div className="ficha-galeria">
          {producto.imagen_principal ? (
            <div className="ficha-imagen-principal">
              <img src={producto.imagen_principal} alt={titulo} />
            </div>
          ) : (
            <div className="ficha-imagen-vacia">Sin imagen</div>
          )}

          {ordenadas.length > 1 && (
            <div className="ficha-opciones">
              <h3>Opciones</h3>
              <div className="ficha-opciones-grid">
                {ordenadas.map((v) => {
                  const activo = variante?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={
                        activo ? 'ficha-opcion activa' : 'ficha-opcion'
                      }
                      onClick={() => {
                        setVariante(v)
                        setAgregado(false)
                        setError('')
                      }}
                      title={v.nombre}
                    >
                      {v.imagen_principal ? (
                        <img src={v.imagen_principal} alt={v.nombre} />
                      ) : (
                        <span className="ficha-opcion-nombre">
                          {extraerColor(v.nombre)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="ficha-info">
          <span className="ficha-categoria">
            {categoria?.nombre || 'Producto'}
          </span>
          <h1 className="ficha-titulo">{titulo}</h1>

          {variante?.nombre && variante.nombre !== titulo && (
            <p className="ficha-variante-seleccion">
              {variante.nombre}
            </p>
          )}

          {producto.codigo_interno && (
            <p className="ficha-sku">
              SKU: <strong>{producto.codigo_interno}</strong>
            </p>
          )}

          <div className="ficha-precio">
            {precio !== null ? (
              <>
                <small>
                  Precio {tipo === 'mayorista' ? 'mayorista' : 'público'}
                </small>
                <strong>$ {formatearPrecioFicha(precio)}</strong>
                {precioMinorista !== null && precioMinorista !== precio && (
                  <span className="ficha-precio-referencia">
                    Minorista: $ {formatearPrecioFicha(precioMinorista)}
                  </span>
                )}
              </>
            ) : (
              <strong>Consultar precio</strong>
            )}
          </div>

          {producto.descripcion && (
            <p className="ficha-descripcion">{producto.descripcion}</p>
          )}

          {producto.permite_personalizacion !== false && (
            <div className="ficha-destacado">
              <strong>✓ Personalizable con tu diseño</strong>
              <p>
                Podés estamparle tu nombre, texto, foto o el diseño que
                quieras. Subí tu referencia y coordinamos todo por
                WhatsApp.
              </p>
            </div>
          )}

          <label className="ficha-campo">
            <span>Cantidad</span>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>

          <div className="ficha-config">
            <div className="ficha-opcion-cfg">
              <label className="ficha-check">
                <input
                  type="checkbox"
                  checked={nombreActivo}
                  onChange={(e) => setNombreActivo(e.target.checked)}
                />
                <strong>Nombre o texto (+{RECARGO_NOMBRE_TEXTO}%)</strong>
              </label>
              {nombreActivo && (
                <input
                  type="text"
                  className="ficha-input"
                  placeholder="Ej: Sofía, Feliz cumpleaños, etc."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              )}
            </div>

            <div className="ficha-opcion-cfg">
              <label className="ficha-check">
                <input
                  type="checkbox"
                  checked={detalleActivo}
                  onChange={(e) => setDetalleActivo(e.target.checked)}
                />
                <strong>Detalle del diseño</strong>
              </label>
              {detalleActivo && (
                <textarea
                  className="ficha-input"
                  rows="3"
                  placeholder="Explicá cómo querés el diseño, colores, ubicación, etc."
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                />
              )}
            </div>

            <div className="ficha-opcion-cfg">
              <label className="ficha-check">
                <input
                  type="checkbox"
                  checked={bolsitaActivo}
                  onChange={(e) => setBolsitaActivo(e.target.checked)}
                />
                <strong>Bolsita de regalo (+${RECARGO_BOLSITA})</strong>
              </label>
            </div>

            <div className="ficha-opcion-cfg">
              <label className="ficha-check">
                <input
                  type="checkbox"
                  checked={imagenActivo}
                  onChange={(e) => {
                    setImagenActivo(e.target.checked)
                    if (!e.target.checked) setImagenArchivo(null)
                  }}
                />
                <strong>Adjuntar foto o imagen de referencia</strong>
              </label>
              {imagenActivo && (
                <label className="ficha-archivo">
                  <input type="file" accept="image/*" onChange={manejarArchivo} />
                  <span>{imagenArchivo ? imagenArchivo.name : 'Elegir archivo'}</span>
                </label>
              )}
            </div>
          </div>

          <div className="ficha-resumen">
            <div>
              <span>Subtotal</span>
              <strong>$ {formatearPrecioFicha(subtotal)}</strong>
            </div>
            <div>
              <span>Personalización</span>
              <strong>$ {formatearPrecioFicha(recargos)}</strong>
            </div>
            <div className="ficha-resumen-total">
              <span>Total</span>
              <strong>$ {formatearPrecioFicha(total)}</strong>
            </div>
          </div>

          {error && <div className="ficha-error">{error}</div>}

          <button
            className="ficha-comprar"
            type="button"
            onClick={agregarAlCarrito}
          >
            {agregado
              ? '✓ Agregado al carrito'
              : 'Agregar al carrito'}
          </button>
        </div>
      </div>

      <section className="ficha-como-funciona">
        <h2>¿Cómo encargamos tu personalizado?</h2>
        <div className="ficha-pasos">
          <div className="ficha-paso">
            <span className="ficha-paso-num">1</span>
            <p>
              Elegís el producto y el color que más te guste.
            </p>
          </div>
          <div className="ficha-paso">
            <span className="ficha-paso-num">2</span>
            <p>
              Agregás tu diseño, nombre o texto y lo cargás al carrito.
            </p>
          </div>
          <div className="ficha-paso">
            <span className="ficha-paso-num">3</span>
            <p>
              Confirmás tu pedido y coordinamos el envío o retiro por
              WhatsApp.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
