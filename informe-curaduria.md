# Informe de Curaduría Comercial del Catálogo (estado final)

**Fecha:** 16/08/2026 · **Catálogo fuente:** Disershop (2.399 importados) · **Eliminación aplicada:** 1.035 productos fuera de rubro borrados de la base (backup: `backups/pre-curaduria-eliminacion.sql`)

---

## 1. Resumen final

- **Productos en la base:** 1364 (100% del rubro: personalizables por sublimación/grabado)
- **Activos (visibles al cliente):** 935
- **Inactivos (sin precio, activo=false):** 429 — se activan cuando tengan precio
- **Con precio y stock (vendibles ya):** 615
- **Stock agotado según web:** 739

## 2. Distribución por categoría propuesta

| Grupo | Subcategoría | Productos |
|---|---|---|
| REGALOS PERSONALIZADOS | Textil | 660 |
| REGALOS PERSONALIZADOS | Regalos | 106 |
| EMPRESAS Y EVENTOS | Promocionales | 104 |
| PAPELERÍA PERSONALIZADA | Otros | 99 |
| REGALOS PERSONALIZADOS | Termos y botellas | 95 |
| REGALOS PERSONALIZADOS | Tazas | 94 |
| REGALOS PERSONALIZADOS | Vasos y bebidas | 55 |
| EMPRESAS Y EVENTOS | Eventos | 49 |
| HOGAR Y DECORACIÓN | Azulejos | 30 |
| EMPRESAS Y EVENTOS | Merchandising | 19 |
| REGALOS PERSONALIZADOS | Llaveros | 17 |
| PAPELERÍA PERSONALIZADA | Cuadernos | 10 |
| REGALOS PERSONALIZADOS | Almohadones | 8 |
| PAPELERÍA PERSONALIZADA | Libretas | 8 |
| HOGAR Y DECORACIÓN | Cuadros | 4 |
| HOGAR Y DECORACIÓN | Decoración | 3 |
| SUBLIMACIÓN | Tazas para sublimar | 2 |
| PAPELERÍA PERSONALIZADA | Agendas | 1 |
| **Total** | | **1364** |

## 3. Duplicados y variantes

- **Variantes legítimas** (mismo modelo en colores/talles): 355 grupos — se mantienen (cada color es un producto).
- **Nombres exactos repetidos**: solo quedan los casos de la sección anterior, todos con color a completar:

| Producto | Ocurrencias | Acción propuesta |
|---|---|---|

## 4. Nombres comerciales

- **26 nombres** tienen corrupción de caracteres (`u00f1` = ñ, `u00b0` = °, etc.) del catálogo del proveedor. Pendiente de corregir en la base (`nombre_comercial` en el CSV adjunto).
- Ejemplos:
  - `Adorno navideu00f1o sublipack x5 corazones 7cm` → `Adorno navideño sublipack x5 corazones 7cm`
  - `Adorno navideu00f1o sublipack x5 estrellas 7cm` → `Adorno navideño sublipack x5 estrellas 7cm`
  - `BUFANDA PEu00d1AROL 145X16 CON FLECOS` → `BUFANDA PEÑAROL 145X16 CON FLECOS`
  - `BUFANDA PEu00d1AROL 16` → `BUFANDA PEÑAROL 16`
  - `CAMISETA NIu00d1O AE NEGRA` → `CAMISETA NIÑO AE NEGRA`
  - `CAMISETA NIu00d1O ALGUIEN AZUL` → `CAMISETA NIÑO ALGUIEN AZUL`

## 5. Pendientes

1. Crear la nueva estructura de categorías (5 grupos + subcategorías de tu taxonomía) y reasignar los productos — espera tu aprobación.
2. Corregir los nombres corruptos (58).
3. Poner precio a los 429 inactivos (mayorista/minorista automáticos) cuando quieras activarlos.
