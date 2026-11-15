import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createIdFactory, moveImage, partitionImageFiles, removeImage } from "./imageCollection";

const list = [
  { id: "demo", isDemo: true },
  { id: "a", isDemo: false },
  { id: "b", isDemo: false },
];
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("moveImage", () => {
  it("swaps with the neighbour", () => {
    assert.deepEqual(ids(moveImage(list, "a", -1)), ["a", "demo", "b"]);
    assert.deepEqual(ids(moveImage(list, "a", 1)), ["demo", "b", "a"]);
  });
  it("ignores moves past either end", () => {
    assert.equal(moveImage(list, "demo", -1), list);
    assert.equal(moveImage(list, "b", 1), list);
    assert.equal(moveImage(list, "missing", 1), list);
  });
});

describe("removeImage", () => {
  it("removes an upload and names the image that takes its place", () => {
    const result = removeImage(list, "a");
    assert.deepEqual(ids(result.list), ["demo", "b"]);
    assert.equal(result.neighbourId, "b");
  });
  it("falls back to the new last image when the last one is removed", () => {
    assert.equal(removeImage(list, "b").neighbourId, "a");
  });
  it("never removes the demo image", () => {
    const result = removeImage(list, "demo");
    assert.equal(result.list, list);
    assert.equal(result.removed, null);
  });
});

describe("partitionImageFiles", () => {
  it("keeps images in order and names the rejected files", () => {
    const result = partitionImageFiles([
      { name: "a.png", type: "image/png" },
      { name: "notes.txt", type: "text/plain" },
      { name: "b.webp", type: "image/webp" },
      { name: "unknown", type: "" },
    ]);
    assert.deepEqual(
      result.images.map((file) => file.name),
      ["a.png", "b.webp"],
    );
    assert.deepEqual(result.rejected, ["notes.txt", "unknown"]);
  });
});

describe("ids and order", () => {
  const nextId = createIdFactory();
  const make = (n: number) =>
    Array.from({ length: n }, () => ({ id: nextId(), isDemo: false, name: "same.png" }));

  it("gives unique ids that do not depend on position or name", () => {
    const ids = make(50).map((item) => item.id);
    assert.equal(new Set(ids).size, 50);
  });

  it("never reuses an id after a removal", () => {
    const factory = createIdFactory();
    const first = [factory(), factory()];
    assert.notEqual(factory(), first[1]);
  });

  it("keeps ids and contents through many moves, without mutating the input", () => {
    const original = [{ id: "demo", isDemo: true, name: "demo" }, ...make(4)];
    const snapshot = JSON.stringify(original);
    let list = original;
    for (const [id, delta] of [
      [original[1].id, 1],
      [original[1].id, 1],
      [original[4].id, -1],
      ["demo", 1],
    ] as const) {
      list = moveImage(list, id, delta);
    }
    assert.equal(JSON.stringify(original), snapshot);
    assert.deepEqual([...ids(list)].sort(), [...ids(original)].sort());
    for (const item of list)
      assert.equal(
        item,
        original.find((o) => o.id === item.id),
      );
  });

  it("moves the first image to the last place, and back", () => {
    let list = [{ id: "demo", isDemo: true }, ...make(3)];
    const first = list[0].id;
    for (let i = 0; i < list.length - 1; i++) list = moveImage(list, first, 1);
    assert.equal(list.at(-1)!.id, first);
    const last = list.at(-1)!.id;
    for (let i = 0; i < list.length - 1; i++) list = moveImage(list, last, -1);
    assert.equal(list[0].id, last);
  });

  it("reorders correctly after a removal and an addition", () => {
    let list = [{ id: "demo", isDemo: true }, ...make(3)];
    const [, a, b, c] = ids(list);
    list = removeImage(list, b).list;
    list = [...list, ...make(1)];
    const d = list.at(-1)!.id;
    list = moveImage(list, d, -1);
    list = moveImage(list, d, -1);
    assert.deepEqual(ids(list), ["demo", d, a, c]);
  });
});
