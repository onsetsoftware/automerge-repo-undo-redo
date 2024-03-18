import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { externalizeDeps } from "vite-plugin-externalize-deps";

const resolvePath = (str: string) => path.resolve(__dirname, str);

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: resolvePath("src/index.ts"),
      name: "AutomergeRepoUndoRedo",
      fileName: `automerge-repo-undo-redo`,
    },
  },
  plugins: [
    externalizeDeps(),
    topLevelAwait(),
    wasm(),
    dts({
      entryRoot: resolvePath("src"),
      outDir: resolvePath("dist/types"),
    }),
  ],
});
