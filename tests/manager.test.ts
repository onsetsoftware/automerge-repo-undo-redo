import { insertAt, next } from "@automerge/automerge";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { AutomergeRepoUndoRedo, UndoRedoManager, defaultScope } from "../src";
import { Data, State, getHandle, getStateHandle } from "./data";

describe("Manager Tests", () => {
  let handle: DocHandle<Data>;
  let stateHandle: DocHandle<State>;
  let repo: Repo;

  let undoableHandle: AutomergeRepoUndoRedo<Data>;
  let undoableStateHandle: AutomergeRepoUndoRedo<State>;

  let manager: UndoRedoManager;

  beforeEach(() => {
    repo = new Repo({
      network: [],
    });

    handle = getHandle(repo);

    stateHandle = getStateHandle(repo);

    manager = new UndoRedoManager();
    undoableHandle = manager.addHandle(handle);
    undoableStateHandle = manager.addHandle(stateHandle);
  });

  test("A manager can take a plain DocHandle and return an undoable handle", () => {
    expect(undoableHandle).toBeDefined();
    expect(undoableHandle).toBeInstanceOf(AutomergeRepoUndoRedo);
    expect(undoableStateHandle).toBeDefined();
  });

  test("A manager can take an instance of AutomergeRepoUndoRedo and return the same instance", () => {
    const anotherHandle = repo.create();
    const undoableAnotherHandle = new AutomergeRepoUndoRedo(anotherHandle);
    const newHandle = manager.addHandle(undoableAnotherHandle);
    expect(newHandle).toBe(undoableAnotherHandle);
  });

  test("A series of changes in different stores can be batched up into a single transaction", () => {
    const { undo, redo, transaction } = manager;

    transaction(
      () => {
        undoableHandle.change((doc) => {
          next.updateText(
            doc,
            ["text"],
            "The ecstatic farmer enjoyed harvesting his ripe crop.",
          );
        });

        undoableStateHandle.change((doc) => {
          insertAt(doc.selected, 1, 1);
        });
      },
      { description: "Change text and select two items" },
    );

    expect(manager.canUndo()).toBe(true);

    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0, 1]);

    undo();
    expect(handle.docSync().text).toBe(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    );

    expect(stateHandle.docSync().selected).toEqual([0]);

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    redo();
    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );

    expect(stateHandle.docSync().selected).toEqual([0, 1]);
  });

  test("a transaction doesn't have to involve all handles", () => {
    manager.transaction(
      () => {
        undoableHandle.change((doc) => {
          next.updateText(
            doc,
            ["text"],
            "The ecstatic farmer enjoyed harvesting his ripe crop.",
          );
        });
      },
      { description: "Change text" },
    );

    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0]);

    manager.transaction(
      () => {
        undoableStateHandle.change((doc) => {
          insertAt(doc.selected, 1, 1);
        });
      },
      { description: "Select two items" },
    );

    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0, 1]);

    manager.undo();
    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0]);

    manager.undo();
    expect(stateHandle.docSync().selected).toEqual([0]);
    expect(handle.docSync().text).toBe(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    );

    manager.redo();
    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0]);
  });

  test("An empty transaction doesn't add an undo to the stack", () => {
    const changes = manager.transaction(() => {});
    expect(changes).toBeUndefined();
    expect(manager.canUndo()).toBe(false);
  });

  test("A transaction returns the list of changes handles and the scope", () => {
    const changes = manager.transaction(
      () => {
        undoableHandle.change((doc) => {
          next.updateText(
            doc,
            ["text"],
            "The ecstatic farmer enjoyed harvesting his ripe crop.",
          );
        });

        undoableStateHandle.change((doc) => {
          insertAt(doc.selected, 1, 1);
        });
      },
      { description: "Change text and select two items" },
    );

    expect(changes).toEqual({
      scope: defaultScope,
      description: "Change text and select two items",
      ids: [handle.documentId, stateHandle.documentId],
    });
  });

  test("A transaction which is undone, sets the redo stack. A followind change clears the redo stack", () => {
    manager.transaction(
      () => {
        undoableHandle.change((doc) => {
          next.updateText(
            doc,
            ["text"],
            "The ecstatic farmer enjoyed harvesting his ripe crop.",
          );
        });

        undoableStateHandle.change((doc) => {
          insertAt(doc.selected, 1, 1);
        });
      },
      { description: "Change text and select two items" },
    );

    manager.undo();

    expect(manager.canRedo()).toBe(true);

    manager.transaction(
      () => {
        undoableHandle.change((doc) => {
          next.updateText(
            doc,
            ["text"],
            "The ecstatic farmer enjoyed harvesting his ripe crop.",
          );
        });

        undoableStateHandle.change((doc) => {
          insertAt(doc.selected, 1, 1);
        });
      },
      { description: "Change text and select two items" },
    );

    expect(manager.canRedo()).toBe(false);
  });

  test.todo(
    "check that a transaction is closed if an error is thrown in the transaction function",
  );

  test.todo("if an undo produces no patches, do the next one");
});
