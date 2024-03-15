import { Repo } from "@automerge/automerge-repo";

export type Data = {
  text: string;
  name: string;
  age: number;
  todos: string[];
};

export const getHandle = (repo: Repo) =>
  repo.create<Data>({
    text: "The jolly farmer enjoyed harvesting his ripe crop.",
    name: "John",
    age: 30,
    todos: ["buy milk", "walk the dog"],
  });
