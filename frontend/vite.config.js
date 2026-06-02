import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'src',
    resolve: {
        alias: {
            'gridstack': path.resolve(__dirname, 'node_modules/gridstack/dist/gridstack.js'),
        },
    },
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
