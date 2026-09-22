# Brand fonts

Axiforma and The Foriene Serif are licensed fonts. Only the `.woff2` builds used by the
design are published here; the original `.ttf` / `.otf` files live in `design/fonts/`
(git-ignored) and are never deployed.

```
axiforma/axiforma-light.woff2      300
axiforma/axiforma-book.woff2       350
axiforma/axiforma-regular.woff2    400
axiforma/axiforma-medium.woff2     500
axiforma/axiforma-semibold.woff2   600
axiforma/axiforma-bold.woff2       700
foriene-serif/foriene-serif-regular.woff2
foriene-serif/foriene-serif-italic.woff2
```

To add a weight: convert it with `fontTools` (`TTFont(src).flavor = 'woff2'`) and declare it
in `src/styles/settings/fonts.css`. Playfair Display comes from `@fontsource-variable/playfair-display`.
