import {
  next,
  type ChangeFn,
  type ChangeOptions,
  type Patch,
  type PatchInfo,
} from "@automerge/automerge";
import { type DocHandle } from "@automerge/automerge-repo";
import { patch, unpatchAll } from "@onsetsoftware/automerge-patcher";

type Change = {
  undo: { heads: string[]; patches: Patch[] };
  redo: { heads: string[]; patches: Patch[] };
  message?: string;
};

const equalArrays = (a: any[], b: any[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export class AutomergeRepoUndoRedo<T> {
  #docHandle: DocHandle<T>;

  #lastTrackedHeads: string[] = [];

  get handle() {
    return this.#docHandle;
  }

  #undos: Change[] = [];
  #redos: Change[] = [];

  constructor(docHandle: DocHandle<T>) {
    this.#docHandle = docHandle;
  }

  change(
    changeFn: ChangeFn<T>,
    options?: string | ChangeOptions<T>,
    message?: string,
  ) {
    if (typeof options === "string") {
      message = options;
      options = {};
    }

    const patchCallback = (patches: Patch[], patchInfo: PatchInfo<T>) => {
      if (options && typeof options !== "string" && options.patchCallback) {
        options.patchCallback(patches, patchInfo);
      }

      this.#lastTrackedHeads = next.getHeads(patchInfo.after);

      this.#undos.push({
        redo: {
          heads: next.getHeads(patchInfo.after),
          patches,
        },
        undo: {
          heads: this.#lastTrackedHeads,
          patches: unpatchAll(patchInfo.before, patches),
        },
        message,
      });
    };

    this.#docHandle.change(changeFn, { ...options, patchCallback });
  }

  get canUndo() {
    return this.#undos.length > 0;
  }

  get canRedo() {
    return this.#redos.length > 0;
  }

  get undos() {
    return this.#undos;
  }

  get redos() {
    return this.#redos;
  }

  undo() {
    const change = this.#undos.pop();
    if (change) {
      const doc = this.#docHandle.docSync();
      if (doc && equalArrays(next.getHeads(doc), this.#lastTrackedHeads)) {
        this.#docHandle.change((doc) => {
          change.undo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        const after = this.#docHandle.docSync();
        this.#lastTrackedHeads = next.getHeads(after!);
      } else {
        const heads = this.#docHandle.changeAt(change.undo.heads, (doc) => {
          change.undo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        if (heads) {
          change.redo.heads = heads;
        }
      }

      this.#redos.push(change);
    }
  }

  redo() {
    const change = this.#redos.pop();
    if (change) {
      const doc = this.#docHandle.docSync();
      if (doc && equalArrays(next.getHeads(doc), this.#lastTrackedHeads)) {
        this.#docHandle.change((doc) => {
          change.redo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        const after = this.#docHandle.docSync();
        this.#lastTrackedHeads = next.getHeads(after!);
      } else {
        const heads = this.#docHandle.changeAt(change.redo.heads, (doc) => {
          change.redo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        if (heads) {
          change.undo.heads = heads;
        }
      }

      this.#undos.push(change);
    }
  }
}
