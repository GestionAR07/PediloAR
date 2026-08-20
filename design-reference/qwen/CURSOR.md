# PEDILO — Brief de frontend (design system + implementación)

## 0. Archivos adjuntos que debés leer antes de tocar código
- `pedilo-reference.html` → **fuente de verdad visual**. Contiene el diseño completo funcionando (HTML+CSS+JS en un solo archivo).
- `tailwind.config.js` → tokens de Tailwind (colores, fuentes, sombras).
- `globals.css` → utilidades custom, gradientes, animaciones.
- `logo.svg` → logo oficial (bolsa + rayo).

## 1. Instrucciones de trabajo
1. Inspeccioná el repo y detectá el stack (Next/React/Vue/Angular/HTML plano).
2. Si no existe frontend, scaffoldeá **Next.js + Tailwind CSS**. Integrá `tailwind.config.js` y `globals.css` (o adaptá los tokens a CSS variables si el proyecto no usa Tailwind).
3. Portá el `pedilo-reference.html` **sección por sección como componentes**, no lo copies monolítico (salvo proyecto HTML plano).
4. Reemplazá los datos mock (arrays `categories` / `restaurants` del reference) por llamadas a la API existente, manteniendo los estados vacíos/carga con el mismo estilo.
5. No cambies colores, tipografías ni radios por defaults del framework. Este brief manda.

## 2. Identidad visual
- Estilo: app de delivery amigable y apetitosa (inspiración PedidosYa/Rappi/UberEats con identidad propia). Gradientes vibrantes, bordes suaves, sombras coloreadas, glassmorphism sobre fondos oscuros. **PROHIBIDO**: brutalism, bordes negros gruesos, hard shadows, estética "web de developer".
- Tipografías: `Sora` (display, pesos 600–800) y `Inter` (cuerpo, 400–700).
- Copy en **es-AR con voseo** ("Pedí", "Elegí", "Recibilo"). No convertir a "tú".

### Tokens
| Token | Valor |
|---|---|
| night.950 / 900 / 800 | `#0b0618` / `#0e0820` / `#171035` |
| cream (fondo claro) | `#FAF8FF` |
| primario | violeta `#7c3aed` → fucsia `#d946ef` → naranja `#f97316` |
| grad-btn | `linear-gradient(135deg,#7c3aed 0%,#d946ef 55%,#f97316 120%)` |
| grad-text | `linear-gradient(90deg,#a78bfa,#f472b6 45%,#fb923c)` |
| sombras | glow (violeta), glowPink, glowOrange, soft (ver config) |
| radios | pills (`rounded-full`) botones/chips; `rounded-2xl/3xl/[2rem]` cards/paneles |
| iconos | **Lucide** (set completo listado en §6) |

### Recetas de componentes (clases base)
- Botón primario: `grad-btn text-white font-bold rounded-full px-6 py-3 shadow-glow`
- Botón secundario: `border-2 border-violet-200 text-violet-700 rounded-full hover:bg-violet-50`
- Card: `bg-white rounded-[1.75rem] border border-violet-100/70 shadow-soft card-lift`
- Chip activo: clase `chip-active` (gradiente violeta→fucsia, texto blanco)
- Input: `rounded-full/2xl bg-white|slate-50 border-2 border-violet-100|slate-200 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100`
- Glass (sobre oscuro): clase `glass`
- Navbar: sticky + clase `nav-blur`
- Tile de categoría: `rounded-[1.6rem] bg-gradient-to-br {gradiente por categoría}` + icono Lucide blanco

