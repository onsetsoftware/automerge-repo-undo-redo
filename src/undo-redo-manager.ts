import type { DocHandle, DocumentId } from "@automerge/automerge-repo";
import {
  AutomergeRepoUndoRedo,
  UndoRedoOptions,
  defaultScope,
} from "./automerge-repo-undo-redo";

type Change = { description: string | undefined; ids: DocumentId[] };

export class UndoRedoManager {
  #handles: Map<DocumentId, AutomergeRepoUndoRedo<any>> = new Map();

  #undoStack: Record<string | symbol, Change[]> = { [defaultScope]: [] };

  #redoStack: Record<string | symbol, Change[]> = { [defaultScope]: [] };

  addHandle<T>(handle: DocHandle<T> | AutomergeRepoUndoRedo<T>) {
    const undoableHandle =
      handle instanceof AutomergeRepoUndoRedo
        ? handle
        : new AutomergeRepoUndoRedo(handle);
    this.#handles.set(undoableHandle.handle.documentId, undoableHandle);

    return undoableHandle;
  }

  getUndoRedoHandle<T>(
    documentId: DocumentId,
  ): AutomergeRepoUndoRedo<T> | undefined {
    return this.#handles.get(documentId);
  }

  #transaction(
    fn: () => string | void,
    options: UndoRedoOptions<unknown> = {},
  ) {
    this.startTransaction();

    const description = fn() ?? options?.description;

    return this.endTransaction({ ...options, description });
  }

  get transaction() {
    return this.#transaction.bind(this);
  }

  startTransaction() {
    this.#handles.forEach((handle) => {
      handle.startTransaction();
    });
  }

  endTransaction(options: UndoRedoOptions<unknown> = {}) {
    const scope = options.scope ?? defaultScope;

    const results = [...this.#handles]
      .map(([id, handle]) => {
        return handle.endTransaction(options) ? id : null;
      })
      .filter((id): id is DocumentId => id !== null);

    if (results.length === 0) {
      return;
    }

    this.#undoStack[scope].push({
      description: options.description,
      ids: results,
    });

    this.#redoStack[scope] = [];

    return {
      description: options.description,
      ids: results,
      scope,
    };
  }

  #undo(scope: string | symbol = defaultScope) {
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

    return { ...change, scope };
  }

  get undo() {
    return this.#undo.bind(this);
  }

  undos(scope: string | symbol = defaultScope) {
    return this.#undoStack[scope].map((change) => change.description);
  }

  #redo(scope: string | symbol = defaultScope) {
    scope = scope ?? defaultScope;

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

    return { ...change, scope };
  }

  get redo() {
    return this.#redo.bind(this);
  }

  redos(scope: string | symbol = defaultScope) {
    scope = scope ?? defaultScope;

    return this.#redoStack[scope].map((change) => change.description);
  }

  canUndo(scope: string | symbol = defaultScope) {
    return this.#undoStack[scope].length > 0;
  }

  canRedo(scope: string | symbol = defaultScope) {
    return this.#redoStack[scope].length > 0;
  }
}
