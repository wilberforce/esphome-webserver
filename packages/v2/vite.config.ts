import { defineConfig } from "vite";
import gzipPlugin from "rollup-plugin-gzip";
import minifyHTML from "rollup-plugin-minify-html-template-literals";
import { brotliCompressSync } from "zlib";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import loadVersion from "vite-plugin-package-version";
import { viteSingleFile } from "vite-plugin-singlefile";
import { minifyHtml as ViteMinifyHtml } from "vite-plugin-html";
import stripBanner from "rollup-plugin-strip-banner";
import replace from "@rollup/plugin-replace";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  clearScreen: false,
  plugins: [
    {
      ...nodeResolve({ exportConditions: ["development"] }),
      enforce: "pre",
      apply: "start",
    },
    stripBanner(),
    loadVersion(),
    { ...minifyHTML(), enforce: "pre", apply: "build" },
    {
      ...ViteMinifyHtml({ removeComments: true }),
      enforce: "post",
      apply: "build",
    },
    replace({
      "@license": "license",
      "Value passed to 'css' function must be a 'css' function result:":
        "use css function",
      "Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.":
        "Use unsafeCSS",
      delimiters: ["", ""],
      preventAssignment: true,
    }),
    viteSingleFile(),
    {
      ...gzipPlugin({
        filter: /\.(js|css|html|svg)$/,
        additionalFiles: [],
        customCompression: (content) =>
          brotliCompressSync(Buffer.from(content)),
        fileName: ".br",
      }),
      enforce: "post",
      apply: "build",
    },
    {
      ...gzipPlugin({ filter: /\.(js|css|html|svg)$/ }),
      enforce: "post",
      apply: "build",
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        icons: [{
          "src": "logo.svg",
          "sizes": "any"
        }],
      }
    }),
  ],
  build: {
    brotliSize: false,
    // cssCodeSplit: true,
    outDir: "../../_static/v2",
    polyfillModulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: (chunk) => {
          return "vendor";
        }, // create one js bundle,
        chunkFileNames: "[name].js",
        assetFileNames: "www[extname]",
        entryFileNames: "www.js",
      },
    },
  },
  server: {
    host: true,
    port: 5001,
    strictPort: true,
  },
});
