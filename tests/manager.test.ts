import { insertAt, next } from "@automerge/automerge";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { AutomergeRepoUndoRedo, UndoRedoManager } from "../src";
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
    manager.addHandle(handle);
    manager.addHandle(stateHandle);

    undoableHandle = manager.getUndoRedoHandle(handle.documentId)!;
    undoableStateHandle = manager.getUndoRedoHandle(stateHandle.documentId)!;
  });

  test("A series of changes in different stores can be batched up into a single transaction", () => {
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

    expect(handle.docSync().text).toBe(
      "The ecstatic farmer enjoyed harvesting his ripe crop.",
    );
    expect(stateHandle.docSync().selected).toEqual([0, 1]);

    manager.undo();
    expect(handle.docSync().text).toBe(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    );

    expect(stateHandle.docSync().selected).toEqual([0]);

    manager.redo();
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
});
