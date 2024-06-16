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
  description?: string;
};

export type UndoRedoOptions<T> = ChangeOptions<T> & {
  description?: string;
  scope?: string;
};

const equalArrays = (a: any[], b: any[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export const defaultScope = Symbol("baseStack");

export class AutomergeRepoUndoRedo<T> {
  #docHandle: DocHandle<T>;

  get handle() {
    return this.#docHandle;
  }

  #stacks: Record<string | symbol, { undos: Change[]; redos: Change[] }> = {
    [defaultScope]: { undos: [], redos: [] },
  };

  constructor(docHandle: DocHandle<T>) {
    this.#docHandle = docHandle;
  }

  #isTransaction = false;

  #changeStack: ChangeFn<T>[] = [];

  transaction(fn: () => string | void, options: UndoRedoOptions<T> = {}) {
    this.startTransaction();
    const description = fn() ?? options?.description;
    return this.endTransaction({ ...options, description });
  }

  startTransaction() {
    if (this.#isTransaction) {
      throw new Error("Already in a transaction");
    }

    this.#isTransaction = true;
    this.#changeStack = [];
  }

  endTransaction(options: UndoRedoOptions<T> = {}) {
    this.#isTransaction = false;

    return this.change((doc) => {
      this.#changeStack.forEach((change) => {
        change(doc);
      });
    }, options);
  }

  change(changeFn: ChangeFn<T>, options: string | UndoRedoOptions<T> = {}) {
    if (this.#isTransaction) {
      this.#changeStack.push(changeFn);
      return;
    }

    const scope =
      typeof options === "object" && options?.scope
        ? options.scope
        : defaultScope;

    const stack = this.getStack(scope);

    let ps = [];

    const patchCallback = (patches: Patch[], patchInfo: PatchInfo<T>) => {
      if (options && typeof options !== "string" && options.patchCallback) {
        options.patchCallback(patches, patchInfo);
      }

      ps = patches;

      stack.undos.push({
        redo: {
          heads: next.getHeads(patchInfo.before),
          patches,
        },
        undo: {
          heads: next.getHeads(patchInfo.after),
          patches: unpatchAll(patchInfo.before, patches),
        },
        description:
          typeof options === "string" ? options : options.description,
      });

      stack.redos = [];
    };

    this.#docHandle.change(changeFn, {
      ...(typeof options === "string" ? {} : options),
      patchCallback,
    });

    return ps.length > 0;
  }

  canUndo(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    return stack.undos.length > 0;
  }

  canRedo(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    return stack.redos.length > 0;
  }

  undos(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    return stack.undos;
  }

  redos(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    return stack.redos;
  }

  undo(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    const change = stack.undos.pop();
    if (change) {
      const doc = this.#docHandle.docSync();
      let heads = next.getHeads(doc!);
      if (doc && equalArrays(heads, change.undo.heads)) {
        this.#docHandle.change((doc) => {
          change.undo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        const after = this.#docHandle.docSync();
        const afterHeads = next.getHeads(after!);

        if (stack.undos.length > 0) {
          const nextUndo = stack.undos[stack.undos.length - 1];

          if (equalArrays(nextUndo.undo.heads, change.redo.heads)) {
            nextUndo.undo.heads = afterHeads;
          }
        }

        change.redo.heads = afterHeads;
      } else {
        const before = this.#docHandle.docSync()!;
        const heads = this.#docHandle.changeAt(change.undo.heads, (doc) => {
          change.undo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        if (heads) {
          const patches = next.diff(
            this.#docHandle.docSync()!,
            change.undo.heads,
            heads,
          );

          // change.redo.patches = unpatchAll(before, patches);
          change.redo.heads = heads;
        }
      }

      stack.redos.push(change);
    }
  }

  redo(scope: string | symbol = defaultScope) {
    const stack = this.getStack(scope);
    const change = stack.redos.pop();
    if (change) {
      const doc = this.#docHandle.docSync();
      let heads = next.getHeads(doc!);
      if (doc && equalArrays(heads, change.redo.heads)) {
        this.#docHandle.change((doc) => {
          change.redo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        const after = this.#docHandle.docSync();
        const afterHeads = next.getHeads(after!);

        if (stack.redos.length > 0) {
          const nextRedo = stack.redos[stack.redos.length - 1];

          if (equalArrays(nextRedo.redo.heads, change.undo.heads)) {
            nextRedo.redo.heads = afterHeads;
          }
        }

        change.undo.heads = afterHeads;
      } else {
        const heads = this.#docHandle.changeAt(change.redo.heads, (doc) => {
          change.redo.patches.forEach((p) => {
            patch<T>(doc, p);
          });
        });

        if (heads) {
          if (stack.redos.length > 0) {
            const nextRedo = stack.redos[stack.redos.length - 1];
            nextRedo.redo.heads = heads;
          }
          change.undo.heads = heads;
        }
      }

      stack.undos.push(change);
    }
  }

  private getStack(scope: string | symbol) {
    if (!this.#stacks[scope]) {
      this.#stacks[scope] = { undos: [], redos: [] };
    }

    return this.#stacks[scope];
  }
}
