// TF44 (F8): on a phone, a search button opens the same search full screen.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setPhone } from "../test-setup";
import { mockApi, renderSignedIn } from "../shared/test-utils";
import { SearchBox } from "./SearchBox";

afterEach(() => vi.unstubAllGlobals());

const GARCIA = {
  organizations: { items: [{ id: 3, name: "Garcia Freight", industry: "Logistics" }], total: 1 },
  contacts: { items: [], total: 0 },
  deals: { items: [], total: 0 },
};

function Where() {
  const navigate = useNavigate();
  return (
    <>
      <p>At {useLocation().pathname}</p>
      <button onClick={() => navigate(-1)}>Browser back</button>
    </>
  );
}

function renderPhoneSearch() {
  mockApi({ "GET /search?q=garcia": GARCIA });
  setPhone(true);
  renderSignedIn(
    <>
      <SearchBox />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </>,
  );
}

const openSearch = () => userEvent.click(screen.getByRole("button", { name: "Search" }));

test("a phone shows a search button, not the box", () => {
  renderPhoneSearch();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
});

test("the button opens search full screen with the box focused", async () => {
  renderPhoneSearch();
  await openSearch();
  expect(screen.getByRole("search")).toHaveClass("full");
  expect(screen.getByRole("combobox", { name: "Search" })).toHaveFocus();
});

test("choosing a result opens it and closes search", async () => {
  renderPhoneSearch();
  await openSearch();
  await userEvent.type(screen.getByRole("combobox"), "garcia");
  await userEvent.click(await screen.findByRole("option", { name: /Garcia Freight/ }));
  expect(screen.getByText("At /organizations/3")).toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test("Cancel closes search and clears the box", async () => {
  renderPhoneSearch();
  await openSearch();
  await userEvent.type(screen.getByRole("combobox"), "gar");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  await openSearch();
  expect(screen.getByRole("combobox")).toHaveValue("");
});

test("Escape closes full-screen search too", async () => {
  renderPhoneSearch();
  await openSearch();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
});

test("the back button closes full-screen search and stays on the page", async () => {
  renderPhoneSearch();
  await openSearch();
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Browser back" }));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByText("At /")).toBeInTheDocument();
});
