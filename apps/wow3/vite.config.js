import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { cpSync } from 'fs';

/**
 * Copies classic (non-module) scripts to the dist folder.
 * These scripts use globals and can't be bundled by Vite yet.
 */
function copyClassicScripts() {
  return {
    name: 'copy-classic-scripts',
    closeBundle() {
      const src = resolve(__dirname, 'js');
      const dest = resolve(__dirname, 'dist/js');
      cpSync(src, dest, { recursive: true });
    }
  };
}

export default defineConfig({
  base: './',

  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  plugins: [
    copyClassicScripts(),
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
