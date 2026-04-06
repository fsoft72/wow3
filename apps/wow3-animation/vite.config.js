import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { cpSync, existsSync } from 'fs';

/**
 * Copies classic global scripts from wow-core to dist/js/.
 */
function copyClassicScripts() {
  return {
    name: 'copy-classic-scripts',
    closeBundle() {
      const dest = resolve(__dirname, 'dist/js');
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
    fs: { allow: ['../..'] },
    port: 5174
  },

  build: {
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true }
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
      manifest: {
        name: 'WOW3 Animation Editor',
        short_name: 'WOW3-A',
        description: 'Timeline-based Presentation Editor',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: './icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ]
});
