// TF16: server and network errors become friendly messages.
// TF22: requests carry the session's token, and a refused session is signalled once.
import {
  api,
  ApiError,
  connectSession,
  failureMessage,
  GENERAL_MESSAGE,
  NETWORK_MESSAGE,
} from "./api";
import { signIn } from "./test-utils";

afterEach(() => vi.unstubAllGlobals());

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a failure");
    },
    (error: unknown) => error as ApiError,
  );

function reply(status: number, body: unknown, json = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(json ? JSON.stringify(body) : String(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

test("sends the local date", async () => {
  reply(200, { ok: true });
  await api("/health");
  const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(init.headers["X-Local-Date"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("field errors come through as they are", async () => {
  reply(400, {
    message: "Check the highlighted fields and try again.",
    fields: { name: "Enter a name." },
  });
  const error = await failure(api("/contacts", "POST", {}));
  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).toBe("Check the highlighted fields and try again.");
  expect(error.fields).toEqual({ name: "Enter a name." });
});

test("a server error becomes the general message, never the details", async () => {
  reply(500, { message: "Traceback: KeyError 'x'" });
  const error = await failure(api("/deals"));
  expect(error.message).toBe(GENERAL_MESSAGE);
});

test("no answer becomes the network message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  const error = await failure(api("/deals"));
  expect(error.message).toBe(NETWORK_MESSAGE);
  reply(502, "Bad gateway", false);
  expect((await failure(api("/deals"))).message).toBe(NETWORK_MESSAGE);
});

test("toast wording says what failed and what to do", () => {
  expect(failureMessage("save the deal", new ApiError(NETWORK_MESSAGE))).toBe(
    "Couldn't save the deal. Accountable isn't answering. Check it's still running, then try again.",
  );
});

const sentHeaders = (call = 0) =>
  (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[call][1].headers;

// A refused request never settles by design, so tests race it against a short timer
// instead of awaiting it. The pending promise holds no timer or handle, so nothing outlives the test.
const settled = (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise((resolve) => setTimeout(() => resolve(false), 20)),
  ]);

test("requests carry the session's bearer token", async () => {
  signIn("abc.def.ghi");
  reply(200, { ok: true });
  await api("/deals");
  expect(sentHeaders()["Authorization"]).toBe("Bearer abc.def.ghi");
});

test("signed out, requests carry no token", async () => {
  reply(200, { ok: true });
  await api("/health");
  expect(sentHeaders()).not.toHaveProperty("Authorization");
});

test("the token is read for each request, so a renewed one is sent", async () => {
  let token = "first";
  onTestFinished(connectSession({ accessToken: async () => token, ended: vi.fn() }));
  reply(200, { ok: true });
  await api("/deals");
  token = "renewed";
  await api("/deals");
  expect(sentHeaders(0)["Authorization"]).toBe("Bearer first");
  expect(sentHeaders(1)["Authorization"]).toBe("Bearer renewed");
});

test("a 401 tells the session it has ended once, and raises no error to toast", async () => {
  const { ended } = signIn();
  reply(401, { message: "Sign in to use Accountable.", fields: {} });
  const requests = [api("/deals"), api("/contacts"), api("/deals/1", "PATCH", {})];
  expect(await settled(Promise.any(requests))).toBe(false);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(await settled(api("/deals"))).toBe(false);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(sentHeaders(3)).not.toHaveProperty("Authorization");
});

test("a late 401 for an earlier session leaves the session signed in since alone", async () => {
  const replies: ((response: Response) => void)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve))),
  );
  const earlier = signIn("earlier");
  const first = api("/deals");
  const second = api("/contacts");
  await vi.waitFor(() => expect(replies).toHaveLength(2));

  replies[0](new Response(null, { status: 401 }));
  await vi.waitFor(() => expect(earlier.ended).toHaveBeenCalledTimes(1));
  const later = signIn("later");
  replies[1](new Response(null, { status: 401 }));

  expect(await settled(Promise.any([first, second]))).toBe(false);
  expect(later.ended).not.toHaveBeenCalled();
});

test("a 401 for a request that waited on an earlier session's token leaves the later session alone", async () => {
  let giveToken: (token: string) => void = () => {};
  const earlier = {
    accessToken: () => new Promise<string>((resolve) => (giveToken = resolve)),
    ended: vi.fn(),
  };
  onTestFinished(connectSession(earlier));
  reply(401, {});
  const request = api("/deals");

  const later = signIn("later");
  giveToken("earlier");

  expect(await settled(request)).toBe(false);
  expect(earlier.ended).not.toHaveBeenCalled();
  expect(later.ended).not.toHaveBeenCalled();
});
