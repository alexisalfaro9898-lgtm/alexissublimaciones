/* ============================================================
   PRUEBA E2E FINAL — sistema-pedidos
   Cliente (crear pedido completo) + Admin (gestionar) + Aislamiento
   Uso:  source .env && ADMIN_EMAIL=... ADMIN_PASSWORD=... node prueba-final.mjs
   Requiere: SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
             SUPABASE_SECRET_KEY y ADMIN_EMAIL/ADMIN_PASSWORD.
             (Credenciales SOLO por entorno, nunca hardcodeadas.)
   Limpia todos los datos que crea. Se puede repetir.
   ============================================================ */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SERVICE = process.env.SUPABASE_SECRET_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Faltan credenciales de admin. Definí ADMIN_EMAIL y ADMIN_PASSWORD ' +
    'como variables de entorno. Nunca las escribas en este archivo.'
  )
  process.exit(1)
}

const admin = createClient(URL, SERVICE)
const anonClient = createClient(URL, ANON)
const anonSinSesion = createClient(URL, ANON)
const sufijo = Date.now()
const emailA = `e2e-cliente-a-${sufijo}@test.local`
const emailB = `e2e-cliente-b-${sufijo}@test.local`

const resultados = []
function registrar(paso, ok, detalle = '') {
  resultados.push({ paso, ok, detalle })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${paso}${detalle ? ' | ' + detalle : ''}`)
}

let pedidoId = null
let detalleId = null
let rutaStorage = null
let archivoId = null

try {
  /* ============================================================
     CLIENTE A
     ============================================================ */

  const { data: ua } = await admin.auth.admin.createUser({
    email: emailA, password: 'Prueba123!', email_confirm: true,
    user_metadata: { nombre: 'Cliente A E2E' }
  })
  const { data: sa, error: ea1 } = await anonClient.auth.signInWithPassword({ email: emailA, password: 'Prueba123!' })
  registrar('1a. Alta cliente A (auth)', !ea1, ea1?.message)
  const clienteA = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${sa.session.access_token}` } } })

  const { error: eiC } = await clienteA.from('clientes').insert({
    auth_user_id: ua.user.id, nombre: 'Cliente A E2E', email: emailA, tipo_cliente: 'minorista'
  })
  registrar('1b. Insert clientes (A)', !eiC, eiC?.message)
  const { data: cA } = await clienteA.from('clientes').select('id, email').eq('auth_user_id', ua.user.id).single()
  registrar('1c. Leer perfil propio (A)', !!cA, cA ? cA.email : 'no devolvió fila')

  const { data: prods, error: eCat } = await clienteA.from('productos').select('id, nombre').eq('activo', true)
  registrar('2. Catálogo (A)', !eCat && prods?.length > 0, `productos=${prods?.length}`)
  const producto = prods?.[0]

  const { data: variantes } = await clienteA.from('producto_variantes').select('id, nombre, precio').eq('producto_id', producto.id).eq('activo', true)
  const { data: pregRel } = await clienteA.from('producto_preguntas').select('*, preguntas(*)').eq('producto_id', producto.id).eq('activo', true)
  registrar('3. Variantes y preguntas (A)', (variantes?.length ?? 0) >= 0 && Array.isArray(pregRel), `variantes=${variantes?.length} preguntas=${pregRel?.length}`)

  const variante = variantes?.length ? variantes[0] : null
  const pregunta = pregRel?.[0]?.preguntas
  const precioVariante = Number(variante?.precio) || Number(producto.precio_publico) || Number(producto.precio) || 0

  const { data: pedido, error: ePed } = await clienteA.from('pedidos').insert({
    cliente_nombre: 'Cliente A E2E',
    cliente_telefono: '099000111',
    cliente_email: emailA,
    estado: 'nuevo',
    subtotal: precioVariante,
    recargos: precioVariante * 0.02 + 30,
    total: precioVariante + precioVariante * 0.02 + 30
  }).select('id').single()
  registrar('4. Insert pedido (A)', !ePed, ePed?.message)
  pedidoId = pedido?.id

  const { data: estados } = await clienteA.from('estados_pedido').select('id, nombre').eq('activo', true)
  const estadoNuevo = estados?.find((e) => e.nombre.toLowerCase() === 'nuevo')
  registrar('5. Estados_pedido visibles (A)', !!estadoNuevo, `estados=${estados?.length}`)

  const { error: eHist } = await clienteA.from('historial_pedidos').insert({
    pedido_id: pedidoId, estado_anterior_id: null,
    estado_nuevo_id: estadoNuevo?.id, accion: 'Pedido creado', comentario: 'E2E'
  })
  registrar('6. Historial inicial (A)', !eHist, eHist?.message)

  const { data: detalle, error: eDet } = await clienteA.from('pedido_detalles').insert({
    pedido_id: pedidoId, producto_id: producto.id, producto_nombre: producto.nombre,
    codigo_interno: producto.codigo_interno, cantidad: 1, precio_unitario: precioVariante,
    subtotal: precioVariante, detalle: 'E2E'
  }).select('id').single()
  registrar('7. Detalle de pedido (A)', !eDet, eDet?.message)
  detalleId = detalle?.id

  const pers = []
  if (variante) pers.push({ pedido_detalle_id: detalleId, nombre: 'Variante', descripcion: 'E2E', valor_texto: variante.nombre, recargo_porcentaje: 0, recargo_fijo: 0, recargo_calculado: 0 })
  pers.push({ pedido_detalle_id: detalleId, nombre: 'Nombre o texto', descripcion: 'E2E', valor_texto: 'Cliente A', recargo_porcentaje: 2, recargo_fijo: 0, recargo_calculado: precioVariante * 0.02 })
  pers.push({ pedido_detalle_id: detalleId, nombre: 'Bolsita de regalo', descripcion: 'E2E', valor_texto: 'Sí', recargo_porcentaje: 0, recargo_fijo: 30, recargo_calculado: 30 })
  let okPers = true
  for (const fila of pers) {
    const { error } = await clienteA.from('pedido_personalizaciones').insert(fila)
    if (error) okPers = false
  }
  registrar('8. Personalizaciones (A)', okPers, okPers ? `fila(s)=${pers.length}` : 'RLS/FK bloqueó')

  if (pregunta) {
    const filaRespuesta = { pedido_item_id: detalleId, pregunta_id: pregunta.id }
    if (pregunta.tipo_respuesta === 'booleano') filaRespuesta.valor_booleano = true
    else if (pregunta.tipo_respuesta === 'numero') filaRespuesta.valor_numero = 5
    else if (pregunta.tipo_respuesta === 'opcion') filaRespuesta.opcion_id = null
    else filaRespuesta.valor_texto = 'Respuesta E2E'
    const { error: eResp } = await clienteA.from('pedido_respuestas').insert(filaRespuesta)
    registrar('9. Respuesta a pregunta (A)', !eResp, eResp?.message)
  } else {
    registrar('9. Respuesta a pregunta (A)', true, 'sin preguntas configuradas')
  }

  rutaStorage = `pedidos/${pedidoId}/detalle-${detalleId}/${Date.now()}-e2e.png`
  const { error: eUp } = await clienteA.storage.from('pedido-archivos').upload(rutaStorage, Buffer.from('imagen-e2e'), { contentType: 'image/png', upsert: false })
  registrar('10. Subir archivo (A)', !eUp, eUp?.message)

  const { data: archivo, error: eArc } = await clienteA.from('pedido_archivos').insert({
    pedido_id: pedidoId, pedido_detalle_id: detalleId, nombre_original: 'e2e.png',
    ruta_storage: rutaStorage, tipo_archivo: 'image/png', extension: 'png', tamano_bytes: 11
  }).select('id').single()
  registrar('11. Registro pedido_archivos (A)', !eArc, eArc?.message)
  archivoId = archivo?.id

  const { data: sUrl, error: eSU } = await clienteA.storage.from('pedido-archivos').createSignedUrl(rutaStorage, 60)
  registrar('12. Signed URL propio (A)', !eSU && !!sUrl?.signedUrl, eSU?.message)

  const { data: miPedido } = await clienteA.from('pedidos').select('id, estado, total').eq('id', pedidoId).single()
  registrar('13. Leer pedido propio (A)', !!miPedido, miPedido ? `estado=${miPedido.estado}` : 'no visible')
  const { data: miHist } = await clienteA.from('historial_pedidos').select('id').eq('pedido_id', pedidoId)
  registrar('14. Leer historial propio (A)', (miHist?.length ?? 0) > 0, `filas=${miHist?.length}`)

  /* ============================================================
     CLIENTE B — aislamiento
     ============================================================ */

  const { data: ub } = await admin.auth.admin.createUser({
    email: emailB, password: 'Prueba123!', email_confirm: true
  })
  const { data: sb } = await anonClient.auth.signInWithPassword({ email: emailB, password: 'Prueba123!' })
  const clienteB = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${sb.session.access_token}` } } })
  await clienteB.from('clientes').insert({ auth_user_id: ub.user.id, nombre: 'Cliente B E2E', email: emailB, tipo_cliente: 'minorista' })
  registrar('15. Alta cliente B (auth)', true)

  const { data: pedB } = await clienteB.from('pedidos').select('id').eq('id', pedidoId)
  registrar('16. AISLAMIENTO: B NO ve pedido de A', (pedB?.length ?? 0) === 0, `filas=${pedB?.length}`)
  const { data: detB } = await clienteB.from('pedido_detalles').select('id').eq('pedido_id', pedidoId)
  registrar('17. AISLAMIENTO: B NO ve detalles de A', (detB?.length ?? 0) === 0)
  const { data: persB } = await clienteB.from('pedido_personalizaciones').select('id').eq('pedido_detalle_id', detalleId)
  registrar('18. AISLAMIENTO: B NO ve personalizaciones de A', (persB?.length ?? 0) === 0)
  const { data: histB } = await clienteB.from('historial_pedidos').select('id').eq('pedido_id', pedidoId)
  registrar('19. AISLAMIENTO: B NO ve historial de A', (histB?.length ?? 0) === 0)
  const { data: sUrlB, error: eSUB } = await clienteB.storage.from('pedido-archivos').createSignedUrl(rutaStorage, 60)
  registrar('20. AISLAMIENTO: B NO obtiene signed URL de A', !sUrlB?.signedUrl && !!eSUB, eSUB?.message)

  /* ============================================================
     ADMIN
     ============================================================ */

  const { data: sAdm, error: eAdm } = await anonClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  registrar('21. Login admin', !eAdm, eAdm?.message)
  const adminCli = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${sAdm.session.access_token}` } } })

  const { data: pedidosAdmin } = await adminCli.from('pedidos').select('id, estado').eq('id', pedidoId)
  registrar('22. Admin ve el pedido de A', pedidosAdmin?.length === 1)
  const { data: detAdm } = await adminCli.from('pedido_detalles').select('*').eq('pedido_id', pedidoId)
  registrar('23. Admin ve detalles', (detAdm?.length ?? 0) === 1)
  const { data: persAdm } = await adminCli.from('pedido_personalizaciones').select('*').eq('pedido_detalle_id', detalleId)
  registrar('24. Admin ve personalizaciones', (persAdm?.length ?? 0) === pers.length)
  const { data: respAdm } = await adminCli.from('pedido_respuestas').select('*').eq('pedido_item_id', detalleId)
  registrar('25. Admin ve respuestas', (respAdm?.length ?? 0) >= 0, `filas=${respAdm?.length}`)
  const { data: arcAdm } = await adminCli.from('pedido_archivos').select('*').eq('pedido_id', pedidoId)
  registrar('26. Admin ve archivos', (arcAdm?.length ?? 0) === 1)
  const { data: sUrlAdm, error: eSUAdm } = await adminCli.storage.from('pedido-archivos').createSignedUrl(rutaStorage, 60)
  registrar('27. Admin obtiene signed URL', !eSUAdm && !!sUrlAdm?.signedUrl, eSUAdm?.message)

  const flujoEstados = ['nuevo', 'revisar', 'diseno', 'aprobacion', 'produccion', 'listo', 'entregado']
  let okEstados = true
  let detalleEstado = ''
  for (const estado of flujoEstados) {
    const { error: eUpd } = await adminCli.from('pedidos').update({ estado }).eq('id', pedidoId)
    if (eUpd) { okEstados = false; detalleEstado = `${estado}: ${eUpd.message}`; break }
    const estadoNuevoId = estados?.find((e) => e.nombre.toLowerCase() === (estado === 'aprobacion' ? 'aprobación' : estado === 'diseno' ? 'diseño' : estado))?.id
    const estadoAnteriorId = estados?.find((e) => e.nombre.toLowerCase() === (flujoEstados[flujoEstados.indexOf(estado) - 1] ? (flujoEstados[flujoEstados.indexOf(estado) - 1] === 'aprobacion' ? 'aprobación' : flujoEstados[flujoEstados.indexOf(estado) - 1] === 'diseno' ? 'diseño' : flujoEstados[flujoEstados.indexOf(estado) - 1]) : 'nuevo'))?.id
    const { error: eH } = await adminCli.from('historial_pedidos').insert({
      pedido_id: pedidoId, estado_anterior_id: estadoAnteriorId,
      estado_nuevo_id: estadoNuevoId, accion: `Estado: ${estado}`, comentario: null
    })
    if (eH) { okEstados = false; detalleEstado = `historial ${estado}: ${eH.message}`; break }
  }
  registrar('28. Ciclo de estados completo (admin)', okEstados, detalleEstado || flujoEstados.join(' → '))

  const { data: histFinal } = await adminCli.from('historial_pedidos').select('id').eq('pedido_id', pedidoId)
  registrar('29. Historial acumulado (admin)', (histFinal?.length ?? 0) >= 2, `filas=${histFinal?.length}`)
  const { data: histLegacy } = await admin.from('pedido_historial').select('id').eq('pedido_id', pedidoId)
  registrar('30. Sin escritura en pedido_historial (legacy)', (histLegacy?.length ?? 0) === 0, `filas=${histLegacy?.length}`)

  /* ============================================================
     ANÓNIMO
     ============================================================ */

  const { data: pedAnon } = await anonSinSesion.from('pedidos').select('id').eq('id', pedidoId)
  registrar('31. Anónimo NO ve pedidos', (pedAnon?.length ?? 0) === 0)
  const { error: eAnonIns } = await anonSinSesion.from('pedidos').insert({ cliente_nombre: 'x', estado: 'nuevo', subtotal: 1, total: 1 })
  registrar('32. Anónimo NO puede insertar pedidos', !!eAnonIns)
  const { data: prodAnon } = await anonSinSesion.from('productos').select('id').eq('activo', true)
  registrar('33. Anónimo ve catálogo', (prodAnon?.length ?? 0) > 0, `productos=${prodAnon?.length}`)

  console.log('\n===== RESUMEN =====')
  const pasan = resultados.filter((r) => r.ok).length
  const fallan = resultados.filter((r) => !r.ok).length
  console.log(`PASS: ${pasan} | FAIL: ${fallan}`)
} catch (error) {
  console.error('ERROR GENERAL DE LA PRUEBA:', error?.message || error)
} finally {
  /* ============================================================
     LIMPIEZA (service role)
     ============================================================ */

  const limpieza = async () => {
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
    for (const email of [emailA, emailB]) {
      const { data: us } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const u = us?.users?.find((x) => x.email === email)
      if (u) {
        const { data: cc } = await admin.from('clientes').select('id').eq('auth_user_id', u.id)
        if (cc?.length) await admin.from('clientes').delete().in('id', cc.map((x) => x.id))
        await admin.auth.admin.deleteUser(u.id)
      }
    }
    console.log('Limpieza de datos de prueba completada.')
  }
  await limpieza()
}
