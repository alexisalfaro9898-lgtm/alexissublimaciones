import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Coins,
  Boxes,
  Truck,
  ShoppingCart,
  Users,
  Tag,
  Lightbulb,
  AlertTriangle,
  Download,
  Plus,
  X,
  RefreshCw,
  CheckCircle2,
  Percent
} from 'lucide-react'
import GraficoEvolucion from './DashboardGraficos'
import {
  PERIODOS,
  cargarEstadosPedido,
  cargarResumen,
  cargarEvolucion,
  cargarTop,
  cargarStock,
  cargarUmbrales,
  cargarProveedores,
  cargarHistorialCostos,
  cargarCompras,
  cargarObjetivos,
  guardarObjetivos,
  exportarCSV,
  formatearDinero,
  formatearFecha,
  variacionPorcentual
} from '../lib/dashboard'
import { supabase } from '../lib/supabase'


/* ============================================================
   DASHBOARD DE INTELIGENCIA COMERCIAL (solo rol Administrador)
   ============================================================

   Recomendaciones: se generan SOLO a partir de datos reales.
   - Sin stock + demanda        -> Reponer            (Alta)
   - Costo subió (historial)    -> Pérdida de margen  (Alta)
   - Margen < objetivo + ventas -> Revisar precio     (Media)
   - Mucha venta, poca ganancia -> Revisar precio/prov(Media)
   - Stock bajo + demanda       -> Reponer            (Media)
   - Stock alto + sin ventas    -> Inmovilizado       (Media)
   - Ventas sin costo cargado   -> Costo pendiente    (Media)
   - Margen alto + poca venta   -> Promocionar        (Oportunidad)
   - Proveedor más barato       -> Ahorro potencial   (Oportunidad)

   Puntuación (0-100), documentada:
   - Alta: 100 | Media: 70 | Oportunidad: 40
   - +20 si el producto está en el top 10 por facturación
   - -20 si falta el costo para cuantificar el impacto
   ============================================================ */

const PESTANAS = [
  { id: 'resumen', nombre: 'Resumen', icono: LayoutDashboard },
  { id: 'ventas', nombre: 'Ventas', icono: TrendingUp },
  { id: 'productos', nombre: 'Productos', icono: Package },
  { id: 'rentabilidad', nombre: 'Rentabilidad', icono: Coins },
  { id: 'stock', nombre: 'Stock', icono: Boxes },
  { id: 'proveedores', nombre: 'Proveedores', icono: Truck },
  { id: 'compras', nombre: 'Compras', icono: ShoppingCart },
  { id: 'clientes', nombre: 'Clientes', icono: Users },
  { id: 'categorias', nombre: 'Categorías', icono: Tag },
  { id: 'oportunidades', nombre: 'Oportunidades', icono: Lightbulb }
]


const num = (v) => Number(v ?? 0)


function TarjetaKpi({ titulo, valor, variacion, icono, color, textoVariacion }) {
  const positiva = (variacion ?? 0) >= 0
  return (
    <div className="kpi-tarjeta">
      <div className={'kpi-icono ' + color}>
        {icono}
      </div>
      <div className="kpi-contenido">
        <span className="kpi-titulo">{titulo}</span>
        <strong className="kpi-valor">{valor}</strong>
        {variacion !== null && variacion !== undefined && (
          <span
            className={
              'kpi-variacion ' +
              (positiva ? 'positiva' : 'negativa')
            }
            title={textoVariacion || 'vs período anterior'}
          >
            {positiva ? '↑' : '↓'}{' '}
            {Math.abs(variacion).toFixed(1)}% vs anterior
          </span>
        )}
      </div>
    </div>
  )
}


