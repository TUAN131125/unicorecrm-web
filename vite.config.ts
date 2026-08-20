import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Use root-relative assets for the current static deployment contract.
    base: "/",

    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },

    server: {
      // CI or constrained development environments may disable HMR explicitly.
      hmr: process.env.DISABLE_HMR !== 'true',

      // Disable file watching together with HMR to reduce unnecessary CPU usage.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    build: {
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router')) return 'vendor-react';
            if (id.includes('/node_modules/motion/')) return 'vendor-motion';
            if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) return 'vendor-charts';
            if (id.includes('/src/platform/api/catalog/')) return 'api-catalog';
            if (id.includes('/src/platform/api/contracts/')) return 'api-contracts';
            if (id.includes('/src/platform/api/generated/')) return 'api-generated';
            if (id.includes('/src/i18n/translations/') || id.includes('/src/i18n/legacyUiCopy')) return 'product-language';
            if (id.includes('/src/guidance/')) return 'product-guidance';
          },
        },
      },
    },
  };
});
