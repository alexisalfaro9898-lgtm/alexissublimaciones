/* ============================================================
   CHAT + NOTIFICACIONES
   Lógica compartida entre el portal cliente y el panel admin.
   ============================================================ */

import { supabase } from './supabase'

export { supabase }

/* ============================================================
   CONVERSACIONES
   ============================================================ */

export async function obtenerConversacionCliente(clienteId) {
  if (!clienteId) return null
  const { data, error } = await supabase
    .from('conversaciones')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle()

  if (error) {
    console.error('Error obteniendo conversación:', error)
    return null
  }

  return data
}

export async function crearConversacion(clienteId) {
  if (!clienteId) return { data: null, error: { message: 'Sin cliente' } }
  const { data, error } = await supabase
    .from('conversaciones')
    .insert({ cliente_id: clienteId })
    .select()
    .maybeSingle()
  return { data, error }
}

export async function listarConversacionesAdmin() {
  const { data, error } = await supabase
    .from('conversaciones')
    .select(`
      id,
      actualizado_en,
      ultimo_mensaje_at,
      cliente_id,
      cliente:clientes(nombre, email, telefono, whatsapp)
    `)
    .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error listando conversaciones:', error)
    return []
  }

  const lista = data || []

  // no leídos (mensajes de cliente sin leer por el admin)
  const { data: noLeidos } = await supabase
    .from('mensajes')
    .select('conversacion_id, id', { count: 'exact' })
    .in(
      'conversacion_id',
      lista.map((c) => c.id)
    )
    .eq('remitente_tipo', 'cliente')
    .eq('leido', false)

  const conteo = {}
  ;(noLeidos || []).forEach((m) => {
    conteo[m.conversacion_id] = (conteo[m.conversacion_id] || 0) + 1
  })

  return lista.map((c) => ({
    ...c,
    _noLeidos: conteo[c.id] || 0
  }))
}

/* ============================================================
   MENSAJES
   ============================================================ */

export async function listarMensajes(conversacionId) {
  if (!conversacionId) return []
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error listando mensajes:', error)
    return []
  }

  return data || []
}

export async function enviarMensaje({ conversacionId, remitenteTipo, texto }) {
  const limpio = (texto || '').trim()
  if (!conversacionId || !limpio) return { error: { message: 'Mensaje vacío.' } }

  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      conversacion_id: conversacionId,
      remitente_tipo: remitenteTipo,
      texto: limpio
    })
    .select()
    .maybeSingle()

  if (!error) {
    // marca la conversación con último mensaje (para ordenar en el admin)
    await supabase
      .from('conversaciones')
      .update({ actualizado_en: new Date().toISOString(), ultimo_mensaje_at: new Date().toISOString() })
      .eq('id', conversacionId)
      .maybeSingle()
  }

  return { data, error }
}

export async function marcarMensajesLeidos(conversacionId, remitenteTipo) {
  if (!conversacionId) return
  await supabase
    .from('mensajes')
    .update({ leido: true })
    .eq('conversacion_id', conversacionId)
    .eq('remitente_tipo', remitenteTipo)
    .eq('leido', false)
}

export async function contarNoLeidosCliente(conversacionId) {
  if (!conversacionId) return 0
  const { count } = await supabase
    .from('mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('conversacion_id', conversacionId)
    .eq('remitente_tipo', 'admin')
    .eq('leido', false)
  return count || 0
}

/* ============================================================
   NOTIFICACIONES
   ============================================================ */

export async function cargarNotificaciones({ paraTipo, clienteId = null }) {
  let q = supabase
    .from('notificaciones')
    .select('*')
    .eq('para_tipo', paraTipo)
    .order('id', { ascending: false })
    .limit(50)

  if (paraTipo === 'cliente') {
    q = q.eq('cliente_id', clienteId)
  }

  const { data, error } = await q
  if (error) {
    console.error('Error cargando notificaciones:', error)
    return []
  }
  return data || []
}

export async function contarNoLeidas({ paraTipo, clienteId = null }) {
  let q = supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('para_tipo', paraTipo)
    .eq('leida', false)

  if (paraTipo === 'cliente') {
    q = q.eq('cliente_id', clienteId)
  }

  const { count } = await q
  return count || 0
}

export async function marcarNotificacionLeida(id) {
  if (!id) return
  await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
}

export async function marcarTodasLeidas({ paraTipo, clienteId = null }) {
  let q = supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('para_tipo', paraTipo)
    .eq('leida', false)

  if (paraTipo === 'cliente') {
    q = q.eq('cliente_id', clienteId)
  }

  await q
}

/* Crear notificación (cliente autenticado normalmente solo crea las suyas) */
export async function crearNotificacion({ paraTipo, clienteId = null, tipo, titulo, cuerpo, refPedidoId = null }) {
  const { data, error } = await supabase
    .from('notificaciones')
    .insert({
      para_tipo: paraTipo,
      cliente_id: clienteId,
      tipo,
      titulo,
      cuerpo,
      ref_pedido_id: refPedidoId
    })
    .select()
    .maybeSingle()

  return { data, error }
}

/* ============================================================
   REALTIME
   ============================================================ */

export function suscribirMensajes(conversacionId, callback) {
  const channel = supabase
    .channel(`mensajes-${conversacionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `conversacion_id=eq.${conversacionId}`
      },
      (payload) => {
        if (typeof callback === 'function') callback(payload.new)
      }
    )
    .subscribe()

  return channel
}

export function suscribirNotificaciones({ paraTipo, clienteId = null }, callback) {
  const topic =
    paraTipo === 'cliente'
      ? `notifs-${paraTipo}-${clienteId}`
      : `notifs-${paraTipo}`

  let channel = supabase.channel(topic)

  if (paraTipo === 'cliente') {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `para_tipo=eq.cliente`
      },
      (payload) => {
        const n = payload.new
        if (!clienteId || n.cliente_id === clienteId) {
          if (typeof callback === 'function') callback(n)
        }
      }
    )
  } else {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `para_tipo=eq.admin`
      },
      (payload) => {
        if (typeof callback === 'function') callback(payload.new)
      }
    )
  }

  channel.subscribe()
  return channel
}

/* Reproducir un sonido de notificación usando Web Audio API (no requiere archivo). */
export function reproducirSonidoNotificacion() {
  try {
    const Ctx =
      window.AudioContext ||
      window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.24
    )
    osc.stop(ctx.currentTime + 0.25)
    setTimeout(() => ctx.close(), 400)
  } catch (e) {
    /* silencio */
  }
}
