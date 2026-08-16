import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function main() {
  console.log('======================================')
  console.log(' PRUEBA CONEXIÓN SUPABASE')
  console.log('======================================')
  console.log('')

  const { data, error } = await supabase
    .from('proveedores')
    .select('id, nombre, web, activo, sincronizacion_activa')
    .eq('nombre', 'Disershop')
    .maybeSingle()

  if (error) {
    console.error('ERROR:')
    console.error(error)
    process.exit(1)
  }

  if (!data) {
    console.log('No se encontró el proveedor Disershop.')
    process.exit(1)
  }

  console.log('Conexión correcta.')
  console.log('')
  console.log('Proveedor encontrado:')
  console.log(data)
}

main()
