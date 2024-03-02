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

export class AutomergeRepoUndoRedo<T> {
  #docHandle: DocHandle<T>;

  #undos: Change[] = [];
  #redos: Change[] = [];

  constructor(docHandle: DocHandle<T>) {
    this.#docHandle = docHandle;
  }

  // TODO: this transaction should start a
  // group of changes which can be undone/redone together
  // rather than just a single change

  transaction(
    changeFn: ChangeFn<T>,
    options?: string | ChangeOptions<T>,
    message?: string
  ) {
    if (typeof options === "string") {
      message = options;
      options = {};
    }

    const patchCallback = (patches: Patch[], patchInfo: PatchInfo<T>) => {
      if (options && typeof options !== "string" && options.patchCallback) {
        options.patchCallback(patches, patchInfo);
      }

      this.#undos.push({
        redo: {
          heads: next.getHeads(patchInfo.after),
          patches,
        },
        undo: {
          heads: next.getHeads(patchInfo.after),
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
      const heads = this.#docHandle.changeAt(change.undo.heads, (doc) => {
        change.undo.patches.forEach((p) => {
          patch<T>(doc, p);
        });
      });

      if (heads) {
        change.redo.heads = heads;
      }

      this.#redos.push(change);
    }
  }

  redo() {
    const change = this.#redos.pop();
    if (change) {
      const heads = this.#docHandle.changeAt(change.redo.heads, (doc) => {
        change.redo.patches.forEach((p) => {
          patch<T>(doc, p);
        });
      });

      if (heads) {
        change.undo.heads = heads;
      }

      this.#undos.push(change);
    }
  }
}
