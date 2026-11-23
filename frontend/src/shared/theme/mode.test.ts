// TF20 (spec M1, M2): the mode on <html>, saving it, and index.html applying it before the app loads.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODE_KEY, currentMode, setMode } from "./mode";

const root = document.documentElement;

/** The inline script in index.html's <head>, run as the browser would before the app's script. */
function runIndexScript() {
  const html = readFileSync(join(__dirname, "../../../index.html"), "utf8");
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(code).toBeDefined();
  new Function(code as string)();
}

function blockStorage() {
  const blocked = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete root.dataset.theme;
  localStorage.clear();
});

test("the mode is light with no attribute and dark with data-theme=dark", () => {
  expect(currentMode()).toBe("light");
  root.dataset.theme = "dark";
  expect(currentMode()).toBe("dark");
});

test("setMode changes the attribute and saves the choice", () => {
  setMode("dark");
  expect(root).toHaveAttribute("data-theme", "dark");
  expect(localStorage.getItem(MODE_KEY)).toBe("dark");

  setMode("light");
  expect(root).not.toHaveAttribute("data-theme");
  expect(localStorage.getItem(MODE_KEY)).toBe("light");
});

test("when storage throws, the mode still changes and nothing is thrown or logged", () => {
  blockStorage();
  const logged = [vi.spyOn(console, "error"), vi.spyOn(console, "warn")];

  expect(() => setMode("dark")).not.toThrow();
  expect(currentMode()).toBe("dark");
  setMode("light");
  expect(currentMode()).toBe("light");
  for (const spy of logged) expect(spy).not.toHaveBeenCalled();
});

test("index.html opens in the mode setMode saved", () => {
  setMode("dark");
  delete root.dataset.theme;
  runIndexScript();
  expect(currentMode()).toBe("dark");

  setMode("light");
  runIndexScript();
  expect(currentMode()).toBe("light");
});

test("index.html opens in light mode when storage throws", () => {
  blockStorage();
  expect(runIndexScript).not.toThrow();
  expect(currentMode()).toBe("light");
});
