import { Repo } from "@automerge/automerge-repo";

export type Data = {
  text: string;
  name: string;
  age: number;
  todos: string[];
};

export type State = {
  selected: number[];
};

export const getHandle = (repo: Repo) =>
  repo.create<Data>({
    text: "The jolly farmer enjoyed harvesting his ripe crop.",
    name: "John",
    age: 30,
    todos: ["buy milk", "walk the dog"],
  });

export const getStateHandle = (repo: Repo) =>
  repo.create<State>({
    selected: [0],
  });