function OrdenarColumna({ activo, direccion, onClick, children }) {
  return (
    <button
      type="button"
      className={'orden-columna' + (activo ? ' activo' : '')}
      onClick={onClick}
    >
      {children}
      {activo && (
        <span className="orden-flecha">
          {direccion === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  )
}


function TablaRanking({ filas, columnas, orden, setOrden }) {
  return (
    <div className="dashboard-tabla">
      <table>
        <thead>
          <tr>
            {columnas.map((col) => (
              <th key={col.clave}>
                {col.ordenable ? (
                  <OrdenarColumna
                    activo={orden?.clave === col.clave}
                    direccion={orden?.direccion}
                    onClick={() => {
                      if (!setOrden) return
                      if (orden?.clave === col.clave) {
                        setOrden({
                          clave: col.clave,
                          direccion:
                            orden.direccion === 'asc' ? 'desc' : 'asc'
                        })
                      } else {
                        setOrden({ clave: col.clave, direccion: 'desc' })
                      }
                    }}
                  >
                    {col.nombre}
                  </OrdenarColumna>
                ) : (
                  col.nombre
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={fila._clave ?? i}>
              {columnas.map((col) => (
                <td key={col.clave}>
                  {col.render
                    ? col.render(fila[col.clave], fila)
                    : fila[col.clave] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


const PuntajeOportunidad = ({ item }) => (
  <span className="puntaje-oportunidad">
    {item.puntaje}
  </span>
)


function ResumenSeccion({
  resumen,
  resumenMes,
  objetivos,
  cargando
}) {

  const comparar = (campo) =>
    resumen
      ? variacionPorcentual(
          num(resumen[campo]),
          num(resumen.comparacion[campo])
        )
      : null

  const margenMostrado =
    resumen?.margen === null || resumen?.margen === undefined
      ? '—'
      : resumen.margen.toFixed(1) + '%'

  const cobertura =
    resumen?.coberturaCosto === null ||
    resumen?.coberturaCosto === undefined
      ? null
      : resumen.coberturaCosto

  const progreso = (actual, objetivo) =>
    objetivo > 0 ? Math.min(100, (actual / objetivo) * 100) : 0

  return (
    <>
      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Calculando métricas...
        </div>
      ) : (
        <>
          <section className="kpi-grilla">
            <TarjetaKpi
              titulo="Ventas"
              valor={formatearDinero(resumen?.facturacion)}
              variacion={comparar('facturacion')}
              icono={<TrendingUp size={20} />}
              color="azul"
            />
            <TarjetaKpi
              titulo="Ganancia"
              valor={formatearDinero(resumen?.ganancia)}
              variacion={comparar('ganancia')}
              icono={<Coins size={20} />}
              color="verde"
            />
            <TarjetaKpi
              titulo="Margen"
              valor={margenMostrado}
              variacion={null}
              icono={<Percent size={20} />}
              color="violeta"
            />
            <TarjetaKpi
              titulo="Pedidos"
              valor={resumen?.pedidos ?? '—'}
              variacion={comparar('pedidos')}
              icono={<ShoppingCart size={20} />}
              color="naranja"
            />
            <TarjetaKpi
              titulo="Unidades vendidas"
              valor={resumen?.unidades ?? '—'}
              variacion={comparar('unidades')}
              icono={<Package size={20} />}
              color="celeste"
            />
            <TarjetaKpi
              titulo="Ticket promedio"
              valor={formatearDinero(resumen?.ticket)}
              variacion={null}
              icono={<LayoutDashboard size={20} />}
              color="rosa"
            />
            <TarjetaKpi
              titulo="Costos"
              valor={formatearDinero(resumen?.costo)}
              variacion={null}
              icono={<Boxes size={20} />}
              color="gris"
            />
          </section>

          {resumen && (
            <div className="estado-pedidos-chips">
              <span className="chip-pedidos pendiente">
                {resumen.pendientes.pedidos} pedidos pendientes
                ({formatearDinero(resumen.pendientes.facturacion)})
              </span>
              <span className="chip-pedidos cancelado">
                {resumen.cancelados} cancelados (no contabilizados)
              </span>
            </div>
          )}

          {cobertura !== null && cobertura < 100 && (
            <div className="aviso-costo">
              <AlertTriangle size={18} />
              <span>
                {cobertura.toFixed(0)}% de las ventas tienen rentabilidad
                calculable. El{' '}
                {(100 - cobertura).toFixed(0)}% restante
                ({formatearDinero(resumen.facturacionSinCosto)}) requiere
                cargar costo para calcular ganancia.
              </span>
            </div>
          )}

          {objetivos && (
            <section className="panel-objetivos">
              <h3>
                Objetivos del mes
                <small>Definidos en Configuración del dashboard</small>
              </h3>
              <div className="objetivos-grilla">
                <div className="objetivo">
                  <span>Ventas</span>
                  <strong>
                    {formatearDinero(resumenMes?.facturacion)}
                    {' / '}
                    {formatearDinero(objetivos.facturacion)}
                  </strong>
                  <div className="barra-progreso">
                    <div
                      style={{
                        width:
                          progreso(
                            num(resumenMes?.facturacion),
                            objetivos.facturacion
                          ) + '%'
                      }}
                    />
                  </div>
                  <small>
                    {progreso(
                      num(resumenMes?.facturacion),
                      objetivos.facturacion
                    ).toFixed(0)}
                    %
                  </small>
                </div>
                <div className="objetivo">
                  <span>Ganancia</span>
                  <strong>
                    {formatearDinero(resumenMes?.ganancia)}
                    {' / '}
                    {formatearDinero(objetivos.ganancia)}
                  </strong>
                  <div className="barra-progreso">
                    <div
                      style={{
                        width:
                          progreso(
                            num(resumenMes?.ganancia),
                            objetivos.ganancia
                          ) + '%'
                      }}
                    />
                  </div>
                  <small>
                    {progreso(
                      num(resumenMes?.ganancia),
                      objetivos.ganancia
                    ).toFixed(0)}
                    %
                  </small>
                </div>
                <div className="objetivo">
                  <span>Pedidos</span>
                  <strong>
                    {num(resumenMes?.pedidos)} / {objetivos.pedidos}
                  </strong>
                  <div className="barra-progreso">
                    <div
                      style={{
                        width:
                          progreso(
                            num(resumenMes?.pedidos),
                            objetivos.pedidos
                          ) + '%'
                      }}
                    />
                  </div>
                  <small>
                    {progreso(
                      num(resumenMes?.pedidos),
                      objetivos.pedidos
                    ).toFixed(0)}
                    %
                  </small>
                </div>
                <div className="objetivo">
                  <span>Margen mínimo</span>
                  <strong>
                    {resumenMes?.margen === null ||
                    resumenMes?.margen === undefined
                      ? '—'
                      : resumenMes.margen.toFixed(1) + '%'}
                    {' / '}
                    {objetivos.margen}%
                  </strong>
                  <div className="barra-progreso">
                    <div
                      style={{
                        width:
                          (resumenMes?.margen ?? 0) >= objetivos.margen
                            ? 100
                            : Math.max(
                                0,
                                ((resumenMes?.margen ?? 0) /
                                  objetivos.margen) *
                                  100
                              ) + '%'
                      }}
                    />
                  </div>
                  <small>
                    {resumenMes?.margen === null ||
                    resumenMes?.margen === undefined
                      ? 'sin datos'
                      : resumenMes.margen >= objetivos.margen
                        ? '✓ objetivo cumplido'
                        : 'bajo objetivo'}
                  </small>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}


function VentasSeccion({
  evolucion,
  agrupacion,
  setAgrupacion,
  cargando
}) {
  return (
    <>
      <div className="panel-dashboard">
        <div className="panel-dashboard-header">
          <div>
            <h3>Evolución</h3>
            <p>
              Facturación (barras) y ganancia (línea) por{' '}
              {agrupacion === 'dia'
                ? 'día'
                : agrupacion === 'semana'
                  ? 'semana'
                  : 'mes'}
            </p>
          </div>
          <div className="agrupacion-toggle">
            {['dia', 'semana', 'mes'].map((a) => (
              <button
                key={a}
                type="button"
                className={agrupacion === a ? 'activa' : ''}
                onClick={() => setAgrupacion(a)}
              >
                {a === 'dia' ? 'Diario' : a === 'semana' ? 'Semanal' : 'Mensual'}
              </button>
            ))}
          </div>
        </div>

        {cargando ? (
          <div className="cargando-dashboard">
            <RefreshCw size={24} className="girando" />
            Cargando...
          </div>
        ) : (
          <GraficoEvolucion puntos={evolucion} />
        )}
      </div>

      <div className="panel-dashboard">
        <div className="panel-dashboard-header">
          <div>
            <h3>Detalle del período</h3>
            <p>Ventas, costos, ganancia y pedidos por período.</p>
          </div>
          <button
            type="button"
            className="boton-exportar"
            onClick={() =>
              exportarCSV('evolucion-ventas.csv', evolucion)
            }
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>

        {evolucion.length === 0 ? (
          <div className="sin-datos">
            No hay datos suficientes en el período seleccionado.
          </div>
        ) : (
          <div className="dashboard-tabla">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Ventas</th>
                  <th>Costos</th>
                  <th>Ganancia</th>
                  <th>Margen</th>
                  <th>Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {evolucion.map((p, i) => (
                  <tr key={i}>
                    <td>{formatearFecha(p.fecha)}</td>
                    <td>{formatearDinero(p.facturacion)}</td>
                    <td>{formatearDinero(p.costo)}</td>
                    <td>{formatearDinero(p.ganancia)}</td>
                    <td>
                      {p.facturacion > 0
                        ? (
                            (p.ganancia / p.facturacion) *
                            100
                          ).toFixed(1) + '%'
                        : '—'}
                    </td>
                    <td>{p.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}


function ProductosSeccion({
  topProductos,
  ordenProductos,
  setOrdenProductos,
  cargando
}) {

  const filas = useMemo(() => {
    const lista = [...(topProductos || [])]
    const clave = ordenProductos?.clave
    if (!clave) return lista.map((r, i) => ({ ...r, _clave: r.producto_id ?? i }))

    const dir = ordenProductos.direccion === 'asc' ? 1 : -1
    lista.sort((a, b) => {
      const va = a[clave] === null || a[clave] === undefined ? -Infinity : num(a[clave])
      const vb = b[clave] === null || b[clave] === undefined ? -Infinity : num(b[clave])
      return (va - vb) * dir
    })
    return lista.map((r, i) => ({ ...r, _clave: r.producto_id ?? i }))
  }, [topProductos, ordenProductos])

  const columnas = [
    {
      clave: 'nombre',
      nombre: 'Producto',
      render: (v, f) => (
        <div className="celda-producto-nombre">
          <strong>{f.nombre || 'Producto sin nombre'}</strong>
          {f.items_sin_costo > 0 && (
            <span className="marca-sin-costo" title="Líneas vendidas sin costo cargado">
              ⚠️ costo pendiente
            </span>
          )}
        </div>
      )
    },
    {
      clave: 'unidades',
      nombre: 'Unidades',
      ordenable: true,
      render: (v) => num(v)
    },
    {
      clave: 'facturacion',
      nombre: 'Ventas',
      ordenable: true,
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'costo',
      nombre: 'Costo',
      ordenable: true,
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'ganancia',
      nombre: 'Ganancia',
      ordenable: true,
      render: (v) =>
        v === null || v === undefined ? (
          <span className="sin-costo-texto">—</span>
        ) : (
          formatearDinero(v)
        )
    },
    {
      clave: 'margen',
      nombre: 'Margen',
      ordenable: true,
      render: (v) =>
        v === null || v === undefined ? '—' : v.toFixed(1) + '%'
    }
  ]

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-header">
        <div>
          <h3>Productos más vendidos</h3>
          <p>
            Ranking con unidades, facturación, costo, ganancia y margen.
            Ordená por cualquier columna.
          </p>
        </div>
        <button
          type="button"
          className="boton-exportar"
          onClick={() =>
            exportarCSV(
              'productos-ventas.csv',
              filas.map((f) => ({
                producto: f.nombre,
                unidades: f.unidades,
                ventas: f.facturacion,
                costo: f.costo,
                ganancia: f.ganancia ?? '',
                margen: f.margen ?? ''
              }))
            )
          }
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Cargando...
        </div>
      ) : filas.length === 0 ? (
        <div className="sin-datos">
          No hay datos suficientes en el período seleccionado.
        </div>
      ) : (
        <TablaRanking
          filas={filas}
          columnas={columnas}
          orden={ordenProductos}
          setOrden={setOrdenProductos}
        />
      )}
    </div>
  )
}


function RentabilidadSeccion({
  topProductos,
  resumen,
  cargando
}) {

  const conCosto = (topProductos || []).filter((p) => p.margen !== null)
  const sinCosto = (topProductos || []).filter((p) => p.margen === null)

  const columnas = [
    {
      clave: 'nombre',
      nombre: 'Producto',
      render: (v, f) => (
        <strong>{f.nombre || 'Producto sin nombre'}</strong>
      )
    },
    {
      clave: 'unidades',
      nombre: 'Unidades',
      render: (v) => num(v)
    },
    {
      clave: 'facturacion',
      nombre: 'Ventas',
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'costo',
      nombre: 'Costo',
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'ganancia',
      nombre: 'Ganancia',
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'margen',
      nombre: 'Margen %',
      render: (v) => (v === null ? '—' : v.toFixed(1) + '%')
    },
    {
      clave: 'ganancia_unitaria',
      nombre: 'Ganancia/unidad',
      render: (v, f) =>
        f.margen === null
          ? '—'
          : formatearDinero(
              f.facturacion / Math.max(1, num(f.unidades)) -
                f.costo / Math.max(1, num(f.unidades))
            )
    }
  ]

  return (
    <>
      <div className="panel-dashboard">
        <div className="panel-dashboard-header">
          <div>
            <h3>Rentabilidad por producto</h3>
            <p>
              Ordenado por ganancia total. El más vendido no siempre es el
              más rentable: acá se ve cuál aporta más dinero.
            </p>
          </div>
          <button
            type="button"
            className="boton-exportar"
            onClick={() =>
              exportarCSV(
                'rentabilidad-productos.csv',
                conCosto.map((f) => ({
                  producto: f.nombre,
                  unidades: f.unidades,
                  ventas: f.facturacion,
                  costo: f.costo,
                  ganancia: f.ganancia,
                  margen: f.margen
                }))
              )
            }
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>

        {cargando ? (
          <div className="cargando-dashboard">
            <RefreshCw size={24} className="girando" />
            Cargando...
          </div>
        ) : conCosto.length === 0 ? (
          <div className="sin-datos">
            No hay datos suficientes (se necesitan ventas con costo cargado).
          </div>
        ) : (
          <TablaRanking filas={conCosto} columnas={columnas} />
        )}
      </div>

      {resumen && num(resumen.facturacionSinCosto) > 0 && (
        <div className="panel-dashboard">
          <h3>⚠️ Costo pendiente</h3>
          <p>
            {formatearDinero(resumen.facturacionSinCosto)} de las ventas
            del período no pueden calcular ganancia porque las líneas no
            tienen costo cargado (se captura automáticamente al crear
            pedidos nuevos). No se asume costo 0 ni ganancia falsa.
          </p>
          {sinCosto.length > 0 && (
            <div className="lista-sin-costo">
              {sinCosto.slice(0, 10).map((p, i) => (
                <span key={i}>
                  {p.nombre}: {formatearDinero(p.facturacion)} sin costo
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}


function StockSeccion({
  stock,
  umbrales,
  topProductos,
  cargando
}) {

  const analisis = useMemo(() => {
    if (!stock) return null

    const vendidos = new Map(
      (topProductos || []).map((p) => [p.producto_id, num(p.unidades)])
    )

    const sinStock = stock.filter(
      (p) => p.activo && (num(p.stock) <= 0 || p.stock === null)
    )
    const conStock = stock.filter((p) => p.activo && num(p.stock) > 0)
    const stockBajo = stock.filter(
      (p) =>
        p.activo &&
        num(p.stock) > 0 &&
        num(p.stock) <= umbrales.stockBajo
    )
    const inmovilizado = stock
      .filter(
        (p) =>
          p.activo &&
          num(p.stock) >= umbrales.stockInmovilizado &&
          !(vendidos.get(p.id) > 0)
      )
      .map((p) => ({
        ...p,
        valorStock:
          p.precio_costo !== null && p.precio_costo !== undefined
            ? num(p.stock) * num(p.precio_costo)
            : null
      }))
      .sort((a, b) => num(b.valorStock) - num(a.valorStock))

    const rotacion = (productoId) => {
      const unidades = vendidos.get(productoId) || 0
      if (unidades === 0) return 'sin ventas'
      const todos = [...vendidos.values()].filter((u) => u > 0)
      if (todos.length === 0) return 'media'
      const ordenados = [...todos].sort((a, b) => a - b)
      const p75 = ordenados[Math.floor(ordenados.length * 0.75)]
      const p25 = ordenados[Math.floor(ordenados.length * 0.25)]
      if (unidades >= p75) return 'alta'
      if (unidades <= p25) return 'baja'
      return 'media'
    }

    const conRotacion = conStock.map((p) => ({
      ...p,
      rotacion: rotacion(p.id)
    }))

    return {
      sinStock,
      conStock,
      stockBajo,
      inmovilizado,
      conRotacion,
      alta: conRotacion.filter((p) => p.rotacion === 'alta'),
      baja: conRotacion.filter((p) => p.rotacion === 'baja')
    }
  }, [stock, umbrales, topProductos])

  if (!analisis) return null

  return (
    <>
      <section className="kpi-grilla">
        <TarjetaKpi
          titulo="Con stock"
          valor={analisis.conStock.length}
          icono={<Boxes size={20} />}
          color="verde"
        />
        <TarjetaKpi
          titulo="Sin stock"
          valor={analisis.sinStock.length}
          icono={<Package size={20} />}
          color="rojo"
        />
        <TarjetaKpi
          titulo={'Stock bajo (≤ ' + umbrales.stockBajo + ')'}
          valor={analisis.stockBajo.length}
          icono={<AlertTriangle size={20} />}
          color="naranja"
        />
        <TarjetaKpi
          titulo={'Inmovilizado (≥ ' + umbrales.stockInmovilizado + ')'}
          valor={analisis.inmovilizado.length}
          icono={<Boxes size={20} />}
          color="violeta"
        />
      </section>

      <div className="grid-dos-columnas">
        <div className="panel-dashboard">
          <h3>🔴 Reponer: sin stock y activos</h3>
          {cargando ? (
            <div className="cargando-dashboard">
              <RefreshCw size={24} className="girando" />
              Cargando...
            </div>
          ) : analisis.sinStock.length === 0 ? (
            <div className="sin-datos">
              No hay productos activos sin stock.
            </div>
          ) : (
            <div className="lista-stock">
              {analisis.sinStock.slice(0, 15).map((p) => (
                <div className="fila-stock" key={p.id}>
                  <strong>{p.nombre_comercial || p.nombre}</strong>
                  <span>
                    {vendidoEnPeriodo(p.id, topProductos)
                      ? 'Con demanda en el período'
                      : 'Sin ventas en el período'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel-dashboard">
          <h3>⚠️ Stock inmovilizado</h3>
          <p>
            Stock alto sin ventas recientes. Valor estimado con el costo
            actual (si está cargado).
          </p>
          {analisis.inmovilizado.length === 0 ? (
            <div className="sin-datos">
              No hay stock inmovilizado detectado.
            </div>
          ) : (
            <div className="lista-stock">
              {analisis.inmovilizado.slice(0, 10).map((p) => (
                <div className="fila-stock" key={p.id}>
                  <strong>{p.nombre_comercial || p.nombre}</strong>
                  <span>
                    {num(p.stock)} unidades
                    {p.valorStock !== null
                      ? ' · ' + formatearDinero(p.valorStock)
                      : ' · valor sin costo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel-dashboard">
        <h3>Rotación del período</h3>
        <p>
          Alta: dentro del 25% más vendido. Baja: dentro del 25% menos
          vendido. Sin ventas: no vendió en el período.
        </p>
        <div className="grid-dos-columnas">
          <div>
            <h4>Alta rotación</h4>
            {analisis.alta.length === 0 ? (
              <div className="sin-datos">
                No hay datos suficientes de ventas.
              </div>
            ) : (
              <div className="lista-stock">
                {analisis.alta.slice(0, 10).map((p) => (
                  <div className="fila-stock" key={p.id}>
                    <strong>{p.nombre_comercial || p.nombre}</strong>
                    <span>
                      stock {num(p.stock)} · ventas{' '}
                      {num(
                        (topProductos || []).find(
                          (t) => t.producto_id === p.id
                        )?.unidades
                      )}{' '}
                      uds
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4>Baja rotación</h4>
            {analisis.baja.length === 0 ? (
              <div className="sin-datos">
                No hay datos suficientes de ventas.
              </div>
            ) : (
              <div className="lista-stock">
                {analisis.baja.slice(0, 10).map((p) => (
                  <div className="fila-stock" key={p.id}>
                    <strong>{p.nombre_comercial || p.nombre}</strong>
                    <span>
                      stock {num(p.stock)} · ventas{' '}
                      {num(
                        (topProductos || []).find(
                          (t) => t.producto_id === p.id
                        )?.unidades
                      )}{' '}
                      uds
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function vendidoEnPeriodo(productoId, topProductos) {
  return num(
    (topProductos || []).find((t) => t.producto_id === productoId)
      ?.unidades
  ) > 0
}


function ProveedoresSeccion({
  proveedoresData,
  historialCostos,
  comprasData,
  topProductos,
  cargando
}) {

  const analisis = useMemo(() => {
    if (!proveedoresData) return null
    const { proveedores, relaciones } = proveedoresData

    const porProveedor = proveedores.map((prov) => {
      const rels = relaciones.filter((r) => r.proveedor_id === prov.id)
      const compras = (comprasData?.compras || []).filter(
        (c) => c.proveedor_id === prov.id
      )
      const totalComprado = compras.reduce((acc, c) => {
        const items = (comprasData?.items || []).filter(
          (i) => i.compra_id === c.id
        )
        return (
          acc +
          items.reduce(
            (a, i) => a + num(i.costo_total ?? num(i.costo_unitario) * num(i.cantidad)),
            0
          )
        )
      }, 0)

      return {
        ...prov,
        productos: rels.length,
        activos: rels.filter((r) => r.disponible !== false).length,
        costoPromedio:
          rels.filter((r) => r.precio_compra !== null).length > 0
            ? rels.reduce((a, r) => a + num(r.precio_compra), 0) /
              rels.filter((r) => r.precio_compra !== null).length
            : null,
        ultimaCompra:
          compras.length > 0
            ? compras
                .map((c) => c.fecha)
                .sort()
                .reverse()[0]
            : null,
        totalComprado
      }
    })

    const porProducto = new Map()
    for (const rel of relaciones) {
      if (!porProducto.has(rel.producto_id)) {
        porProducto.set(rel.producto_id, [])
      }
      porProducto.get(rel.producto_id).push(rel)
    }

    const comparacion = []
    for (const [productoId, rels] of porProducto) {
      const conPrecio = rels.filter((r) => r.precio_compra !== null)
      if (conPrecio.length < 1) continue

      const mejor = conPrecio.sort(
        (a, b) => num(a.precio_compra) - num(b.precio_compra)
      )[0]

      const unidadesPeriodo = num(
        (topProductos || []).find((t) => t.producto_id === productoId)
          ?.unidades
      )

      comparacion.push({
        productoId,
        nombre: mejor.nombre_comercial || mejor.nombre || 'Producto',
        proveedorNombre: proveedores.find((p) => p.id === mejor.proveedor_id)?.nombre,
        mejorPrecio: num(mejor.precio_compra),
        proveedoresCount: rels.length,
        unidadesPeriodo
      })
    }

    const variaciones = (historialCostos || [])
      .filter(
        (h) =>
          h.tipo_cambio === 'precio' &&
          h.precio_anterior !== null &&
          h.precio_nuevo !== null
      )
      .map((h) => ({
        ...h,
        variacion:
          num(h.precio_anterior) > 0
            ? ((num(h.precio_nuevo) - num(h.precio_anterior)) /
                num(h.precio_anterior)) *
              100
            : null
      }))

    return { porProveedor, comparacion, variaciones }
  }, [proveedoresData, historialCostos, comprasData, topProductos])

  if (!analisis) return null

  return (
    <>
      <div className="panel-dashboard">
        <div className="panel-dashboard-header">
          <div>
            <h3>Ranking de proveedores</h3>
            <p>
              Productos asociados, compras registradas, dinero gastado y
              último costo promedio.
            </p>
          </div>
          <button
            type="button"
            className="boton-exportar"
            onClick={() =>
              exportarCSV(
                'proveedores.csv',
                analisis.porProveedor.map((p) => ({
                  proveedor: p.nombre,
                  productos: p.productos,
                  activos: p.activos,
                  costoPromedio: p.costoPromedio ?? '',
                  totalComprado: p.totalComprado,
                  ultimaCompra: p.ultimaCompra || ''
                }))
              )
            }
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>

        {cargando ? (
          <div className="cargando-dashboard">
            <RefreshCw size={24} className="girando" />
            Cargando...
          </div>
        ) : (
          <div className="dashboard-tabla">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Productos asociados</th>
                  <th>Activos</th>
                  <th>Costo promedio</th>
                  <th>Dinero gastado</th>
                  <th>Última compra</th>
                </tr>
              </thead>
              <tbody>
                {analisis.porProveedor.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                    </td>
                    <td>{p.productos}</td>
                    <td>{p.activos}</td>
                    <td>
                      {p.costoPromedio !== null
                        ? formatearDinero(p.costoPromedio)
                        : '—'}
                    </td>
                    <td>{formatearDinero(p.totalComprado)}</td>
                    <td>{p.ultimaCompra ? formatearFecha(p.ultimaCompra) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-dashboard">
        <h3>Comparación por producto</h3>
        <p>
          Productos con más de un proveedor: costo más barato disponible y
          ahorro potencial por unidad.
        </p>
        {analisis.comparacion.length === 0 ? (
          <div className="sin-datos">
            No hay datos suficientes: ningún producto tiene proveedores
            relacionados con precio de compra.
          </div>
        ) : (
          <div className="dashboard-tabla">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedores</th>
                  <th>Mejor precio</th>
                  <th>Ahorro potencial</th>
                </tr>
              </thead>
              <tbody>
                {analisis.comparacion.map((c) => (
                  <tr key={c.productoId}>
                    <td>
                      <strong>{c.nombre}</strong>
                    </td>
                    <td>{c.proveedoresCount}</td>
                    <td>
                      🟢 {c.proveedorNombre}:{' '}
                      {formatearDinero(c.mejorPrecio)}
                    </td>
                    <td>
                      {c.unidadesPeriodo > 0
                        ? formatearDinero(
                            c.mejorPrecio * c.unidadesPeriodo
                          ) +
                          ' estimado sobre ' +
                          c.unidadesPeriodo +
                          ' uds vendidas'
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-dashboard">
        <h3>Evolución de costos (proveedor_historial)</h3>
        {analisis.variaciones.length === 0 ? (
          <div className="sin-datos">
            No hay datos suficientes: todavía no hay cambios de precio
            registrados por las sincronizaciones de proveedores.
          </div>
        ) : (
          <div className="dashboard-tabla">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Costo anterior</th>
                  <th>Costo nuevo</th>
                  <th>Variación</th>
                </tr>
              </thead>
              <tbody>
                {analisis.variaciones.slice(0, 30).map((h) => (
                  <tr key={h.id}>
                    <td>{formatearFecha(h.fecha_cambio)}</td>
                    <td>{h.origen}</td>
                    <td>{formatearDinero(h.precio_anterior)}</td>
                    <td>{formatearDinero(h.precio_nuevo)}</td>
                    <td
                      className={
                        num(h.variacion) > 0
                          ? 'variacion-negativa'
                          : 'variacion-positiva'
                      }
                    >
                      {h.variacion === null
                        ? '—'
                        : (h.variacion > 0 ? '+' : '') +
                          h.variacion.toFixed(1) +
                          '%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}


function ComprasSeccion({
  comprasData,
  proveedoresData,
  cargando,
  onRegistrarCompra
}) {

  const filas = useMemo(() => {
    const compras = comprasData?.compras || []
    const items = comprasData?.items || []

    return compras.map((c) => {
      const lineas = items.filter((i) => i.compra_id === c.id)
      const total = lineas.reduce(
        (acc, i) =>
          acc +
          num(i.costo_total ?? num(i.costo_unitario) * num(i.cantidad)),
        0
      )
      return {
        _clave: c.id,
        fecha: formatearFecha(c.fecha),
        proveedor:
          proveedoresData?.proveedores.find(
            (p) => p.id === c.proveedor_id
          )?.nombre || '—',
        comprobante: c.comprobante || '—',
        lineas: lineas.length,
        total: formatearDinero(total),
        observaciones: c.observaciones || ''
      }
    })
  }, [comprasData, proveedoresData])

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-header">
        <div>
          <h3>Compras a proveedores</h3>
          <p>
            Historial de compras registradas con su costo unitario.
          </p>
        </div>
        <div className="panel-acciones">
          <button
            type="button"
            className="boton-exportar"
            onClick={() =>
              exportarCSV('compras.csv', filas)
            }
          >
            <Download size={15} />
            Exportar CSV
          </button>
          <button
            type="button"
            className="boton-primario"
            onClick={onRegistrarCompra}
          >
            <Plus size={16} />
            Registrar compra
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Cargando...
        </div>
      ) : filas.length === 0 ? (
        <div className="sin-datos">
          No hay compras registradas todavía. Usá "Registrar compra" para
          cargar la primera.
        </div>
      ) : (
        <div className="dashboard-tabla">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Comprobante</th>
                <th>Líneas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f._clave}>
                  <td>{f.fecha}</td>
                  <td>
                    <strong>{f.proveedor}</strong>
                  </td>
                  <td>{f.comprobante}</td>
                  <td>{f.lineas}</td>
                  <td>{f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


function ClientesSeccion({ topClientes, cargando }) {

  const columnas = [
    {
      clave: 'cliente',
      nombre: 'Cliente',
      render: (v, f) => (
        <div className="celda-producto-nombre">
          <strong>{v || 'Sin nombre'}</strong>
          {num(f.pedidos) >= 2 && (
            <span className="marca-recurrente">recurrente</span>
          )}
        </div>
      )
    },
    {
      clave: 'pedidos',
      nombre: 'Pedidos',
      render: (v) => num(v)
    },
    {
      clave: 'facturacion',
      nombre: 'Total comprado',
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'ticket',
      nombre: 'Ticket promedio',
      render: (v, f) =>
        num(f.pedidos) > 0
          ? formatearDinero(num(f.facturacion) / num(f.pedidos))
          : '—'
    },
    {
      clave: 'ultima_compra',
      nombre: 'Última compra',
      render: (v) => formatearFecha(v)
    }
  ]

  const filas = (topClientes || []).map((c, i) => ({
    ...c,
    _clave: c.cliente + '-' + i
  }))

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-header">
        <div>
          <h3>Clientes</h3>
          <p>
            Los que más compran, con qué frecuencia y cuándo fue su última
            compra. Los recurrentes (2+ pedidos) se marcan para
            fidelización.
          </p>
        </div>
        <button
          type="button"
          className="boton-exportar"
          onClick={() =>
            exportarCSV(
              'clientes.csv',
              filas.map((f) => ({
                cliente: f.cliente,
                pedidos: f.pedidos,
                total: f.facturacion,
                ticket: num(f.pedidos) > 0 ? num(f.facturacion) / num(f.pedidos) : '',
                ultima_compra: f.ultima_compra || ''
              }))
            )
          }
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Cargando...
        </div>
      ) : filas.length === 0 ? (
        <div className="sin-datos">
          No hay datos suficientes de clientes en el período.
        </div>
      ) : (
        <TablaRanking filas={filas} columnas={columnas} />
      )}
    </div>
  )
}


function CategoriasSeccion({ topCategorias, resumen, cargando }) {

  const filas = (topCategorias || []).map((c, i) => ({
    ...c,
    _clave: c.categoria_id ?? i,
    participacion:
      resumen && num(resumen.facturacion) > 0
        ? (num(c.facturacion) / num(resumen.facturacion)) * 100
        : null
  }))

  const columnas = [
    {
      clave: 'nombre',
      nombre: 'Categoría',
      render: (v) => <strong>{v || 'Sin categoría'}</strong>
    },
    {
      clave: 'facturacion',
      nombre: 'Ventas',
      render: (v) => formatearDinero(v)
    },
    {
      clave: 'unidades',
      nombre: 'Unidades',
      render: (v) => num(v)
    },
    {
      clave: 'ganancia',
      nombre: 'Ganancia',
      render: (v) =>
        v === null || v === undefined ? '—' : formatearDinero(v)
    },
    {
      clave: 'margen',
      nombre: 'Margen',
      render: (v) => (v === null || v === undefined ? '—' : v.toFixed(1) + '%')
    },
    {
      clave: 'pedidos',
      nombre: 'Pedidos',
      render: (v) => num(v)
    },
    {
      clave: 'participacion',
      nombre: '% de ventas',
      render: (v) => (v === null ? '—' : v.toFixed(1) + '%')
    }
  ]

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-header">
        <div>
          <h3>Categorías</h3>
          <p>
            Ventas, unidades, ganancia, margen y participación sobre el
            total del período.
          </p>
        </div>
        <button
          type="button"
          className="boton-exportar"
          onClick={() =>
            exportarCSV('categorias.csv', filas)
          }
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Cargando...
        </div>
      ) : filas.length === 0 ? (
        <div className="sin-datos">
          No hay datos suficientes en el período seleccionado.
        </div>
      ) : (
        <TablaRanking filas={filas} columnas={columnas} />
      )}
    </div>
  )
}


function OportunidadesSeccion({
  oportunidades,
  cargando
}) {

  const porPrioridad = {
    alta: oportunidades.filter((o) => o.prioridad === 'alta'),
    media: oportunidades.filter((o) => o.prioridad === 'media'),
    oportunidad: oportunidades.filter((o) => o.prioridad === 'oportunidad')
  }

  const etiqueta = {
    alta: ['🔴', 'Alta'],
    media: ['🟠', 'Media'],
    oportunidad: ['🟢', 'Oportunidad']
  }

  return (
    <div className="panel-dashboard">
      <div className="panel-dashboard-header">
        <div>
          <h3>💡 Oportunidades para aumentar ganancias</h3>
          <p>
            Generadas solo a partir de datos reales. Puntuación: Alta=100,
            Media=70, Oportunidad=40, +20 si el producto está en el top 10
            por facturación, −20 si falta el costo para cuantificar.
          </p>
        </div>
        <button
          type="button"
          className="boton-exportar"
          onClick={() =>
            exportarCSV(
              'oportunidades.csv',
              oportunidades.map((o) => ({
                prioridad: o.prioridad,
                titulo: o.titulo,
                detalle: o.detalle,
                puntaje: o.puntaje
              }))
            )
          }
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {cargando ? (
        <div className="cargando-dashboard">
          <RefreshCw size={24} className="girando" />
          Calculando oportunidades...
        </div>
      ) : oportunidades.length === 0 ? (
        <div className="sin-datos">
          No hay oportunidades detectadas con los datos actuales. Cuando
          existan ventas, costos y proveedores, aparecerán acá las
          recomendaciones basadas en datos reales.
        </div>
      ) : (
        <>
          {['alta', 'media', 'oportunidad'].map((nivel) =>
            porPrioridad[nivel].length > 0 ? (
              <div key={nivel} className="lista-oportunidades">
                <h4>
                  {etiqueta[nivel][0]} Prioridad {etiqueta[nivel][1]}
                </h4>
                {porPrioridad[nivel].map((o, i) => (
                  <div
                    className={
                      'oportunidad-item prioridad-' + nivel
                    }
                    key={nivel + '-' + i}
                  >
                    <div className="oportunidad-icono">
                      {o.icono}
                    </div>
                    <div className="oportunidad-cuerpo">
                      <strong>{o.titulo}</strong>
                      <p>{o.detalle}</p>
                      {o.datos && (
                        <div className="oportunidad-datos">
                          {o.datos.map((d, j) => (
                            <span key={j}>{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <PuntajeOportunidad item={o} />
                  </div>
                ))}
              </div>
            ) : null
          )}
        </>
      )}
    </div>
  )
}


/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function DashboardAdmin() {

  const [pestana, setPestana] = useState('resumen')
  const [periodo, setPeriodo] = useState('30d')
  const [desdePersonalizado, setDesdePersonalizado] = useState('')
  const [hastaPersonalizado, setHastaPersonalizado] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [agrupacion, setAgrupacion] = useState('dia')

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [estados, setEstados] = useState([])

  const [resumen, setResumen] = useState(null)
  const [resumenMes, setResumenMes] = useState(null)
  const [evolucion, setEvolucion] = useState([])
  const [topProductos, setTopProductos] = useState([])
  const [topCategorias, setTopCategorias] = useState([])
  const [topClientes, setTopClientes] = useState([])

  const [stock, setStock] = useState([])
  const [umbrales, setUmbrales] = useState({
    stockBajo: 5,
    stockInmovilizado: 20,
    margenObjetivo: 30
  })
  const [proveedoresData, setProveedoresData] = useState(null)
  const [historialCostos, setHistorialCostos] = useState([])
  const [comprasData, setComprasData] = useState(null)
  const [objetivos, setObjetivos] = useState(null)

  const [cargandoVentas, setCargandoVentas] = useState(true)
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [error, setError] = useState('')

  const [ordenProductos, setOrdenProductos] = useState(null)
  const [mostrarCompra, setMostrarCompra] = useState(false)
  const [mostrarObjetivos, setMostrarObjetivos] = useState(false)

  const filtros = useMemo(
    () => ({
      periodo,
      desdePersonalizado,
      hastaPersonalizado,
      categoriaId: filtroCategoria ? Number(filtroCategoria) : null,
      productoId: filtroProducto ? Number(filtroProducto) : null,
      cliente: filtroCliente || null,
      estado: filtroEstado || null
    }),
    [
      periodo,
      desdePersonalizado,
      hastaPersonalizado,
      filtroCategoria,
      filtroProducto,
      filtroCliente,
      filtroEstado
    ]
  )

  useEffect(() => {
    let activo = true

    async function cargarCatalogo() {
      try {
        const [cats, prods, ests, umb, provs, comps, obj] =
          await Promise.all([
            supabase
              .from('categorias')
              .select('id, nombre')
              .order('nombre')
              .then((r) => r.data || []),
            supabase
              .from('productos')
              .select('id, nombre, nombre_comercial')
              .order('nombre')
              .then((r) => r.data || []),
            cargarEstadosPedido(),
            cargarUmbrales(),
            cargarProveedores(),
            cargarCompras(),
            cargarObjetivos()
          ])

        if (!activo) return

        setCategorias(cats)
        setProductos(prods)
        setEstados(ests)
        setUmbrales(umb)
        setProveedoresData(provs)
        setComprasData(comps)
        setObjetivos(obj)
        setHistorialCostos(await cargarHistorialCostos())
        setStock(await cargarStock())
      } catch (e) {
        if (activo) {
          console.error('Error cargando catálogo del dashboard:', e)
          setError('No se pudieron cargar los datos del catálogo.')
        }
      } finally {
        if (activo) setCargandoCatalogo(false)
      }
    }

    cargarCatalogo()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true

    async function cargarVentas() {
      setCargandoVentas(true)
      setError('')
      try {
        const [res, evol, topP, topC, topCli, mes] = await Promise.all([
          cargarResumen(filtros),
          cargarEvolucion(filtros, agrupacion),
          cargarTop('productos', filtros, 60),
          cargarTop('categorias', filtros, 30),
          cargarTop('clientes', filtros, 50),
          cargarResumen({ periodo: 'mes' })
        ])

        if (!activo) return

        setResumen(res)
        setResumenMes(mes)
        setEvolucion(evol)
        setTopProductos(topP)
        setTopCategorias(topC)
        setTopClientes(topCli)
      } catch (e) {
        if (activo) {
          console.error('Error cargando ventas del dashboard:', e)
          setError('No se pudieron cargar las métricas de ventas.')
        }
      } finally {
        if (activo) setCargandoVentas(false)
      }
    }

    cargarVentas()
    return () => {
      activo = false
    }
  }, [filtros, agrupacion])

  /* ============================================================
     OPORTUNIDADES Y ALERTAS (datos reales)
     ============================================================ */

  const oportunidades = useMemo(() => {
    const lista = []

    if (!topProductos || topProductos.length === 0) {
      return lista
    }

    const top10Ids = new Set(
      topProductos
        .slice(0, 10)
        .map((p) => p.producto_id)
    )

    const totalUnidades = topProductos.reduce(
      (acc, p) => acc + num(p.unidades),
      0
    )
    const totalGanancia = topProductos.reduce(
      (acc, p) => acc + num(p.ganancia),
      0
    )

    const stockPorId = new Map(stock.map((s) => [s.id, s]))

    const puntuar = (base, productoId, conCosto) => {
      let puntaje = base
      if (top10Ids.has(productoId)) puntaje += 20
      if (!conCosto) puntaje -= 20
      return Math.max(0, Math.min(100, puntaje))
    }

    for (const p of topProductos) {
      const st = stockPorId.get(p.producto_id)
      const stockActual = st ? num(st.stock) : null
      const unidades = num(p.unidades)
      const nombre = p.nombre || 'Producto sin nombre'
      const margen = p.margen
      const participacionUnidades =
        totalUnidades > 0 ? (unidades / totalUnidades) * 100 : 0
      const participacionGanancia =
        totalGanancia > 0 ? (num(p.ganancia) / totalGanancia) * 100 : 0

      if (
        stockActual !== null &&
        stockActual <= 0 &&
        unidades > 0
      ) {
        lista.push({
          prioridad: 'alta',
          puntaje: puntuar(100, p.producto_id, margen !== null),
          icono: <AlertTriangle size={18} />,
          titulo: `Reponer: "${nombre}" se quedó sin stock y tiene demanda`,
          detalle: `Vendió ${unidades} unidades en el período y hoy tiene ${stockActual} de stock.`,
          datos: [
            `${participacionUnidades.toFixed(1)}% de las unidades vendidas`,
            'Prioridad: reponer lo antes posible'
          ]
        })
      }

      if (
        stockActual !== null &&
        stockActual > 0 &&
        stockActual <= umbrales.stockBajo &&
        unidades > 0
      ) {
        const consumoDiario = unidades / 30
        const diasStock = consumoDiario > 0 ? stockActual / consumoDiario : null
        lista.push({
          prioridad: 'media',
          puntaje: puntuar(70, p.producto_id, margen !== null),
          icono: <Package size={18} />,
          titulo: `Reponer: "${nombre}" tiene stock bajo con demanda`,
          detalle:
            `Stock actual: ${stockActual} unidades. Vendió ${unidades} en el período.` +
            (diasStock !== null
              ? ` Días de stock estimados: ${Math.round(diasStock)}.`
              : ''),
          datos: [
            `Cantidad sugerida: ~${Math.ceil(consumoDiario * 30)} unidades (consumo estimado mensual)`
          ]
        })
      }

      if (
        margen !== null &&
        margen < umbrales.margenObjetivo &&
        unidades > 0
      ) {
        lista.push({
          prioridad: 'media',
          puntaje: puntuar(70, p.producto_id, true),
          icono: <Percent size={18} />,
          titulo: `Margen bajo: "${nombre}" tiene margen del ${margen.toFixed(1)}%`,
          detalle:
            `El margen está por debajo del objetivo de ${umbrales.margenObjetivo}%. Causas posibles según los datos: precio demasiado bajo o costo demasiado alto (costo unitario actual vs precio de venta).`,
          datos: [
            `Vendió ${unidades} unidades (${participacionUnidades.toFixed(1)}% del total)`,
            'Considerar revisar precio o cambiar de proveedor'
          ]
        })
      }

      if (
        totalUnidades > 0 &&
        participacionUnidades >= 10 &&
        participacionGanancia < 10
      ) {
        lista.push({
          prioridad: 'media',
          puntaje: puntuar(70, p.producto_id, margen !== null),
          icono: <Coins size={18} />,
          titulo: `Poco rentable: "${nombre}" vende mucho pero gana poco`,
          detalle: `Representa ${participacionUnidades.toFixed(1)}% de las unidades vendidas pero solo ${participacionGanancia.toFixed(1)}% de la ganancia.`,
          datos: [
            'Posibles causas: precio bajo, costo alto o proveedor caro',
            'Revisar precio y comparar proveedores'
          ]
        })
      }

      if (
        margen !== null &&
        margen >= umbrales.margenObjetivo + 20 &&
        unidades <= 2
      ) {
        lista.push({
          prioridad: 'oportunidad',
          puntaje: puntuar(40, p.producto_id, true),
          icono: <TrendingUp size={18} />,
          titulo: `Promocionar: "${nombre}" deja ${margen.toFixed(1)}% de margen pero vende poco`,
          detalle:
            `Deja buen margen (${margen.toFixed(1)}%) y registró solo ${unidades} venta(s) en el período.`,
          datos: ['Considerar promocionarlo o destacarlo en el catálogo']
        })
      }
    }

    if (num(resumen?.facturacionSinCosto) > 0) {
      lista.push({
        prioridad: 'media',
        puntaje: 60,
        icono: <AlertTriangle size={18} />,
        titulo: 'Costo pendiente en ventas',
        detalle:
          `Hay ${formatearDinero(resumen.facturacionSinCosto)} de ventas sin costo cargado. La ganancia de esas líneas no se puede calcular.`,
        datos: [
          `${resumen.coberturaCosto?.toFixed(0) ?? '?'}% de las ventas tienen rentabilidad calculable`,
          'Se captura automáticamente al crear pedidos nuevos'
        ]
      })
    }

    return lista.sort((a, b) => b.puntaje - a.puntaje)
  }, [
    topProductos,
    stock,
    umbrales,
    resumen
  ])

  const guardarCompra = async (datos) => {
    try {
      const { data: compra, error } = await supabase
        .from('compras')
        .insert({
          proveedor_id: datos.proveedorId,
          fecha: datos.fecha,
          comprobante: datos.comprobante || null,
          observaciones: datos.observaciones || null
        })
        .select()
        .single()

      if (error) throw error

      for (const linea of datos.lineas) {
        const costoUnitario = num(linea.costoUnitario)
        const { error: errorLinea } = await supabase
          .from('compra_items')
          .insert({
            compra_id: compra.id,
            producto_id: linea.productoId,
            variante_id: linea.varianteId || null,
            cantidad: num(linea.cantidad) || 1,
            costo_unitario: costoUnitario || null,
            costo_total:
              costoUnitario > 0
                ? costoUnitario * (num(linea.cantidad) || 1)
                : null
          })

        if (errorLinea) throw errorLinea

        if (datos.actualizarCosto && costoUnitario > 0) {
          const { error: errorCosto } = await supabase
            .from('productos')
            .update({ precio_costo: costoUnitario })
            .eq('id', linea.productoId)

          if (errorCosto) throw errorCosto
        }
      }

      setComprasData(await cargarCompras())
      setMostrarCompra(false)
    } catch (e) {
      console.error('Error registrando compra:', e)
      throw e
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p>
            Inteligencia comercial: ventas, rentabilidad, compras,
            proveedores y oportunidades.
          </p>
        </div>
      </header>

      <div className="dashboard-filtros">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          aria-label="Período"
        >
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.nombre}
            </option>
          ))}
        </select>

        {periodo === 'personalizado' && (
          <>
            <input
              type="date"
              value={desdePersonalizado}
              onChange={(e) => setDesdePersonalizado(e.target.value)}
              aria-label="Desde"
            />
            <input
              type="date"
              value={hastaPersonalizado}
              onChange={(e) => setHastaPersonalizado(e.target.value)}
              aria-label="Hasta"
            />
          </>
        )}

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          aria-label="Categoría"
        >
          <option value="">Categoría: todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
          aria-label="Producto"
        >
          <option value="">Producto: todos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre_comercial || p.nombre}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Cliente..."
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          aria-label="Cliente"
        />

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          aria-label="Estado del pedido"
        >
          <option value="">Estado: todos</option>
          {estados.map((e) => (
            <option key={e.id} value={e.valor}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>

      <nav className="pestanas-dashboard">
        {PESTANAS.map((p) => {
          const Icon = p.icono
          return (
            <button
              key={p.id}
              type="button"
              className={pestana === p.id ? 'activa' : ''}
              onClick={() => setPestana(p.id)}
            >
              <Icon size={16} />
              {p.nombre}
            </button>
          )
        })}
      </nav>

      {error && (
        <div className="error-dashboard">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {pestana === 'resumen' && (
        <ResumenSeccion
          resumen={resumen}
          resumenMes={resumenMes}
          objetivos={objetivos}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'ventas' && (
        <VentasSeccion
          evolucion={evolucion}
          agrupacion={agrupacion}
          setAgrupacion={setAgrupacion}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'productos' && (
        <ProductosSeccion
          topProductos={topProductos}
          ordenProductos={ordenProductos}
          setOrdenProductos={setOrdenProductos}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'rentabilidad' && (
        <RentabilidadSeccion
          topProductos={topProductos}
          resumen={resumen}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'stock' && (
        <StockSeccion
          stock={stock}
          umbrales={umbrales}
          topProductos={topProductos}
          cargando={cargandoCatalogo}
        />
      )}

      {pestana === 'proveedores' && (
        <ProveedoresSeccion
          proveedoresData={proveedoresData}
          historialCostos={historialCostos}
          comprasData={comprasData}
          topProductos={topProductos}
          cargando={cargandoCatalogo}
        />
      )}

      {pestana === 'compras' && (
        <ComprasSeccion
          comprasData={comprasData}
          proveedoresData={proveedoresData}
          cargando={cargandoCatalogo}
          onRegistrarCompra={() => setMostrarCompra(true)}
        />
      )}

      {pestana === 'clientes' && (
        <ClientesSeccion
          topClientes={topClientes}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'categorias' && (
        <CategoriasSeccion
          topCategorias={topCategorias}
          resumen={resumen}
          cargando={cargandoVentas}
        />
      )}

      {pestana === 'oportunidades' && (
        <OportunidadesSeccion
          oportunidades={oportunidades}
          cargando={cargandoVentas}
        />
      )}

      {mostrarCompra && (
        <ModalRegistrarCompra
          proveedores={proveedoresData?.proveedores || []}
          productos={productos}
          onCancelar={() => setMostrarCompra(false)}
          onGuardar={guardarCompra}
        />
      )}

      {mostrarObjetivos && objetivos && (
        <ModalObjetivos
          objetivos={objetivos}
          onCancelar={() => setMostrarObjetivos(false)}
          onGuardar={async (nuevos) => {
            await guardarObjetivos(nuevos)
            setObjetivos(await cargarObjetivos())
            setMostrarObjetivos(false)
          }}
        />
      )}

      {objetivos && (
        <button
          type="button"
          className="boton-objetivos-flotante"
          onClick={() => setMostrarObjetivos(true)}
        >
          <Percent size={16} />
          Objetivos
        </button>
      )}
    </>
  )
}


/* ============================================================
   MODAL: REGISTRAR COMPRA
   ============================================================ */

function ModalRegistrarCompra({
  proveedores,
  productos,
  onCancelar,
  onGuardar
}) {

  const [proveedorId, setProveedorId] = useState('')
  const [fecha, setFecha] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [comprobante, setComprobante] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [actualizarCosto, setActualizarCosto] = useState(true)
  const [lineas, setLineas] = useState([
    { productoId: '', cantidad: 1, costoUnitario: '' }
  ])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cambiarLinea = (i, campo, valor) => {
    setLineas((actuales) =>
      actuales.map((l, j) => (j === i ? { ...l, [campo]: valor } : l))
    )
  }

  const guardar = async () => {
    if (!proveedorId) {
      setMensaje('Elegí el proveedor.')
      return
    }

    const lineasValidas = lineas.filter(
      (l) => l.productoId && num(l.cantidad) > 0
    )

    if (lineasValidas.length === 0) {
      setMensaje('Agregá al menos una línea con producto y cantidad.')
      return
    }

    setGuardando(true)
    try {
      await onGuardar({
        proveedorId: Number(proveedorId),
        fecha,
        comprobante,
        observaciones,
        actualizarCosto,
        lineas: lineasValidas.map((l) => ({
          productoId: Number(l.productoId),
          cantidad: num(l.cantidad),
          costoUnitario: num(l.costoUnitario) || null
        }))
      })
    } catch (e) {
      setMensaje('No se pudo registrar la compra: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-fondo">
      <div className="modal-dashboard">
        <div className="modal-header">
          <h3>Registrar compra</h3>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCancelar}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-cuerpo">
          <div className="form-grilla">
            <label>
              Proveedor *
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">Elegir proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>

            <label>
              Comprobante
              <input
                type="text"
                placeholder="N° de factura o remito"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
              />
            </label>
          </div>

          <h4>Líneas de compra</h4>

          {lineas.map((linea, i) => (
            <div className="fila-linea-compra" key={i}>
              <select
                value={linea.productoId}
                onChange={(e) =>
                  cambiarLinea(i, 'productoId', e.target.value)
                }
              >
                <option value="">Producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_comercial || p.nombre}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) =>
                  cambiarLinea(i, 'cantidad', e.target.value)
                }
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo unit. $"
                value={linea.costoUnitario}
                onChange={(e) =>
                  cambiarLinea(i, 'costoUnitario', e.target.value)
                }
              />

              <button
                type="button"
                className="accion-icono peligro"
                onClick={() =>
                  setLineas((actuales) =>
                    actuales.filter((_, j) => j !== i)
                  )
                }
                aria-label="Quitar línea"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="boton-agregar-linea"
            onClick={() =>
              setLineas((actuales) => [
                ...actuales,
                { productoId: '', cantidad: 1, costoUnitario: '' }
              ])
            }
          >
            <Plus size={15} />
            Agregar línea
          </button>

          <label className="checkbox-costo">
            <input
              type="checkbox"
              checked={actualizarCosto}
              onChange={(e) => setActualizarCosto(e.target.checked)}
            />
            Actualizar el costo actual del producto con el costo de esta
            compra
          </label>

          <label>
            Observaciones
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />
          </label>

          {mensaje && <div className="mensaje-modal">{mensaje}</div>}
        </div>

        <div className="modal-pie">
          <button
            type="button"
            className="boton-secundario"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario"
            onClick={guardar}
            disabled={guardando}
          >
            <CheckCircle2 size={16} />
            {guardando ? 'Guardando...' : 'Guardar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}


/* ============================================================
   MODAL: OBJETIVOS
   ============================================================ */

function ModalObjetivos({ objetivos, onCancelar, onGuardar }) {

  const [form, setForm] = useState({
    facturacion: objetivos.facturacion || '',
    ganancia: objetivos.ganancia || '',
    pedidos: objetivos.pedidos || '',
    margen: objetivos.margen || 30
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const guardar = async () => {
    setGuardando(true)
    try {
      await onGuardar(form)
    } catch (e) {
      setMensaje('No se pudieron guardar los objetivos: ' + e.message)
      setGuardando(false)
    }
  }

  return (
    <div className="modal-fondo">
      <div className="modal-dashboard">
        <div className="modal-header">
          <h3>Objetivos del mes</h3>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCancelar}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-cuerpo">
          <div className="form-grilla">
            <label>
              Objetivo de facturación mensual ($)
              <input
                type="number"
                min="0"
                value={form.facturacion}
                onChange={(e) =>
                  setForm({ ...form, facturacion: e.target.value })
                }
              />
            </label>

            <label>
              Objetivo de ganancia mensual ($)
              <input
                type="number"
                min="0"
                value={form.ganancia}
                onChange={(e) =>
                  setForm({ ...form, ganancia: e.target.value })
                }
              />
            </label>

            <label>
              Objetivo de pedidos mensuales
              <input
                type="number"
                min="0"
                value={form.pedidos}
                onChange={(e) =>
                  setForm({ ...form, pedidos: e.target.value })
                }
              />
            </label>

            <label>
              Margen mínimo objetivo (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.margen}
                onChange={(e) =>
                  setForm({ ...form, margen: e.target.value })
                }
              />
            </label>
          </div>

          <p className="nota-modal">
            Se guardan en la tabla de configuración y se usan para mostrar
            el progreso mensual en el resumen.
          </p>

          {mensaje && <div className="mensaje-modal">{mensaje}</div>}
        </div>

        <div className="modal-pie">
          <button
            type="button"
            className="boton-secundario"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario"
            onClick={guardar}
            disabled={guardando}
          >
            <CheckCircle2 size={16} />
            {guardando ? 'Guardando...' : 'Guardar objetivos'}
          </button>
        </div>
      </div>
    </div>
  )
}