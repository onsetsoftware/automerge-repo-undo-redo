import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

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
    dts({
      entryRoot: resolvePath("src"),
      outDir: resolvePath("dist/types"),
    }),
  ],
});
