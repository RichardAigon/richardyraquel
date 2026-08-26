import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Separa las librerías pesadas (gráficos) en su propio archivo, así el
    // navegador puede empezar a mostrar la app mientras eso termina de bajar
    // en paralelo, en vez de esperar un solo archivo gigante.
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
