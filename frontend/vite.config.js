import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: 'src',
    resolve: {
        alias: {
            'gridstack': path.resolve(__dirname, 'node_modules/gridstack/dist/gridstack.js'),
        },
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            devOptions: { enabled: true },
            manifest: {
                name: 'HotspotMgr',
                short_name: 'HotspotMgr',
                description: 'MikroTik Hotspot Management',
                theme_color: '#0d1117',
                background_color: '#07090f',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                    { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                runtimeCaching: [{
                    urlPattern: /^\/api\//,
                    handler: 'NetworkFirst',
                    options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 300 } }
                }]
            }
        })
    ],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
});
