// TF31 (spec M1, M2, Concern 12): the theme on <html>, saving it, following the device
// while System is chosen, and index.html making the same choice before the app loads.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ModeModule = typeof import("./mode");

const root = document.documentElement;
const isDark = () => root.dataset.theme === "dark";

/** A device whose light or dark setting the test can change, as the OS would. */
function stubDevice(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    turn(nowDark: boolean) {
      dark = nowDark;
      listeners.forEach((listener) => listener());
    },
  };
}

function blockStorage() {
  const blocked = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
}

/** The inline script in index.html's <head>, run as the browser would before the app's script. */
function runIndexScript() {
  const html = readFileSync(join(__dirname, "../../../index.html"), "utf8");
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(code).toBeDefined();
  new Function(code as string)();
}

// A fresh module each test, since a page's choice is kept in memory for blocked storage.
let mode: ModeModule;
let stopFollowing: () => void;

beforeEach(async () => {
  vi.resetModules();
  stubDevice(false);
  mode = await import("./mode");
  stopFollowing = () => {};
});

afterEach(() => {
  stopFollowing();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete root.dataset.theme;
  localStorage.clear();
});

describe("the chosen theme", () => {
  it("is dark with nothing saved, or anything unknown saved", () => {
    expect(mode.chosenTheme()).toBe("dark");
    localStorage.setItem(mode.THEME_KEY, "blue");
    expect(mode.chosenTheme()).toBe("dark");
  });

  it("keeps a light or dark saved before the theme moved into the menu", () => {
    localStorage.setItem(mode.THEME_KEY, "light");
    expect(mode.chosenTheme()).toBe("light");
    localStorage.setItem(mode.THEME_KEY, "dark");
    expect(mode.chosenTheme()).toBe("dark");
  });

  it("applies and saves each choice", () => {
    mode.chooseTheme("dark");
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(mode.THEME_KEY)).toBe("dark");

    mode.chooseTheme("light");
    expect(isDark()).toBe(false);
    expect(localStorage.getItem(mode.THEME_KEY)).toBe("light");

    mode.chooseTheme("system");
    expect(localStorage.getItem(mode.THEME_KEY)).toBe("system");
    expect(mode.chosenTheme()).toBe("system");
  });
});

describe("System", () => {
  it("follows the device, changes with it, and stops when another theme is chosen", () => {
    const device = stubDevice(true);
    stopFollowing = mode.followDeviceTheme();

    mode.chooseTheme("system");
    expect(isDark()).toBe(true);
    device.turn(false);
    expect(isDark()).toBe(false);
    device.turn(true);
    expect(isDark()).toBe(true);

    mode.chooseTheme("light");
    device.turn(true);
    expect(isDark()).toBe(false);
  });

  it("follows the device after a reload with System saved", () => {
    localStorage.setItem(mode.THEME_KEY, "system");
    const device = stubDevice(false);
    stopFollowing = mode.followDeviceTheme();

    device.turn(true);
    expect(isDark()).toBe(true);
  });
});

describe("blocked storage", () => {
  it("opens dark, and a choice still applies for this page with nothing thrown or logged", () => {
    blockStorage();
    const logged = [vi.spyOn(console, "error"), vi.spyOn(console, "warn")];

    expect(mode.chosenTheme()).toBe("dark");
    expect(() => mode.chooseTheme("light")).not.toThrow();
    expect(isDark()).toBe(false);
    expect(mode.chosenTheme()).toBe("light");
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });
});

describe("index.html's script", () => {
  it.each([
    ["nothing saved", null, false, true],
    ["light", "light", true, false],
    ["dark", "dark", false, true],
    ["System on a dark device", "system", true, true],
    ["System on a light device", "system", false, false],
  ])("with %s, makes the same choice as the app", (_case, saved, deviceDark, dark) => {
    if (saved) localStorage.setItem(mode.THEME_KEY, saved);
    stubDevice(deviceDark);

    runIndexScript();

    expect(isDark()).toBe(dark);
    delete root.dataset.theme;
    mode.chooseTheme(mode.chosenTheme());
    expect(isDark()).toBe(dark);
  });

  it("opens dark when storage throws", () => {
    blockStorage();
    expect(runIndexScript).not.toThrow();
    expect(isDark()).toBe(true);
  });
});
