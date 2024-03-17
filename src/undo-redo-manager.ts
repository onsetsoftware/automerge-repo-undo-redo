import { DocHandle, DocumentId } from "@automerge/automerge-repo";
import {
  AutomergeRepoUndoRedo,
  UndoRedoOptions,
  baseStack,
} from "./automerge-repo-undo-redo";

type Change = { description: string | undefined; ids: DocumentId[] };

export class UndoRedoManager {
  #handles: Map<DocumentId, AutomergeRepoUndoRedo<any>> = new Map();

  #undoStack: Record<string | symbol, Change[]> = { [baseStack]: [] };

  #redoStack: Record<string | symbol, Change[]> = { [baseStack]: [] };

  addHandle<T>(handle: DocHandle<T>) {
    this.#handles.set(handle.documentId, new AutomergeRepoUndoRedo(handle));
  }

  getUndoRedoHandle<T>(
    documentId: DocumentId,
  ): AutomergeRepoUndoRedo<T> | undefined {
    return this.#handles.get(documentId);
  }

  transaction(fn: () => string | void, options: UndoRedoOptions<unknown> = {}) {
    const scope = options.scope ?? baseStack;

    this.#handles.forEach((handle) => {
      handle.startTransaction();
    });

    const description = fn() ?? options?.description;

    const results = [...this.#handles]
      .map(([id, handle]) => {
        return handle.endTransaction({ ...options, description }) ? id : null;
      })
      .filter((id): id is DocumentId => id !== null);

    this.#undoStack[scope].push({
      description,
      ids: results,
    });
  }

  undo(scope: string | symbol = baseStack) {
    const change = this.#undoStack[scope].pop();

    if (!change) {
      return;
    }

    change.ids.forEach((id) => {
      const handle = this.#handles.get(id);
      if (handle) {
        handle.undo(scope);
      }
    });

    this.#redoStack[scope].push(change);
  }

  undos(scope: string | symbol = baseStack) {
    return this.#undoStack[scope].map((change) => change.description);
  }

  redo(scope: string | symbol = baseStack) {
    scope = scope ?? baseStack;

    const change = this.#redoStack[scope].pop();

    if (!change) {
      return;
    }

    change.ids.forEach((id) => {
      const handle = this.#handles.get(id);
      if (handle) {
        handle.redo(scope);
      }
    });

    this.#undoStack[scope].push(change);
  }

  redos(scope: string | symbol = baseStack) {
    scope = scope ?? baseStack;

    return this.#redoStack[scope].map((change) => change.description);
  }
}
