import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") === -1) {
            return;
          }

          if (
            id.indexOf("@react-three/drei") !== -1
          ) {
            return "drei-vendor";
          }

          if (id.indexOf("@react-three/fiber") !== -1) {
            return "fiber-vendor";
          }

          if (
            id.indexOf("/three/") !== -1 ||
            id.indexOf("\\three\\") !== -1
          ) {
            return "three-core";
          }

          if (id.indexOf("lottie-web") !== -1) {
            return "lottie-vendor";
          }

          if (
            id.indexOf("react") !== -1 ||
            id.indexOf("scheduler") !== -1 ||
            id.indexOf("lucide-react") !== -1 ||
            id.indexOf("@radix-ui/") !== -1
          ) {
            return "app-vendor";
          }
        },
      },
    },
  },
});
