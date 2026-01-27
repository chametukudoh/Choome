import { defineConfig } from 'vite';

const externalPackages = new Set([
  'electron',
  'electron-squirrel-startup',
  'electron-store',
  '@ffmpeg-installer/ffmpeg',
  'fluent-ffmpeg',
  'path',
  'fs',
  'node:path',
  'node:fs',
]);

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: (source) => {
        if (externalPackages.has(source)) {
          return true;
        }
        if (source.startsWith('node:')) {
          return true;
        }
        if (source.startsWith('@ffmpeg-installer/')) {
          return true;
        }
        return false;
      },
    },
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
  },
});
