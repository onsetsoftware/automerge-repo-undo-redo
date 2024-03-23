# Automerge Repo Undo Redo

> [!IMPORTANT]
> This package is experimental and a work in progress. While it uses official automerge apis, it uses them to alter the history of your document, which may have unexpected results.

This is a wrapper around an Automerge Repo `DocHandle` which adds undo and redo functionality.

It allows you to make specific changes which you wish to be able to undo and redo, while any external changes (eg. changes from connected peers) will be untouched.

## AutomergeRepoUndoRedo

### Usage
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

### Transactions

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

### Descriptions
It is useful to be able to add descriptions to your undo and redo changes.

```ts
undoRedo.transaction(() => {
  undoRedo.change(doc => {
    doc.age = 35;
  })
}, { description: "Update Age"})
```
You can now access the list of undos to get the descriptions of your changes.

```ts
const undos = undoRedo.undos();

console.log(undos[0].description); // => "Update Age"
```

### Scopes
You can use undo and redo scopes to manage how your application manages undo and redo at specific times. For example, lets say you open a modal and want to limit your undo/redo stack the changes you make within that modal.

Your scope should be passed as a string or symbol as part of the options object for the change. It can be passed to a transaction or (if not using transactions) to a change directly.

```ts
undoRedo.transaction(() => {
  undoRedo.change(doc => {
    doc.age = 35;
  })
}, { scope: "modal" })

// add another unscoped change
undoRedo.transaction(() => {
  undoRedo.change(doc => {
    next.updateText(doc, ['name'], "Jeremy Irons")
  })
})

// doc => { name: "Jeremy Irons", age: 35 }

// pass the scope to undo. Note only the age has changed.
undoRedo.undo("modal") // doc => { name: "Jeremy Irons", age: 34 }
```

## Undo Manager
If you are using multiple document handles to manage your application state, you may wish to undo and redo changes from multiple documents at a time. To achieve this, you can use an `UndoRedoManager`.

### Usage
```ts
// instatiate the manager and add either a plain DocHandle or an existing AutomergeRepoUndoRedo instance

const handleA = repo.create({a : ""});
const handleB = repo.create({b : ""});

const manager = new UndoRedoManager();

// adding a plain docHandle returns the undoable instance
const undoableA = manager.addHandle(handleA);
const undoableB = manager.addHandle(handleB);

const { transaction, undo, redo } = manager;

// create a change to both documents as part of a single manager transaction
transaction(() => {
  undoableA.change((doc) => {
    doc.a = "Hello";
  });

  undoableB.change((doc) => {
    doc.b = "world";
  })
})

console.log(undoableA, undoableB): // => {a: "Hello", b: "World"}

// A single undo can be used to undo both changes
undo();

console.log(undoableA, undoableB): // => {a: "", b: ""}

```

> [!IMPORTANT]
> If you are using the undo manager, you should use it for all changes you want to track. A transaction on the individual handle will not be undoable.

## Scopes and Descriptions
Scopes and descriptions can be used in the same way as they are used on single doc handle transactions and changes, as above.


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
