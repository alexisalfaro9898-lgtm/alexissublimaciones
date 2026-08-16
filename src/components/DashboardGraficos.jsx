import { useState } from 'react'
import { formatearDinero, formatearFecha } from '../lib/dashboard'


/* ============================================================
   GRÁFICO DE EVOLUCIÓN (SVG propio, sin librerías)
   Barras = facturación. Línea = ganancia.
   Tooltip al pasar el mouse: fecha, ventas, costos, ganancia, pedidos.
   ============================================================ */

export default function GraficoEvolucion({
  puntos,
  altura = 260
}) {

  const [hover, setHover] = useState(null)

  if (!puntos || puntos.length === 0) {
    return (
      <div className="grafico-vacio">
        No hay datos suficientes para mostrar la evolución.
      </div>
    )
  }

  const ancho = 720
  const margenIzq = 52
  const margenDer = 16
  const margenSup = 18
  const margenInf = 28
  const areaAncho = ancho - margenIzq - margenDer
  const areaAlto = altura - margenSup - margenInf

  const maxValor = Math.max(
    1,
    ...puntos.map((p) => Math.max(p.facturacion, p.costo, p.ganancia))
  )

  const paso = puntos.length > 1 ? areaAncho / (puntos.length - 1) : areaAncho

  const x = (i) => margenIzq + (puntos.length > 1 ? i * paso : 0)
  const y = (valor) =>
    margenSup + areaAlto - (valor / maxValor) * areaAlto

  const anchoBarra = Math.max(4, Math.min(26, paso * 0.5))

  const puntosLinea = puntos
    .map((p, i) => `${x(i).toFixed(1)},${y(p.ganancia).toFixed(1)}`)
    .join(' ')

  const mayor = Math.ceil(maxValor / 4) * 4
  const divisiones = 4
  const pasoDivision = mayor / divisiones

  return (
    <div
      className="grafico-caja"
      onMouseLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${ancho} ${altura}`}
        className="grafico-svg"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const escala = ancho / rect.width
          const xCursor = (e.clientX - rect.left) * escala
          let indice = 0
          let menor = Infinity
          puntos.forEach((p, i) => {
            const distancia = Math.abs(x(i) - xCursor)
            if (distancia < menor) {
              menor = distancia
              indice = i
            }
          })
          setHover(indice)
        }}
      >

        {Array.from({ length: divisiones + 1 }).map((_, i) => {
          const valor = pasoDivision * i
          const yPos = y(valor)
          return (
            <g key={i}>
              <line
                x1={margenIzq}
                x2={ancho - margenDer}
                y1={yPos}
                y2={yPos}
                className="grafico-rejilla"
              />
              <text
                x={margenIzq - 8}
                y={yPos + 4}
                className="grafico-eje-texto"
                textAnchor="end"
              >
                {Math.round(valor).toLocaleString('es-UY')}
              </text>
            </g>
          )
        })}

        {puntos.map((p, i) => (
          <rect
            key={i}
            x={x(i) - anchoBarra / 2}
            y={y(p.facturacion)}
            width={anchoBarra}
            height={Math.max(0, margenSup + areaAlto - y(p.facturacion))}
            rx={3}
            className={
              'grafico-barra' +
              (hover === i ? ' resaltada' : '')
            }
          />
        ))}

        <polyline
          points={puntosLinea}
          fill="none"
          className="grafico-linea"
        />

        {puntos.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.ganancia)}
            r={hover === i ? 5 : 3}
            className="grafico-punto"
          />
        ))}

        {puntos.map((p, i) => (
          <text
            key={'t' + i}
            x={x(i)}
            y={altura - 8}
            className="grafico-eje-texto"
            textAnchor="middle"
          >
            {p.periodo}
          </text>
        ))}

      </svg>

      {hover !== null && puntos[hover] && (
        <div
          className="grafico-tooltip"
          style={{
            left: Math.min(
              90,
              (x(hover) / ancho) * 100
            ) + '%'
          }}
        >
          <strong>
            {formatearFecha(puntos[hover].fecha)}
          </strong>
          <div>
            <span>Ventas</span>
            <b>{formatearDinero(puntos[hover].facturacion)}</b>
          </div>
          <div>
            <span>Costos</span>
            <b>{formatearDinero(puntos[hover].costo)}</b>
          </div>
          <div>
            <span>Ganancia</span>
            <b>{formatearDinero(puntos[hover].ganancia)}</b>
          </div>
          <div>
            <span>Pedidos</span>
            <b>{puntos[hover].pedidos}</b>
          </div>
        </div>
      )}

      <div className="grafico-leyenda">
        <span>
          <i className="leyenda-barra" /> Facturación
        </span>
        <span>
          <i className="leyenda-linea" /> Ganancia
        </span>
      </div>

    </div>
  )
}