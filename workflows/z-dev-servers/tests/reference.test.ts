import { expect, test } from "bun:test";
import { referenceData, skipHeading } from "../../../shared/reference-rows.ts";
test("headings never trap selection at list boundaries or between projects", () => {
  const rows = referenceData(
    [
      { id: "a", name: "A", group: "First" },
      { id: "b", name: "B", group: "Second" },
    ],
    "example",
  );
  expect(skipHeading(rows, "heading:First", "a").update.ids.items.select).toBe("a");
  expect(skipHeading(rows, "heading:Second", "a").update.ids.items.select).toBe("b");
  expect(skipHeading(rows, "heading:Second", "b").update.ids.items.select).toBe("a");
});
