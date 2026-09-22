# Viora Landing Page

Landing page pública de **Viora**, plataforma SaaS B2B de ArcadiaDevs para la gestión de la vecería (alternancia productiva) del olivo en el sur del Perú.

- **Tipo:** sitio estático de una sola página (SPA). Sin navegación entre páginas; los documentos legales se abren como diálogos.
- **Stack:** HTML5, CSS3 y JavaScript (ES modules) empaquetados con Vite
- **Motion:** GSAP (ScrollTrigger, SplitText), Lenis y Three.js (carga diferida)
- **Despliegue:** Vercel con integración Git (salida en `dist/`)
- **Idiomas:** English (en-US, predeterminado) y Español (es-419)
- **Diseño:** [Figma — Viora202602_Landing-Page](https://www.figma.com/design/MLkFDnRX3jcUlbqxL0CIOp/Viora202602_Landing-Page) (Desktop 1440 · Mobile 393)

## Scripts

```bash
npm install
npm run dev            # servidor de desarrollo
npm run build          # build de producción en dist/
npm run preview        # previsualiza el build
npm run lint           # ESLint + Stylelint + html-validate
npm run format         # Prettier
```

Requiere Node 22 (ver `.nvmrc`). Las fuentes con licencia se publican solo como `.woff2` (ver `public/fonts/README.md`).

## Estructura

```
index.html                 Única página: secciones + diálogos legales
public/                    Archivos servidos tal cual (fuentes, favicon, OG)
src/
├── main.js                Entrada de la aplicación
├── app/App.js             Ciclo de vida: init y destroy de todas las capas
├── config/                Breakpoints y tokens de motion (espejo de tokens.css)
├── core/                  Infraestructura: GSAP + plugins, Lenis sincronizado
├── directives/            Comportamientos declarativos por data-attribute
├── effects/               Efectos WebGL/Three.js cargados bajo demanda
├── components/            UI reutilizable (legal-dialog, header, menú...)
├── sections/              Un controlador por sección de la landing
├── i18n/                  Traducción en vivo + locales en/es
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
.github/workflows/         CI: lint y build en Pull Requests
```

## Convenciones

- **Nomenclatura:** todo el código en inglés. HTML en minúsculas con comillas dobles y elementos semánticos; CSS con **BEM en kebab-case** (`.block__element--modifier`), una propiedad por línea y sin selectores `#id` para estilos (validado por Stylelint).
- **Módulos** (`components`, `sections`, `directives`): cada uno exporta `{ selector, mount(element) }` y `mount` puede devolver una función de limpieza. Se registran en el `index.js` de su carpeta.
- **Directivas disponibles:**
  - `data-reveal="up|fade"` (+ `data-reveal-delay`): aparición al entrar en viewport
  - `data-split="lines|words|chars"`: revelado de texto con máscara (SplitText)
  - `data-parallax="0.2"`: desplazamiento vertical ligado al scroll
- **Efectos WebGL:** `<div data-effect="nombre">` + loader en `src/effects/index.js`; la escena extiende `WebGLStage`.
- **i18n:** `data-i18n`, `data-i18n-html`, `data-i18n-attr="atributo:clave"` y botones `data-locale-switch="en|es"`. Inglés por defecto; español si el navegador lo prefiere; la elección manual se guarda en `localStorage`.
- **Diálogos legales:** `<a href="#terms">` / `<a href="#privacy">` abren el `<dialog>` correspondiente; el enlace directo también funciona y Atrás lo cierra.
- **Responsive:** los tokens fluidos interpolan entre los frames de Figma (393 → 1440) con `clamp()`; breakpoints en 600 y 840 px.
- **Accesibilidad:** atributos ARIA, foco gestionado en anclas y diálogos, y todo el motion se desactiva con `prefers-reduced-motion`.

## Flujo de trabajo (GitFlow)

- `main`: producción, cada merge lleva tag `vX.Y.Z` (Semantic Versioning 2.0.0)
- `develop`: integración de ramas terminadas
- `feature/<name>`: desarrollo por sección, nace y vuelve a `develop`
- `release/vX.Y.Z` y `hotfix/<description>`: estabilización y correcciones urgentes

Commits con [Conventional Commits 1.0.0](https://www.conventionalcommits.org): `type(scope): description` en inglés, minúsculas e imperativo. Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## CI/CD

- **Despliegue:** el repositorio está conectado a Vercel. Cada push a `main` publica producción y las demás ramas generan previews. No requiere secretos.
- **`ci.yml`:** en cada Pull Request hacia `develop`/`main` y en cada push a `develop`, ejecuta lint, verificación de formato y build.
