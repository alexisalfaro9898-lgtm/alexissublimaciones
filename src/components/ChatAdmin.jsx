import { useEffect, useRef, useState } from 'react'
import {
  listarConversacionesAdmin,
  listarMensajes,
  enviarMensaje,
  marcarMensajesLeidos,
  crearNotificacion,
  suscribirMensajes,
  supabase
} from '../lib/chat.js'

export default function ChatAdmin() {
  const [conversaciones, setConversaciones] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const finRef = useRef(null)

  const cargarConversaciones = async () => {
    const lista = await listarConversacionesAdmin()
    setConversaciones(lista)
    setCargando(false)
  }

  const consultarNoLeidosCliente = async (convId) => {
    const { count } = await supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', convId)
      .eq('remitente_tipo', 'cliente')
      .eq('leido', false)
    return count || 0
  }

  useEffect(() => {
    cargarConversaciones()

    const canal = supabase
      .channel('admin-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes'
        },
        async (payload) => {
          const nuevo = payload.new
          // reordenar la lista si el último mensaje cambió
          cargarConversaciones()
          if (seleccionada && nuevo.conversacion_id === seleccionada.id) {
            setMensajes((prev) => [...prev, nuevo])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversaciones'
        },
        () => cargarConversaciones()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionada?.id])

  async function abrirConversacion(conv) {
    setSeleccionada(conv)
    const msgs = await listarMensajes(conv.id)
    setMensajes(msgs)
    await marcarMensajesLeidos(conv.id, 'cliente')
    // refrescar no leídos en la lista
    const n = await consultarNoLeidosCliente(conv.id)
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === conv.id ? { ...c, _noLeidos: n } : c
      )
    )
    setTimeout(() => {
      finRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }

  async function responder() {
    const limpio = texto.trim()
    if (!limpio || !seleccionada) return
    const { data, error } = await enviarMensaje({
      conversacionId: seleccionada.id,
      remitenteTipo: 'admin',
      texto: limpio
    })
    if (!error && data) {
      setMensajes((prev) => [...prev, data])
    }
    setTexto('')
    // notificar al cliente
    await crearNotificacion({
      paraTipo: 'cliente',
      clienteId: seleccionada.cliente_id,
      tipo: 'mensaje',
      titulo: 'Nuevo mensaje de la administración',
      cuerpo: limpio.length > 90 ? limpio.slice(0, 90) + '…' : limpio
    })
    cargarConversaciones()
  }

  const nombreCliente = (c) =>
    c.cliente?.nombre ||
    c.cliente?.email ||
    `Cliente #${c.cliente_id}`

  const ultimoMensaje = (c) =>
    c.ultimo_mensaje_at
      ? new Date(c.ultimo_mensaje_at).toLocaleTimeString('es-UY', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : ''

  return (
    <div className="chat-admin">
      <div className="chat-admin-lista">
        <div className="chat-admin-titulo">
          <h2>💬 Mensajes de clientes</h2>
          <p>Respondé las consultas de tus clientes.</p>
        </div>

        {cargando ? (
          <p className="chat-admin-vacio">Cargando conversaciones...</p>
        ) : conversaciones.length === 0 ? (
          <p className="chat-admin-vacio">
            Todavía no hay conversaciones con clientes.
          </p>
        ) : (
          conversaciones.map((c) => (
            <button
              key={c.id}
              className={
                'chat-admin-cliente' +
                (seleccionada?.id === c.id ? ' activo' : '')
              }
              onClick={() => abrirConversacion(c)}
            >
              <div className="chat-admin-cliente-info">
                <strong>{nombreCliente(c)}</strong>
                <span>
                  {c.cliente?.email || c.cliente?.telefono || ''}
                </span>
              </div>
              {c._noLeidos > 0 && (
                <span className="chat-admin-badge">{c._noLeidos}</span>
              )}
              <small className="chat-admin-hora">
                {ultimoMensaje(c) || ''}
              </small>
            </button>
          ))
        )}
      </div>

      <div className="chat-admin-hilo">
        {!seleccionada ? (
          <div className="chat-admin-sin-seleccion">
            <p>Seleccioná una conversación para responder.</p>
          </div>
        ) : (
          <>
            <div className="chat-admin-hilo-titulo">
              <strong>{nombreCliente(seleccionada)}</strong>
              <span>
                {seleccionada.cliente?.email ||
                  seleccionada.cliente?.telefono ||
                  ''}
              </span>
            </div>

            <div className="chat-admin-mensajes">
              {mensajes.length === 0 ? (
                <p className="chat-vacio">Sin mensajes todavía.</p>
              ) : (
                mensajes.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.remitente_tipo === 'admin'
                        ? 'chat-burbuja cliente'
                        : 'chat-burbuja admin'
                    }
                  >
                    <span>{m.texto}</span>
                    <small>
                      {new Date(m.creado_en).toLocaleTimeString('es-UY', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </small>
                  </div>
                ))
              )}
              <div ref={finRef} />
            </div>

            <div className="chat-input">
              <input
                type="text"
                placeholder="Responder al cliente..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') responder()
                }}
              />
              <button onClick={responder} disabled={!texto.trim()}>
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
