import { writeFileSync } from 'node:fs'

const BASE = 'https://disershop.com.uy'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const SALIDA = process.env.SALIDA || '/tmp/opencode/diser-productos.json'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchTexto(url, reintentos = 3) {
  for (let i = 0; i < reintentos; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'es-uy,es;q=0.9' }
      })
      if (res.ok) return await res.text()
      if (res.status === 429) { await delay(3000 * (i + 1)); continue }
      if (res.status >= 500) { await delay(1500 * (i + 1)); continue }
      return null
    } catch {
      await delay(1500 * (i + 1))
    }
  }
  return null
}

async function sitemapUrls(url) {
  const xml = await fetchTexto(url)
  if (!xml) return []
  const urls = [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/loc>/g)].map((m) => m[1].trim())
  return urls
}

function parseJsonLd(html) {
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  const salida = { producto: null, rutaCategorias: [] }
  for (const b of bloques) {
    try {
      const dato = JSON.parse(b[1])
      const lista = Array.isArray(dato) ? dato : [dato]
      for (const item of lista) {
        if (item['@type'] === 'Product' && item.offers) {
          const img = Array.isArray(item.image) ? item.image[0] : item.image
          salida.producto = {
            nombre: item.name,
            sku: item.sku || item.mpn || item.model || null,
            marca: item.brand?.name || null,
            descripcion: item.description || null,
            imagen: img || null,
            imagen2: Array.isArray(item.image) ? item.image[1] : null,
            precio: Number(item.offers.price),
            moneda: item.offers.priceCurrency,
            enStock: String(item.offers.availability || '').includes('InStock'),
            url: item.offers.url || null
          }
        }
        if (item['@type'] === 'BreadcrumbList' && item.itemListElement) {
          salida.rutaCategorias = item.itemListElement
            .slice(1)
            .map((e) => (e.item ? e.item.name : e.name))
            .map((n) => n.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
        }
      }
    } catch { /* bloque JSON-LD no parseable: se ignora */ }
  }
  return salida
}

console.log('Obteniendo sitemaps...')
const indexSitemap = await sitemapUrls(`${BASE}/sitemap.xml`)
const sitemapsProductos = indexSitemap.filter((u) => u.includes('sitemap-product'))
let urls = []
for (const s of sitemapsProductos) {
  const u = await sitemapUrls(s)
  urls = urls.concat(u)
  console.log(`  ${s.split('/').pop()}: ${u.length} URLs`)
}
console.log(`Total productos en el sitemap: ${urls.length}`)

const productos = []
let errores = 0
let cola = [...urls]
const trabajadores = 4
let indice = 0

async function trabajador() {
  while (true) {
    const i = indice++
    if (i >= cola.length) return
    const url = cola[i]
    const html = await fetchTexto(url)
    if (!html) { errores++; continue }
    const { producto, rutaCategorias } = parseJsonLd(html)
    if (producto) {
      producto.url = url
      producto.categorias = rutaCategorias
      productos.push(producto)
    } else {
      errores++
    }
    await delay(220)
    if (productos.length % 200 === 0) console.log(`  ...${productos.length}/${urls.length} productos`)
  }
}

await Promise.all(Array.from({ length: trabajadores }, trabajador))

productos.sort((a, b) => a.nombre.localeCompare(b.nombre))
writeFileSync(SALIDA, JSON.stringify(productos, null, 2))
console.log(`OK: ${productos.length} productos parseados, ${errores} errores. Guardado en ${SALIDA}`)