## 3. Estructura de la landing (orden exacto)
1. **Marquee** cinta superior (gradiente violeta→fucsia→naranja, texto en loop).
2. **Navbar** sticky glass: logo+wordmark, search (desktop), selector de ubicación, Ingresar/Crear cuenta, carrito con badge.
3. **Hero** oscuro (`night-900` + orbes blur): badge "operando en mi pueblo", H1 Sora con `grad-text`, buscador pill, chips "populares", stats (50+ comercios / 15 min / 4.8★). Derecha: composición circular con foto burger + cards glass flotantes (pedido en camino, rating, pago) + círculo pizza.
4. **Categorías**: scroll horizontal con snap en mobile, grid en desktop.
5. **Promos**: card grande gradiente (envío gratis, código PEDILO) + card oscura (2x1).
6. **Destacados**: chips de filtro + grid de commerce cards (imagen, tags grad, rating, tiempo, envío, corazón favorito).
7. **Cómo funciona**: 3 pasos con tiles gradiente y línea punteada.
8. **App**: sección oscura, bullets + botones stores + mockup phone (clases `phone-frame/phone-screen`).
9. **Expansión**: banner waitlist de ciudades.
10. **Comercios**: CTA B2B oscuro con benefits glass.
11. **Footer** oscuro 4 columnas.
+ **Overlays**: CartDrawer lateral, CommerceModal (bottom-sheet en mobile / centrado en desktop), AuthModal, LocationModal, PartnerModal, Toast.
+ **BottomNav** fija en mobile (<lg) con 5 acciones y botón carrito elevado gradiente.

## 4. Comportamientos obligatorios
- Búsqueda viva (navbar y hero) filtra el grid por nombre/tipo/categoría.
- Filtros por grupo (Todos/Comida/Farmacia/Almacén) + filtro por categoría con pill removible "Filtrando: X".
- Estado vacío de categoría: "Estamos sumando comercios acá" + CTA a partner.
- Favoritos: corazón se llena rosa (`fav-on`).
- Carrito: add/qty+/qty-/remove, badge con bounce, subtotal+envío+total, checkout → toast confirmación y vaciado.
- Modales con animación de entrada/salida (translate+opacity, 300ms) y backdrop blur.
- Toast inferior centrado con icono Lucide, auto-dismiss ~2.8s.
- Scroll-reveal con IntersectionObserver (clase `reveal` → `revealed`).
- Ubicación persistida; se cambia desde navbar o LocationModal (zonas + geolocalización simulada).

## 5. Modelo de datos para conectar al backend
```ts
interface Category { id: string; name: string; icon: string; g: string } // g = gradiente tailwind
interface Product  { id: string; name: string; desc: string; price: number }
interface Commerce { id: string; name: string; group: 'food'|'pharmacy'|'grocery';
  type: string; rating: number; time: string; shipping: string;
  tags: string[]; image: string; products: Product[] }
interface CartItem extends Product { qty: number; commerceId: string; commerceName: string }
```
Mapear a los endpoints reales; formatear precios con `toLocaleString('es-AR')`.

## 6. Iconos Lucide usados
search, map-pin, chevron-down, shopping-bag, x, plus, minus, star, clock, bike, heart, heart-off, check, gift, flame, arrow-right, wallet, radar, badge-percent, credit-card, smartphone, bell-ring, store, trending-up, layout-dashboard, hand-coins, mail, phone, home, tag, circle-user-round, package, alert-triangle, party-popper, rocket, locate-fixed, sparkles + categorías: sandwich, pizza, fish, coffee, salad, chef-hat, pill, shopping-basket, ice-cream-cone, cup-soda.

## 7. Responsive
- Mobile-first. <lg: BottomNav fija (footer con padding extra), categorías/promos/chips en scroll horizontal `no-scrollbar snap-x`, modales como bottom-sheet, safe-area con `pb-safe`.
- Breakpoints sm/md/lg/xl idénticos al reference.

## 8. Accesibilidad / calidad
- `aria-label` en botones de icono, focus visible (ring fuchsia), `alt` en imágenes, fallback `onerror` (fondo gradiente violeta→fucsia + icono store), `loading="lazy"`.

## 9. Despiece sugerido (React/Next)
`layout/`: Navbar, Marquee, BottomNav, Footer · `home/`: Hero, Categories, Promos, FeaturedGrid, CommerceCard, HowItWorks, AppSection, CitiesBanner, PartnerCta · `overlays/`: CartDrawer, CommerceModal, AuthModal, LocationModal, PartnerModal, Toast · `lib/`: types.ts, api.ts · `context/`: CartContext, UiContext.