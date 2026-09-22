# Viora Landing Page

Landing page pública de **Viora**, plataforma SaaS B2B de ArcadiaDevs para la gestión de la vecería (alternancia productiva) del olivo en el sur del Perú.

- **Stack:** HTML5, CSS3 y JavaScript (ES modules) empaquetados con Vite
- **Motion:** GSAP (ScrollTrigger, SplitText), Lenis y Three.js (carga diferida)
- **Despliegue:** Vercel (sitio estático, salida en `dist/`)
- **Idiomas:** Español (predeterminado) e Inglés
- **Diseño:** [Figma — Viora202602_Landing-Page](https://www.figma.com/design/MLkFDnRX3jcUlbqxL0CIOp/Viora202602_Landing-Page) (Desktop 1440 · Mobile 393)

## Scripts

```bash
npm install
npm run dev           # servidor de desarrollo
npm run build         # build de producción en dist/
npm run preview       # previsualiza el build
npm run lint          # ESLint
npm run format        # Prettier
```

Requiere Node 20+ (ver `.nvmrc`). Las fuentes con licencia se agregan en `public/fonts` (ver su README).

## Estructura

```
index.html                 Landing (entrada principal)
legal/                     Términos y privacidad (entradas secundarias)
public/                    Archivos servidos tal cual (fuentes, favicon, OG)
src/
├── main.js                Entrada de la landing
├── legal.js               Entrada de las páginas legales (sin motion)
├── app/App.js             Ciclo de vida: init y destroy de todas las capas
├── config/                Breakpoints y tokens de motion (espejo de tokens.css)
├── core/                  Infraestructura: GSAP + plugins, Lenis sincronizado
├── directives/            Comportamientos declarativos por data-attribute
├── effects/               Efectos WebGL/Three.js cargados bajo demanda
├── components/            UI reutilizable (header, menú, video...)
├── sections/              Un controlador por sección de la landing
├── i18n/                  Traducción en vivo + locales es/en
├── utils/                 Helpers puros (dom, math, mount)
├── assets/                Imágenes e íconos procesados por Vite
└── styles/
    ├── main.css           Orden de cascade layers
    ├── settings/          Tokens (colores Figma `--viora-*`, escala fluida) y fuentes
    ├── base/              Reset, tipografía y estilos globales
    ├── layout/            Container, section y grid 4/8/12
    ├── components/        Un archivo por componente
    ├── sections/          Un archivo por sección
    └── utilities/         Helpers y estados iniciales de motion
```

### Convenciones

- **Módulos** (`components`, `sections`, `directives`): cada uno exporta `{ selector, mount(element) }` y `mount` puede devolver una función de limpieza. Se registran en el `index.js` de su carpeta.
- **Directivas disponibles:**
  - `data-reveal="up|fade"` (+ `data-reveal-delay`): aparición al entrar en viewport
  - `data-split="lines|words|chars"`: revelado de texto con máscara (SplitText)
  - `data-parallax="0.2"`: desplazamiento vertical ligado al scroll
- **Efectos WebGL:** `<div data-effect="nombre">` + loader en `src/effects/index.js`; la escena extiende `WebGLStage`.
- **i18n:** `data-i18n`, `data-i18n-html`, `data-i18n-attr="atributo:clave"` y botones `data-locale-switch="es|en"`.
- **Responsive:** los tokens fluidos interpolan entre los frames de Figma (393 → 1440) con `clamp()`; breakpoints en 600 y 840 px.
- **Accesibilidad:** todo el motion se desactiva con `prefers-reduced-motion` y el contenido es visible sin JavaScript.

## Flujo de trabajo (GitFlow)

- `main`: producción
- `develop`: integración de ramas terminadas
- `feature/<section-name>`: desarrollo por sección (en inglés)

Commits: `type(scope): message` en inglés y en minúsculas.
