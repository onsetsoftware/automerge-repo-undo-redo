import { next } from "@automerge/automerge";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { AutomergeRepoUndoRedo } from "../src";
import { Data, getHandle } from "./data";

describe("basic tests", () => {
  let handle: DocHandle<Data>;
  let repo: Repo;

  beforeEach(() => {
    repo = new Repo({
      network: [],
    });

    handle = getHandle(repo);
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

  test("a change returns true if a change has been made", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    const result = undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(result).toBe(true);

    const result2 = undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(result2).toBe(false);
  });

  test("a change can take a patch callback", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    return new Promise((resolve) => {
      undoRedo.change(
        (doc) => {
          next.updateText(doc, ["name"], "Jane");
        },
        {
          patchCallback: (patches) => {
            resolve(patches);
          },
        },
      );
    });
  });

  test("when a change is made in a tracked change, the undo stack is formed", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(undoRedo.undos().length).toBe(1);
    expect(undoRedo.canUndo()).toBe(true);
  });

  test("a description can be set on a tracked change", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change(
      (doc) => {
        next.updateText(doc, ["name"], "Jane");
      },
      { description: "change name to Jane" },
    );

    expect(undoRedo.undos()[0].description).toBe("change name to Jane");
  });

  test("a tracked change can be undone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(undoRedo.undos().length).toBe(0);
    expect(undoRedo.canUndo()).toBe(false);

    expect(undoRedo.redos().length).toBe(1);
    expect(undoRedo.canRedo()).toBe(true);

    expect(handle.docSync().name).toBe("John");
  });

  test("a change following an undo resets the redo stack", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.undo();

    expect(undoRedo.canRedo()).toBe(true);

    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    expect(undoRedo.redos().length).toBe(0);
    expect(undoRedo.canRedo()).toBe(false);
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
        "The elated farmer enjoyed harvesting his ripe crop at the weekend.",
      );
    });

    undoRedo.undo();
    expect(next.getHeads(handle.docSync()).length).toBe(2);
    expect(handle.docSync().text).toBe(
      "The elated farmer enjoyed harvesting his ripe crop.",
    );
  });

  test("a tracked change can be undone at the head of the document even when another untracked change has been made", () => {
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
        "The elated farmer enjoyed harvesting his ripe crop at the weekend.",
      );
    });

    undoRedo.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The elated farmer enjoyed reaping his ripe crop at the weekend.",
      );
    });

    undoRedo.undo();
    // this should have been applied to the head of the document, so we have one head
    expect(next.getHeads(handle.docSync()).length).toBe(1);
    expect(handle.docSync().text).toBe(
      "The elated farmer enjoyed harvesting his ripe crop at the weekend.",
    );

    undoRedo.undo();
    // there has been an untracked change here, so the history has been rewritten
    expect(next.getHeads(handle.docSync()).length).toBe(2);
    expect(handle.docSync().text).toBe(
      "The elated farmer enjoyed harvesting his ripe crop.",
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

  test("local undo + global redo", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      doc.name = "Jane";
    });

    undoRedo.change((doc) => {
      doc.name = "Reginald";
    });

    handle.change((doc) => {
      doc.name = "Bob";
    });

    undoRedo.undo();
    expect(handle.docSync().name).toBe("Jane");

    undoRedo.undo();
    expect(handle.docSync().name).toBe("John");

    undoRedo.redo();
    expect(handle.docSync().name).toBe("Jane");

    undoRedo.redo();
    expect(handle.docSync().name).toBe("Bob");
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

  test("changes can be scoped and selectively undone and redone", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);

    undoRedo.change(
      (doc) => {
        doc.age = 31;
      },
      { scope: "Modal" },
    );

    undoRedo.change(
      (doc) => {
        doc.todos.push("buy bread");
      },
      { scope: "Modal" },
    );

    undoRedo.change(
      (doc) => {
        next.updateText(doc, ["name"], "Jane");
      },
      { scope: "Form" },
    );

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual([
      "buy milk",
      "walk the dog",
      "buy bread",
    ]);

    undoRedo.undo();
    // nothing should have changed yet
    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual([
      "buy milk",
      "walk the dog",
      "buy bread",
    ]);

    undoRedo.undo("Modal");
    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);

    undoRedo.undo("Modal");
    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(30);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);

    undoRedo.undo("Form");
    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(30);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);
    //
    undoRedo.redo();
    // nothing should have changed yet
    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(30);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);

    undoRedo.redo("Modal");
    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(31);
    expect(handle.docSync().todos).toEqual(["buy milk", "walk the dog"]);
  });

  test("changes can be scoped and selectively undone and redone 2", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);

    undoRedo.change(
      (doc) => {
        next.updateText(
          doc,
          ["text"],
          "The recalcitrant farmer enjoyed harvesting his ripe crop.",
        );
      },
      { scope: "Modal" },
    );

    undoRedo.change(
      (doc) => {
        next.updateText(
          doc,
          ["text"],
          "The recalcitrant farmer enjoyed harvesting his crop.",
        );
      },
      { scope: "Form" },
    );

    expect(handle.docSync().text).toEqual(
      "The recalcitrant farmer enjoyed harvesting his crop.",
    );

    undoRedo.undo();
    // nothing should have changed yet
    expect(handle.docSync().text).toEqual(
      "The recalcitrant farmer enjoyed harvesting his crop.",
    );

    undoRedo.undo("Modal");
    expect(handle.docSync().text).toEqual(
      "The jolly farmer enjoyed harvesting his crop.",
    );

    undoRedo.undo("Form");
    expect(handle.docSync().text).toEqual(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    );
    //
    undoRedo.redo();
    // nothing should have changed yet
    expect(handle.docSync().text).toEqual(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    );

    undoRedo.redo("Modal");
    expect(handle.docSync().text).toEqual(
      "The recalcitrant farmer enjoyed harvesting his ripe crop.",
    );
  });

  test("can get the list of undos for a specific scope", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);

    undoRedo.change(
      (doc) => {
        doc.age = 31;
      },
      { scope: "Modal" },
    );

    undoRedo.change(
      (doc) => {
        doc.todos.push("buy bread");
      },
      { scope: "Modal" },
    );

    undoRedo.change(
      (doc) => {
        next.updateText(doc, ["name"], "Jane");
      },
      { scope: "Form" },
    );

    expect(undoRedo.undos("Modal").length).toBe(2);
    expect(undoRedo.undos("Form").length).toBe(1);

    undoRedo.undo("Modal");

    expect(undoRedo.undos("Modal").length).toBe(1);
    expect(undoRedo.redos("Modal").length).toBe(1);
    expect(undoRedo.undos("Form").length).toBe(1);

    expect(undoRedo.undos().length).toBe(0);
  });
});
