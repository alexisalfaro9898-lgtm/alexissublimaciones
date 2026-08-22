import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const URL = process.env.SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SERVICE = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL, SERVICE)
const anon = createClient(URL, ANON)
const anonSinSesion = createClient(URL, ANON)

const sufijo = Date.now()
const email = `e2e-rpc-${sufijo}@test.local`

const ok = []
const bad = []
function reg(paso, ok_, detalle = '') {
  ;(ok_ ? ok : bad).push(paso)
  console.log(`${ok_ ? 'PASS' : 'FAIL'} | ${paso}${detalle ? ' | ' + detalle : ''}`)
}

let pedidoId = null
let rutaStorage = null

try {
  const { data: ua } = await admin.auth.admin.createUser({
    email, password: 'Prueba123!', email_confirm: true,
    user_metadata: { nombre: 'E2E RPC' }
  })
  const { data: sa, error: eLogin } = await anon.auth.signInWithPassword({ email, password: 'Prueba123!' })
  reg('1. Login cliente', !eLogin, eLogin?.message)
  const cliente = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${sa.session.access_token}` } } })

  const { error: eCli } = await cliente.from('clientes').insert({
    auth_user_id: ua.user.id, nombre: 'E2E RPC', email, tipo_cliente: 'minorista'
  })
  reg('2. Insert clientes', !eCli, eCli?.message)
  const { data: cA } = await cliente.from('clientes').select('id').eq('auth_user_id', ua.user.id).single()

  const { data: prods } = await anon.from('productos').select('id, nombre').eq('activo', true)
  const producto = prods?.[0]
  reg('3. Catálogo anónimo', !!producto)

  const { data: variantes } = await anon.from('producto_variantes').select('id').eq('producto_id', producto.id).eq('activo', true)
  const { data: pregRel } = await anon.from('producto_preguntas').select('*, preguntas(*)').eq('producto_id', producto.id).eq('activo', true)
  const pregunta = pregRel?.[0]?.preguntas

  const items = [{
    producto_id: producto.id,
    variante_id: variantes?.[0]?.id ?? null,
    cantidad: 1,
    detalle: 'E2E RPC',
    nombre_activo: true,
    nombre: 'Prueba RPC',
    bolsita_activo: true,
    respuestas: pregunta ? [{
      pregunta_id: pregunta.id,
      tipo: pregunta.tipo_respuesta,
      valor_texto: pregunta.tipo_respuesta === 'texto' ? 'Respuesta E2E' : null,
      valor_booleano: pregunta.tipo_respuesta === 'booleano' ? true : null,
      valor_numero: pregunta.tipo_respuesta === 'numero' ? 5 : null,
      opcion_id: pregunta.tipo_respuesta === 'opcion' ? null : null
    }] : []
  }]

  const { data: rpc, error: eRpc } = await cliente.rpc('crear_pedido', {
    p_cliente_nombre: 'E2E RPC',
    p_cliente_telefono: '099000111',
    p_cliente_email: email,
    p_cliente_id: cA.id,
    p_origen: 'web',
    p_tipo: null,
    p_items: items
  })
  reg('4. RPC crear_pedido', !eRpc && rpc?.pedido?.id, eRpc?.message)
  if (!eRpc && rpc?.pedido?.id) {
    pedidoId = rpc.pedido.id
    const detalleId = rpc.detalles?.[0]?.id
    reg('5. RPC devuelve detalle con id', !!detalleId, `detalle=${detalleId}`)
    reg('6. RPC calcula totales', Number(rpc.pedido.total) > 0, `total=${rpc.pedido.total}`)
    reg('7. RPC historial creado', rpc.pedido.estado === 'nuevo')

    const { data: hist } = await cliente.from('historial_pedidos').select('id').eq('pedido_id', pedidoId)
    reg('8. Historial visible para cliente', (hist?.length ?? 0) > 0, `filas=${hist?.length}`)

    rutaStorage = `pedidos/${pedidoId}/detalle-${detalleId}/${Date.now()}-e2e.png`
    const { error: eUp } = await cliente.storage.from('pedido-archivos').upload(rutaStorage, Buffer.from('imagen-e2e'), { contentType: 'image/png', upsert: false })
    reg('9. Subir imagen a Storage', !eUp, eUp?.message)

    const { data: archivo, error: eArc } = await cliente.from('pedido_archivos').insert({
      pedido_id: pedidoId, pedido_detalle_id: detalleId, nombre_original: 'e2e.png',
      ruta_storage: rutaStorage, tipo_archivo: 'image/png', extension: 'png', tamano_bytes: 11
    }).select('id').single()
    reg('10. Insert pedido_archivos', !eArc, eArc?.message)

    const { data: sUrl, error: eSU } = await cliente.storage.from('pedido-archivos').createSignedUrl(rutaStorage, 60)
    reg('11. Signed URL de la imagen', !eSU && !!sUrl?.signedUrl, eSU?.message)

    const { data: pers } = await cliente.from('pedido_personalizaciones').select('*').eq('pedido_detalle_id', detalleId)
    reg('12. Personalizaciones (variante/nombre/bolsita/foto)', (pers?.length ?? 0) >= 2, `filas=${pers?.length}`)

    const { data: stockInfo } = await cliente.from('pedido_detalles').select('id').eq('pedido_id', pedidoId)
    reg('13. Detalles visibles', (stockInfo?.length ?? 0) === 1)
  }

  const { data: pedAnon } = await anonSinSesion.from('pedidos').select('id').eq('id', pedidoId ?? 0)
  reg('14. Anónimo NO ve el pedido', (pedAnon?.length ?? 0) === 0)

  console.log(`\nRESUMEN: PASS=${ok.length} FAIL=${bad.length}`)
  if (bad.length) process.exitCode = 1
} catch (error) {
  console.error('ERROR GENERAL:', error?.message || error)
  process.exitCode = 1
} finally {
  if (pedidoId) {
    const { data: dets } = await admin.from('pedido_detalles').select('id').eq('pedido_id', pedidoId)
    for (const d of dets || []) {
      const { data: r } = await admin.from('pedido_respuestas').select('id').eq('pedido_item_id', d.id)
      if (r?.length) await admin.from('pedido_respuestas').delete().in('id', r.map((x) => x.id))
      const { data: p } = await admin.from('pedido_personalizaciones').select('id').eq('pedido_detalle_id', d.id)
      if (p?.length) await admin.from('pedido_personalizaciones').delete().in('id', p.map((x) => x.id))
      const { data: a } = await admin.from('pedido_archivos').select('id').eq('pedido_detalle_id', d.id)
      if (a?.length) await admin.from('pedido_archivos').delete().in('id', a.map((x) => x.id))
      await admin.from('pedido_detalles').delete().eq('id', d.id)
    }
    const { data: h } = await admin.from('historial_pedidos').select('id').eq('pedido_id', pedidoId)
    if (h?.length) await admin.from('historial_pedidos').delete().in('id', h.map((x) => x.id))
    await admin.from('pedidos').delete().eq('id', pedidoId)
  }
  if (rutaStorage) await admin.storage.from('pedido-archivos').remove([rutaStorage]).catch(() => {})
  const { data: us } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = us?.users?.find((x) => x.email === email)
  if (u) {
    const { data: cc } = await admin.from('clientes').select('id').eq('auth_user_id', u.id)
    if (cc?.length) await admin.from('clientes').delete().in('id', cc.map((x) => x.id))
    await admin.auth.admin.deleteUser(u.id)
  }
  console.log('Limpieza completada.')
}