import assert from "node:assert/strict";
import { test } from "node:test";
import { todoCreateSchema, todoUpdateSchema } from "../src/lib/validation";

test("grocery list items require a roommate and meaningful text", () => {
  assert.deepEqual(todoCreateSchema.parse({ roommateId:"feo", text:"  Oat milk  " }), { roommateId:"feo", text:"Oat milk" });
  assert.throws(() => todoCreateSchema.parse({ roommateId:"feo", text:"   " }));
});
test("grocery list edits accept text or completion changes", () => {
  assert.deepEqual(todoUpdateSchema.parse({ completed:true }), { completed:true });
  assert.deepEqual(todoUpdateSchema.parse({ text:"Bread" }), { text:"Bread" });
  assert.throws(() => todoUpdateSchema.parse({}));
});
