import { AutomergeRepoUndoRedo } from "../src";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { getHeads, next } from "@automerge/automerge";

type Data = {
  text: string;
  name: string;
  age: number;
  todos: string[];
};

describe("basic tests", () => {
  let handle: DocHandle<Data>;
  let repo: Repo;

  beforeEach(() => {
    repo = new Repo({
      network: [],
    });

    handle = repo.create({
      text: "The jolly farmer enjoyed harvesting his ripe crop.",
      name: "John",
      age: 30,
      todos: ["buy milk", "walk the dog"],
    });
  });
  test("An undo redo class can be instantiated", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    expect(undoRedo).toBeDefined();
  });

  test("a tracked change can be initiated and a change made to the document", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(handle.docSync().name).toBe("Jane");
  });

  test("when a change is made in a tracked change, the undo stack is formed", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(undoRedo.undos.length).toBe(1);
    expect(undoRedo.canUndo).toBe(true);
  });

  test("a message can be set on a tracked change", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    }, "change name to Jane");

    expect(undoRedo.undos[0].message).toBe("change name to Jane");
  });

  test("a tracked change can be undone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(undoRedo.undos.length).toBe(0);
    expect(undoRedo.canUndo).toBe(false);

    expect(undoRedo.redos.length).toBe(1);
    expect(undoRedo.canRedo).toBe(true);

    expect(handle.docSync().name).toBe("John");
  });

  test("a tracked change can be undone even when another untracked change has been made", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The jolly farmer enjoyed harvesting his ripe crop at the weekend.",
      );
    });

    handle.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The silly farmer enjoyed harvesting his ripe crop at the weekend.",
      );
    });

    undoRedo.undo();
    expect(handle.docSync().text).toBe(
      "The silly farmer enjoyed harvesting his ripe crop.",
    );
  });

  test("a tracked change can be undone even when another untracked change in another branch has been made", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);

    const branch = repo.clone(handle);

    undoRedo.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The jolly farmer enjoyed harvesting his ripe crop at the weekend.",
      );
    });

    branch.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The silly farmer enjoyed harvesting his ripe crop.",
      );
    });

    handle.merge(branch);

    undoRedo.undo();
    expect(handle.docSync().text).toBe(
      "The silly farmer enjoyed harvesting his ripe crop.",
    );
  });

  test("a tracked change can be redone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(handle.docSync().name).toBe("John");

    undoRedo.redo();

    expect(handle.docSync().name).toBe("Jane");

    undoRedo.undo();

    expect(handle.docSync().name).toBe("John");
  });

  test("multiple changes can be undone and redone without rewriting history", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      doc.age = 31;
    });

    undoRedo.change((doc) => {
      doc.todos.push("buy bread");
    });

    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual([
      "buy milk",
      "walk the dog",
      "buy bread",
    ]);

    undoRedo.undo();
    undoRedo.undo();
    undoRedo.undo();

    expect(getHeads(handle.docSync()).length).toEqual(1);

    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(30);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);

    undoRedo.redo();
    undoRedo.redo();
    undoRedo.redo();

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual([
      "buy milk",
      "walk the dog",
      "buy bread",
    ]);

    expect(getHeads(handle.docSync()).length).toEqual(1);
  });
});
