// TF34: what counts as a phone (Concern 24) is one query, used by the stylesheets and usePhone().
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { renderHook } from "@testing-library/react";
import { setPhone } from "../test-setup";
import { PHONE_QUERY, usePhone } from "./phone";

test("usePhone follows the phone query as it changes", () => {
  const { result } = renderHook(() => usePhone());
  expect(result.current).toBe(false);
  setPhone(true);
  expect(result.current).toBe(true);
  setPhone(false);
  expect(result.current).toBe(false);
});

const SRC = join(__dirname, "..");
const stylesheets = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".css"))
  .map((file) => [relative(SRC, join(SRC, file)), readFileSync(join(SRC, file), "utf8")]);

test("every media rule in every stylesheet is the phone query or a device preference", () => {
  const queries = stylesheets.flatMap(([file, css]) =>
    [...css.matchAll(/@media\s+([^{]+)\{/g)].map((m) => [file, m[1].trim()]),
  );
  expect(queries.some(([, query]) => query === PHONE_QUERY)).toBe(true);
  expect(
    queries.filter(([, query]) => query !== PHONE_QUERY && !query.startsWith("(prefers-")),
  ).toEqual([]);
});
