import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { cpSync, existsSync, readFileSync } from 'fs';

const WOW_CORE_ROOT = resolve(__dirname, '../../packages/wow-core');

/**
 * Serves wow-core assets during dev and rewrites paths for production build.
 * In dev: /__wow_core__/classic/dialog.js → packages/wow-core/classic/dialog.js
 * In build: /__wow_core__/classic/dialog.js → ./js/dialog.js (copied by copyClassicScripts)
 *           /__wow_core__/css/dialog.css    → ./css/dialog.css (copied by copyCoreCss)
 */
function serveWowCore() {
  return {
    name: 'serve-wow-core',

    // Dev: serve /__wow_core__/* from filesystem
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/__wow_core__/')) return next();

        const relPath = req.url.replace('/__wow_core__/', '');
        const filePath = resolve(WOW_CORE_ROOT, relPath);

        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const ext = filePath.split('.').pop();
        const mimeTypes = {
          js: 'application/javascript',
          css: 'text/css',
          json: 'application/json'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.end(readFileSync(filePath));
      });
    },

    // Build: rewrite /__wow_core__/ paths in HTML
    transformIndexHtml(html) {
      return html
        .replace(/\/__wow_core__\/classic\//g, './js/')
        .replace(/\/__wow_core__\/css\//g, './css/');
    }
  };
}

/**
 * Copies classic (non-module) scripts to dist/js.
 */
function copyClassicScripts() {
  return {
    name: 'copy-classic-scripts',
    closeBundle() {
      const dest = resolve(__dirname, 'dist/js');
      const appJs = resolve(__dirname, 'js');
      if (existsSync(appJs)) cpSync(appJs, dest, { recursive: true });
      const coreClassic = resolve(WOW_CORE_ROOT, 'classic');
      if (existsSync(coreClassic)) cpSync(coreClassic, dest, { recursive: true });
    }
  };
}

/**
 * Copies shared CSS from wow-core to dist/css.
 */
function copyCoreCss() {
  return {
    name: 'copy-core-css',
    closeBundle() {
      const dest = resolve(__dirname, 'dist/css');
      const coreCss = resolve(WOW_CORE_ROOT, 'css');
      if (existsSync(coreCss)) cpSync(coreCss, dest, { recursive: true });
    }
  };
}

export default defineConfig({
  base: './',

  server: {
    fs: { allow: ['../..'] }
  },

  build: {
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true }
    }
  },

  resolve: {
    alias: {
      '@wow/core': resolve(WOW_CORE_ROOT, 'src')
    }
  },

  plugins: [
    serveWowCore(),
    copyClassicScripts(),
    copyCoreCss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png'
      ],

      manifest: {
        name: 'WOW3 Presentation',
        short_name: 'WOW3',
        description: 'Web-based Presentation Software',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'landscape',
        start_url: './',
        scope: './',
        icons: [
          { src: './icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        categories: ['productivity', 'utilities'],
        file_handlers: [
          { action: './', accept: { 'application/zip': ['.wow3'] } }
        ]
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
});
