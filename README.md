# Automerge Repo Undo Redo

This is a simple wrapper around an Automerge Repo `DocHandle` which adds undo and redo functionality.

It allows you to make specific changes which you wish to be able to undo and redo, while any external changes (eg. changes from connected peers) will be untouched.

## Usage
```ts

const handle = repo.create(
  age: 34;
  name: "Jeremy"
})
const undoRedo = new AutomergeRepoUndoRedo(handle)

undoRedo.change((doc) => {
  doc.age = 35;
}, "Update Age")

// You can also make changes directly to your handle at any time 
// which will not be tracked and won't form part of the undo/redo tree.
handle.change(doc => {
  next.updateText(doc, ['name'], "Jeremy Irons")
})

undoRedo.undo(); // doc => { age: 34, name: "Jeremy Irons" }

undoRedo.redo(); // doc.age => 35
```

## Transactions

Changes can be batched together in "transactions". Use the `transaction` method, which takes a callback to contain your changes, and a message.

```ts
undoRedo.transaction(() => {
  undoRedo.change((doc) => {
    doc.age = 35;
  })

  // this function contains a change somewhere else in your app
  // and sets the document `name` to "Bob"
  updateName();
})

console.log(undoRedo.docSync()); // doc => { age: 35, name: "Bob" }

// undo now reverses the whole transaction
undoRedo.undo(); // => { age: 30, name: "Jeremy" }
```

## Concepts

Undo and redo patches are stored along with the heads they a based on. When an undo or redo is invoked, if there have been no untracked changes to the document, then the undo change is applied to the head of the document. If there is an untracked change, then the change is made at the heads at which the original change occurred. This helps to preserve the untracked change.

## Pitfalls
In the example below, some text is appended to a string by the tracked user. An untracked change is then made to that appended text, before the original change is undone. One might expect the text to revert to the original, but the untracked change remains, tacked unatractively on to the initial string.

```ts
   const handle = repo.create({
     text: "The jolly farmer enjoyed harvesting his ripe crop."
   })
    const undoRedo = new AutomergeRepoUndoRedo(handle);
    undoRedo.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The jolly farmer enjoyed harvesting his ripe crop with his friends.",
      );
    });

    handle.change((doc) => {
      next.updateText(
        doc,
        ["text"],
        "The jolly farmer enjoyed harvesting his ripe crop with some friends.",
      );
    });

    undoRedo.undo();
    expect(handle.docSync().text).toBe(
      "The jolly farmer enjoyed harvesting his ripe crop.",
    ); // fails with => "The jolly farmer enjoyed harvesting his ripe cropome.",

```
