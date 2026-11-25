// TF29 (spec U11): the initials in the user menu's circle.
import { initials } from "./initials";

describe("initials", () => {
  it.each([
    ["Jane Smith", "JS"],
    ["Jane van der Berg", "JB"],
    ["Cher", "C"],
    ["  jane   smith  ", "JS"],
  ])("%s gives %s", (name, expected) => {
    expect(initials(name, "someone@example.com")).toBe(expected);
  });

  it("uses the email's first letter when there's no name", () => {
    expect(initials(null, "sam@example.com")).toBe("S");
    expect(initials("  ", "sam@example.com")).toBe("S");
  });
});
