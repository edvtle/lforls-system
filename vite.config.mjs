import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/password-reset": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
    },
  },
});
