// TF28: the bold part of a result's name (F4).
import { locate } from "./highlight";

test("finds the typed text in any case", () => {
  expect(locate("Garcia Freight", "gArCiA")).toEqual({
    before: "",
    match: "Garcia",
    after: " Freight",
  });
  expect(locate("Sabrina Garcia", "GARC")).toEqual({
    before: "Sabrina ",
    match: "Garc",
    after: "ia",
  });
});

test("finds accented letters in any case", () => {
  expect(locate("Élan Studio", "élan")?.match).toBe("Élan");
  expect(locate("Café Örnek", "ÖRN")?.match).toBe("Örn");
});

test("matches letters that fold to two, as the backend's casefold does", () => {
  expect(locate("Großstraße Lager", "STRASSE")).toEqual({
    before: "Groß",
    match: "straße",
    after: " Lager",
  });
  expect(locate("ΟΔΟΣ Logistics", "οδοσ")?.match).toBe("ΟΔΟΣ");
});

test("ignores spaces at either end of the text", () => {
  expect(locate("Garcia Freight", "  freight ")?.match).toBe("Freight");
});

test("bolds nothing when the match can't be placed", () => {
  // "se" lands halfway through the "ss" that ß folds to.
  expect(locate("Große", "se")).toBeNull();
  expect(locate("Garcia Freight", "nowhere")).toBeNull();
  expect(locate("Garcia Freight", "   ")).toBeNull();
});

test("places a later match when an earlier one splits a letter", () => {
  expect(locate("Große Strasse", "ss")).toEqual({
    before: "Gro",
    match: "ß",
    after: "e Strasse",
  });
  expect(locate("Große se", "se")?.before).toBe("Große ");
});
