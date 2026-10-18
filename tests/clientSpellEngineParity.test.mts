// Hand-authored fixtures are shared with the Rust fold parser; no game data is redistributed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSpellsUs } from "../src/main/resist/spellsUsParse";

interface ParityFixture {
  layout: number;
  row: string;
  key: string;
  projection: Record<string, unknown>;
}
const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/spell-parity.json", import.meta.url),
    "utf8",
  ),
) as ParityFixture[];
for (const fixture of fixtures) {
  test(`client spell compatibility projection shares Rust ${fixture.layout}-column fixture`, () => {
    assert.equal(fixture.row.split("^").length, fixture.layout);
    assert.deepEqual(
      parseSpellsUs(fixture.row)[fixture.key],
      fixture.projection,
    );
  });
}
