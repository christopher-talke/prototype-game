/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@ai': path.resolve(__dirname, 'src/ai'),
            '@orchestration': path.resolve(__dirname, 'src/orchestration'),
            '@simulation': path.resolve(__dirname, 'src/simulation'),
            '@rendering': path.resolve(__dirname, 'src/rendering'),
            '@net': path.resolve(__dirname, 'src/net'),
            '@ui': path.resolve(__dirname, 'src/ui'),
            '@audio': path.resolve(__dirname, 'src/audio'),
            '@config': path.resolve(__dirname, 'src/config'),
            '@maps': path.resolve(__dirname, 'src/maps'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@editor': path.resolve(__dirname, 'src/editor'),
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                editor: path.resolve(__dirname, 'editor.html'),
            },
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
    },
});
