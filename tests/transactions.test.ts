import { next } from "@automerge/automerge";
import { DocHandle, Repo } from "@automerge/automerge-repo";
import { beforeEach, describe, expect, test } from "vitest";
import { AutomergeRepoUndoRedo } from "../src";
import { Data, getHandle } from "./data";

describe("Single Handle Transaction Tests", () => {
  let handle: DocHandle<Data>;
  let repo: Repo;

  beforeEach(() => {
    repo = new Repo({
      network: [],
    });

    handle = getHandle(repo);
  });

  test("A series of changes can be batched up into a single transaction", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction(() => {
      undoRedo.change((doc) => {
        next.updateText(doc, ["name"], "Jane");
      });

      undoRedo.change((doc) => {
        doc.age = 31;
      });
    });
    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);

    undoRedo.undo();
    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(30);
  });

  test("Attempting to start a document transaction within a document transaction throws an error", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    expect(() => {
      undoRedo.transaction(() => {
        undoRedo.transaction(() => {
          undoRedo.change((doc) => {
            next.updateText(doc, ["name"], "Jane");
          });
        });
      });
    }).toThrow();
  });

  test("A transaction can be started and ended manually", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.startTransaction();
    undoRedo.change((doc) => {
      next.updateText(doc, ["name"], "Jane");
    });

    undoRedo.change((doc) => {
      doc.age = 31;
    });

    undoRedo.endTransaction();

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);

    undoRedo.undo();
    expect(handle.docSync().name).toBe("John");
    expect(handle.docSync().age).toBe(30);
  });

  test("A transaction can be given a message", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction(() => {
      undoRedo.change((doc) => {
        next.updateText(doc, ["name"], "Jane");
      });

      undoRedo.change((doc) => {
        doc.age = 31;
      });
    }, "Change name and age");

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);

    expect(undoRedo.undos[0].message).toBe("Change name and age");
  });

  test("A transaction can be given a message, set by the return content of the callback", () => {
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.transaction(() => {
      undoRedo.change((doc) => {
        next.updateText(doc, ["name"], "Jane");
      });

      undoRedo.change((doc) => {
        doc.age = 31;
      });
      return "Change name and age";
    });

    expect(handle.docSync().name).toBe("Jane");
    expect(handle.docSync().age).toBe(31);

    expect(undoRedo.undos[0].message).toBe("Change name and age");
  });
});
