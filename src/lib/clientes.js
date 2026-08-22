import { supabase } from './supabase'

/* ============================================================
   CLIENTES: IDENTIFICACIÓN POR TELÉFONO (preparación WhatsApp)
   ============================================================
   - normalizarTelefono: normalización genérica de teléfonos
     (espacios, guiones, paréntesis, *, código de país, 00->+).
     No asume un país en particular.
   - findClientePorTelefono: busca por whatsapp y luego por telefono
     usando la forma normalizada.
   - findOrCreateClientePorTelefono: crea si no existe.
     NO fusiona duplicados automáticamente.
   ============================================================ */

export function normalizarTelefono(telefono) {
  if (telefono === null || telefono === undefined) {
    return null
  }

  const texto = String(telefono).trim()

  if (!texto) {
    return null
  }

  let normalizado = texto.replace(/[^\d+]/g, '')

  if (normalizado.startsWith('00')) {
    normalizado = '+' + normalizado.slice(2)
  }

  return normalizado || null
}

export function telefonoParaComparar(telefono) {
  const normalizado = normalizarTelefono(telefono)
  if (!normalizado) {
    return null
  }
  return normalizado.replace(/^\+/, '')
}

export async function findClientePorTelefono(telefono) {
  const normalizado = telefonoParaComparar(telefono)

  if (!normalizado) {
    return null
  }

  const enWhatsapp = await supabase
    .from('clientes')
    .select('*')
    .eq('whatsapp', normalizado)
    .limit(1)

  if (enWhatsapp.error) throw enWhatsapp.error
  if (enWhatsapp.data && enWhatsapp.data.length > 0) {
    return enWhatsapp.data[0]
  }

  const enTelefono = await supabase
    .from('clientes')
    .select('*')
    .eq('telefono', normalizado)
    .limit(1)

  if (enTelefono.error) throw enTelefono.error
  if (enTelefono.data && enTelefono.data.length > 0) {
    return enTelefono.data[0]
  }

  return null
}

export async function findOrCreateClientePorTelefono({
  telefono,
  whatsapp = null,
  nombre = null,
  email = null
}) {
  const { data, error } = await supabase.rpc(
    'find_or_create_cliente_por_telefono',
    {
      p_telefono: telefono || null,
      p_whatsapp: whatsapp || null,
      p_nombre: nombre || null,
      p_email: email || null
    }
  )

  if (error) throw error

  return { cliente: data, creado: !!data?.creado }
}

/* ============================================================
   ANÁLISIS DE DUPLICADOS (solo informativo, no fusiona)
   ============================================================ */

export async function analizarDuplicadosTelefonos() {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, whatsapp')

  if (error) throw error

  const mapa = new Map()
  const duplicados = []

  for (const cliente of data || []) {
    const clave = telefonoParaComparar(cliente.whatsapp || cliente.telefono)

    if (!clave) {
      continue
    }

    if (mapa.has(clave)) {
      duplicados.push({
        telefono: clave,
        ids: [mapa.get(clave), cliente.id]
      })
    } else {
      mapa.set(clave, cliente.id)
    }
  }

  return duplicados
}