import { AutomergeRepoUndoRedo } from "../src";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { next } from "@automerge/automerge";

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

  test("a transaction can be initiated and a change made to the document", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(handle.docSync().name).toBe("Jane");
  });

  test("when a change is made in a transaction, the undo stack is formed", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(undoRedo.undos.length).toBe(1);
    expect(undoRedo.canUndo).toBe(true);
  });

  test("a message can be set on a transaction", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
      next.updateText(doc, ["name"], "Jane");
    }, "change name to Jane");

    expect(undoRedo.undos[0].message).toBe("change name to Jane");
  });

  test("a transaction can be undone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(undoRedo.undos.length).toBe(0);
    expect(undoRedo.canUndo).toBe(false);

    expect(undoRedo.redos.length).toBe(1);
    expect(undoRedo.canRedo).toBe(true);

    expect(handle.docSync().name).toBe("John");
  });

  test("a transaction can be undone even when another change has been made", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
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

  test("a transaction can be undone even when another change in another branch", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);

    const branch = repo.clone(handle);

    undoRedo.transaction((doc) => {
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

  test("a transaction can be redone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(handle.docSync().name).toBe("John");

    undoRedo.redo();

    expect(handle.docSync().name).toBe("Jane");

    undoRedo.undo();

    expect(handle.docSync().name).toBe("John");
  });
});
