import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { cpSync, existsSync } from 'fs';

/**
 * Copies classic (non-module) scripts to dist/js.
 * Sources: wow3-specific js/ + shared wow-core/classic/.
 */
function copyClassicScripts() {
  return {
    name: 'copy-classic-scripts',
    closeBundle() {
      const dest = resolve(__dirname, 'dist/js');
      // Copy wow3-specific scripts
      const appJs = resolve(__dirname, 'js');
      if (existsSync(appJs)) cpSync(appJs, dest, { recursive: true });
      // Copy shared classic scripts from wow-core (overwrites if name collides)
      const coreClassic = resolve(__dirname, '../../packages/wow-core/classic');
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
      const coreCss = resolve(__dirname, '../../packages/wow-core/css');
      if (existsSync(coreCss)) cpSync(coreCss, dest, { recursive: true });
    }
  };
}

export default defineConfig({
  base: './',

  server: {
    fs: {
      // Allow Vite dev server to serve files from workspace root
      allow: ['../..']
    }
  },

  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  resolve: {
    alias: {
      '@wow/core': resolve(__dirname, '../../packages/wow-core/src')
    }
  },

  plugins: [
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
          {
            src: './icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: './icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: './icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        categories: ['productivity', 'utilities'],
        file_handlers: [
          {
            action: './',
            accept: {
              'application/zip': ['.wow3']
            }
          }
        ]
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
});
