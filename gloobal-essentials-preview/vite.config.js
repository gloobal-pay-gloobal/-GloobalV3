import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA setup notes:
// - registerType "autoUpdate": the service worker checks for a new build on
//   every load and swaps it in the next time the app is opened. No "New
//   version available" prompt, but also no silent staleness — which matters
//   here because the whole app is one generated bundle, so a stuck service
//   worker would pin every screen to an old build at once.
// - globPatterns precaches the built JS/CSS/HTML plus the icons, so the app
//   shell works offline after the first visit. The screens' external images
//   (flagcdn, clearbit, the globe texture) are deliberately not precached —
//   they are hundreds of files and none are needed for the shell to boot.
// - The document handler is NetworkFirst so a fresh deploy is picked up as
//   soon as the network allows, falling back to cache when offline.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Gloobal ID",
        short_name: "Gloobal",
        description: "Gloobal ID — international remittance, identity, and wallet.",
        lang: "en",
        dir: "ltr",
        theme_color: "#7C3AED",
        background_color: "#F6F5FC",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        categories: ["finance", "productivity", "utilities"],
        // "any" and "maskable" are separate files on purpose. A maskable
        // icon is cropped to the platform's shape, so it needs its own
        // padded artwork; declaring one image as `any maskable` gets it
        // clipped on Android and letterboxed elsewhere.
        icons: [
          { src: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
          { src: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: { cacheName: "html-cache" },
          },
        ],
      },
      devOptions: {
        // The dev server should serve the app directly. A service worker in
        // front of Vite's HMR just caches modules HMR is trying to replace.
        enabled: false,
      },
    }),
  ],
});
