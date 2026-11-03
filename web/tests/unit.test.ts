import { test } from "node:test";
import assert from "node:assert/strict";
import { nearToYocto, yoctoToNear } from "../lib/near-format";
import { parseVerdict } from "../lib/verdict";

test("NEAR <-> yocto", () => {
  assert.equal(nearToYocto("1"), "1000000000000000000000000");
  assert.equal(nearToYocto("0.25"), "250000000000000000000000");
  assert.equal(yoctoToNear("1500000000000000000000000"), "1.5");
  assert.throws(() => nearToYocto("-1"));
  assert.throws(() => nearToYocto("abc"));
});

test("verdict parsing is strict", () => {
  const v = parseVerdict('Sure: {"approved": true, "reason": "codes match", "checklist": []}');
  assert.equal(v.approved, true);
  assert.throws(() => parseVerdict("I approve"));
  assert.throws(() => parseVerdict('{"approved":"yes","reason":"x"}'));
});
