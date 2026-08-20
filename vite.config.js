import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DIDIAL CRM',
        short_name: 'DIDIAL',
        description: 'Gestión comercial · Servicio Automotriz Didial',
        theme_color: '#E73C32',
        background_color: '#0A0B0C',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],

        /* CAUSA DE LA PANTALLA EN BLANCO AL PRIMER INGRESO
           Con `autoUpdate`, tras un despliegue nuevo el service worker seguía
           sirviendo el index.html en caché. Ese HTML pide archivos JS cuyo hash
           ya no existe (Vite renombra en cada build), la carga falla y la
           pantalla queda vacía. Al recargar ya se tomaba el HTML nuevo, de ahí
           que "funcionara a la segunda".

           cleanupOutdatedCaches borra los precachés de versiones anteriores, y
           skipWaiting + clientsClaim hacen que el service worker nuevo tome el
           control de inmediato en vez de esperar a que se cierren las pestañas. */
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        /* El navegador debe revalidar el HTML contra el servidor en cada carga:
           es lo que evita servir un index apuntando a archivos inexistentes. */
        navigateFallbackDenylist: [/^\/api/],

        runtimeCaching: [
          {
            /* index.html siempre desde la red, con la caché solo como respaldo
               si no hay conexión. */
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-navegacion',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10 }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ]
})
