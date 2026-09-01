import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const envPath = resolve(__dirname, '../../.env')

const env = {}
for (const linea of readFileSync(envPath, 'utf8').split('\n')) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !env[m[1]]) {
    env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const SECRET_KEY = env.SUPABASE_SECRET_KEY
const supabase = createClient(SUPABASE_URL, SECRET_KEY)

const segmentos = ['damas', 'deporte', 'empresa', 'infantil', 'festejo']

function svgPatron(segmento) {
  const paletas = {
    damas: ['#f7a1c4', '#e56fb1', '#c94f8e', '#f9c2d9'],
    deporte: ['#1f4690', '#f0a500', '#e45826', '#dad0c2'],
    empresa: ['#12303a', '#2c6e63', '#b7d8c5', '#f2eee2'],
    infantil: ['#ffb703', '#fb8500', '#ff5400', '#219ebc'],
    festejo: ['#f6f2d4', '#ff4d6d', '#ffb703', '#7b2cbf'],
  }
  const p = paletas[segmento] || paletas['damas']
  const nombre = { damas: 'Floral', deporte: 'Aro atleta', empresa: 'Geométrico', infantil: 'Confeti', festejo: 'Globos' }[segmento]
  let cuerpo
  if (segmento === 'damas') {
    cuerpo = `${[0,1,2,3,0,2,1,3].map((i) => `<circle cx="${20+((i%4)*24)}" cy="${18+Math.floor(i/4)*20}" r="${8+(i%2)*3}" fill="${p[i%4]}" fill-opacity="0.55"/>`).join('')}
      <path d="M10 88 Q50 40 90 88 T170 88" stroke="${p[1]}" stroke-width="3" fill="none"/>`
  } else if (segmento === 'deporte') {
    cuerpo = `<rect width="200" height="200" fill="${p[3]}"/>
      <path d="M-40 160 L240 -40 L240 10 L-40 210 Z" fill="${p[0]}"/>
      <circle cx="100" cy="120" r="52" fill="none" stroke="${p[1]}" stroke-width="10"/>
      <text x="100" y="150" font-size="70" font-weight="bold" text-anchor="middle" fill="${p[1]}">9</text>`
  } else if (segmento === 'empresa') {
    cuerpo = `<rect width="200" height="200" fill="${p[3]}"/>
      <circle cx="100" cy="70" r="30" fill="${p[0]}"/>
      <path d="M40 170 L100 90 L160 170 Z" fill="${p[1]}"/>
      <rect x="55" y="160" width="90" height="8" fill="${p[0]}"/>`
  } else if (segmento === 'infantil') {
    cuerpo = `<rect width="200" height="200" fill="${p[3]}"/>
      ${[0,1,2,3,4,5].map((i) => `<circle cx="${(i%3)*70+35}" cy="${Math.floor(i/3)*90+45}" r="${16+(i%2)*6}" fill="${p[i%4]}"/>`).join('')}
      <path d="M30 30 L170 30 L110 175 Z" fill="none" stroke="${p[0]}" stroke-width="12" stroke-linejoin="round"/>`
  } else {
    cuerpo = `<rect width="200" height="200" fill="${p[0]}"/>
      <circle cx="55" cy="70" r="34" fill="${p[1]}"/>
      <circle cx="130" cy="130" r="40" fill="${p[2]}" fill-opacity="0.85"/>
      <circle cx="150" cy="55" r="24" fill="${p[3]}"/>
      <path d="M40 150 L55 130 L70 150 Z" fill="${p[3]}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#ffffff"/><g>${cuerpo}</g></svg>`
}

const zonasCategoria = {
  cilindro: new Set([2, 3, 4, 5, 16]),
}

function zonaParaCategoria(catId) {
  const esCilindro = zonasCategoria.cilindro.has(catId)
  if (esCilindro) {
    return { tipo: 'cilindro', x: 0.5, ancho: 0.52, alto: 0.5 }
  }
  return { tipo: 'plana', x: 0.5, ancho: 0.65, alto: 0.6 }
}

async function pngDesdeSvgs() {
  const generados = {}
  for (const seg of segmentos) {
    const svg = svgPatron(seg)
    const buf = await sharp(Buffer.from(svg)).png().toBuffer()
    generados[seg] = buf
  }
  return generados
}

async function asegurarDisenos(pngs) {
  for (const seg of segmentos) {
    const { data: exist } = await supabase
      .from('disenos_catalogo')
      .select('id')
      .eq('nombre', seg)
      .maybeSingle()

    if (exist) continue

    const ruta = `disenos/${seg}.png`
    const up = await supabase.storage.from('mockups').upload(ruta, pngs[seg], {
      contentType: 'image/png',
      upsert: true,
    })
    if (up.error) throw new Error(`subida diseno ${seg}: ${up.error.message}`)
    const urlPublica = `${SUPABASE_URL}/storage/v1/object/public/mockups/${ruta}`
    const ins = await supabase
      .from('disenos_catalogo')
      .insert({ nombre: seg, segmento: seg, archivo_url: urlPublica })
    if (ins.error) throw new Error(`insert diseno ${seg}: ${ins.error.message}`)
  }
  const { data } = await supabase.from('disenos_catalogo').select('*').order('id')
  return data || []
}

async function descargar(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`descarga ${url}: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function roundRectSvg(x, y, w, h, r) {
  return `<svg xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="black"/></svg>`
}

async function estamparPlano(bufProducto, bufDiseno, zona) {
  const meta = await sharp(bufProducto).metadata()
  const ancho = Math.round(meta.width * zona.ancho)
  const alto = Math.round(meta.height * zona.alto)
  const x = Math.round(meta.width * zona.x - ancho / 2)
  const y = Math.round(meta.height * 0.42)

  const diseno = await sharp(bufDiseno)
    .resize(ancho, alto, { fit: 'fill' })
    .png()
    .toBuffer()

  const mascara = await sharp(Buffer.from(roundRectSvg(0, 0, ancho, alto, 26)))
    .resize(ancho, alto)
    .blur(6)
    .png()
    .toBuffer()

  return sharp(bufProducto)
    .composite([
      { input: diseno, top: y, left: x, blend: 'over', premultiplied: false },
      { input: mascara, top: y, left: x, blend: 'dest-in', premultiplied: false },
    ])
    .png()
    .toBuffer()
}

async function estamparCilindro(bufProducto, bufDiseno, zona) {
  const meta = await sharp(bufProducto).metadata()
  const ancho = Math.round(meta.width * zona.ancho)
  const alto = Math.round(meta.height * zona.alto)
  const x0 = Math.round(meta.width * zona.x - ancho / 2)
  const y = Math.round(meta.height * 0.38)

  if (!ancho || !alto) throw new Error('dimensiones de zona no válidas')

  const diseno = await sharp(bufDiseno)
    .resize(ancho, alto, { fit: 'fill' })
    .png()
    .toBuffer()

  const columnas = 13
  const base = Math.max(1, Math.floor(ancho / columnas))
  const lay = []
  for (let i = 0; i < columnas; i++) {
    const izq = Math.min(i * base, Math.max(0, ancho - base))
    const db = await sharp(diseno)
      .extract({ left: izq, top: 0, width: Math.min(base, ancho - izq), height: alto })
      .toBuffer()
    const t = (i / (columnas - 1)) * Math.PI
    const factor = 0.62 + 0.38 * Math.cos(t)
    const anchoRebanada = Math.max(1, Math.round(base * factor))
    const rebanada = await sharp(db)
      .resize({ width: anchoRebanada, height: alto, fit: 'fill' })
      .png()
      .toBuffer()
    lay.push({
      input: rebanada,
      left: x0 + Math.round(i * base + (base - anchoRebanada) / 2),
      top: y,
      blend: 'over',
    })
  }

  return sharp(bufProducto)
    .composite(lay)
    .png()
    .toBuffer()
}

async function subirMockup(productoId, buf) {
  const ruta = `productos/${productoId}/mockup.png`
  const up = await supabase.storage.from('mockups').upload(ruta, buf, {
    contentType: 'image/png',
    upsert: true,
  })
  if (up.error) throw new Error(`subida mockup ${productoId}: ${up.error.message}`)
  return `${SUPABASE_URL}/storage/v1/object/public/mockups/${ruta}`
}

async function main() {
  const limite = Number(process.env.MOCKUP_LIMITE || 0)
  const solo = Number(process.env.MOCKUP_PRODUCTO || 0)

  console.log('Suspendiendo diseños de ejemplo...')
  const pngs = await pngDesdeSvgs()
  const disenos = await asegurarDisenos(pngs)
  console.log(`Diseños listos: ${disenos.length} (${disenos.map((d) => d.nombre).join(', ')})`)

  let q = supabase
    .from('productos')
    .select('id, nombre, categoria_id, imagen_principal, imagen_original')
    .eq('activo', true)
    .is('imagen_mockup', null)
  if (solo) q = q.eq('id', solo)
  const { data: productos, error } = await q.order('id').limit(limite || 100000)
  if (error) throw new Error(`consulta productos: ${error.message}`)
  console.log(`Productos a procesar: ${productos.length}`)

  let ok = 0
  let fallas = 0
  for (const p of productos) {
    if (!p.imagen_principal) {
      fallas++
      continue
    }
    try {
      let bufProducto = await descargar(p.imagen_principal)
      const original = p.imagen_original || p.imagen_principal
      const diseno = disenos[p.id % disenos.length]
      const idx = diseno ? disenos.findIndex((d) => d.id === diseno.id) : -1
      const zona = zonaParaCategoria(p.categoria_id)

      const uriDiseno = diseno.archivo_url
      const bufDiseno = await descargar(uriDiseno)

      bufProducto = await sharp(bufProducto)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()

      const mockup = zona.tipo === 'cilindro'
        ? await estamparCilindro(bufProducto, bufDiseno, zona)
        : await estamparPlano(bufProducto, bufDiseno, zona)

      const url = await subirMockup(p.id, mockup)

      const ups = await supabase
        .from('productos')
        .update({ imagen_mockup: url, imagen_original: original })
        .eq('id', p.id)
      if (ups.error) throw new Error(`update ${p.id}: ${ups.error.message}`)

      if (idx >= 0) {
        await supabase
          .from('diseno_asignacion')
          .upsert({ producto_id: p.id, diseno_id: diseno.id }, { onConflict: 'producto_id' })
      }
      ok++
      if (ok % 50 === 0 || solo) console.log(`  ${ok}/${productos.length} mockups hechos`)
    } catch (e) {
      fallas++
      console.log(`  producto ${p.id} (${p.nombre}): ${e.message}`)
    }
  }
  console.log(`\nRESULTADO: ${ok} mockups generados, ${fallas} fallas`)
}

main().catch((e) => {
  console.error('ERROR GENERAL:', e.message)
  process.exit(1)
})