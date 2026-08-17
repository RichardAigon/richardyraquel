import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Separa las librerías pesadas (gráficos, Firebase) en archivos propios,
    // así el navegador puede empezar a mostrar la app mientras esos terminan
    // de bajar en paralelo, en vez de esperar un solo archivo gigante.
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          firebase: ["firebase/app", "firebase/firestore"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
