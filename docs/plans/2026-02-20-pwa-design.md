# PWA Design for WOW3

**Date**: 2026-02-20
**Status**: Approved

## Goal

Make WOW3 installable as a desktop/mobile app with full offline support via Progressive Web App (PWA) standards.

## Design

### 1. Web App Manifest (`manifest.json`)

At project root:
- **name**: "WOW3 Presentation"
- **short_name**: "WOW3"
- **display**: `standalone`
- **theme_color / background_color**: `#1a1a2e`
- **start_url**: `/`
- **icons**: User-provided PNGs in `icons/` directory (192x192, 512x512, 180x180 apple-touch-icon)

### 2. Service Worker (`sw.js`)

Cache-first strategy with versioned cache:
- **Install**: Pre-cache all local files (HTML, CSS, JS) plus CDN resources (MaterializeCSS, Google Fonts, JSZip, html2canvas, Material Icons)
- **Fetch**: Cache-first, network fallback
- **Activate**: Clean up old cache versions
- **Version**: `CACHE_VERSION` constant for cache busting on deploy

### 3. index.html Updates

- `<link rel="manifest" href="manifest.json">`
- `<meta name="theme-color" content="#1a1a2e">`
- Apple PWA meta tags
- Service worker registration script

### 4. Icons

`icons/` directory with placeholder SVG until user provides PNG files:
- `icon-192x192.png`
- `icon-512x512.png`
- `apple-touch-icon.png` (180x180)
