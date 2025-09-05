/// <reference types="vitest" />

import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), mkcert(), cloudflare()],
    server: {
        cors: true,
    },
    build: {
        assetsInlineLimit: 0, // disable inlining assets since that doesn't work for OBR
        rollupOptions: {
            input: {
                // must have a 'main' entry point
                action: resolve(__dirname, "/src/action/action.html"),
                popoverSettings: resolve(
                    __dirname,
                    "/src/popoverSettings/popoverSettings.html",
                ),
            },
        },
    },
    test: {
        environment: "jsdom",
        includeSource: ["src/**/*.{js,ts}"],
        setupFiles: ["./test/vitest.setup.ts"],
        // For some reason, this package breaks with Vitest unless
        // it's inlined. I've spent too long trying to fix it and run
        // into dependency and configuration hell, so even though this
        // is probably the wrong solution, it works, so it stays :/
        deps: {
            inline: ["owlbear-utils"],
        },
    },
    define: {
        "import.meta.vitest": "undefined",
    },
});
