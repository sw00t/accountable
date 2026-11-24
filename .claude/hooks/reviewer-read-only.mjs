// PreToolUse hook for the reviewer subagent (.claude/agents/reviewer.md): lets its Bash
// run only commands that read, such as git diff, git log, git show, git grep and grep.
// Claude Code can't limit a subagent's Bash through its tool list, so this hook does it.
// A command is split at unquoted ; && || | & and newlines, and every part must start with
// an allowed command. Writing to a file (>), command substitution and env-var prefixes are
// blocked. Exit code 2 blocks the call and sends the message back to the reviewer.

const input = JSON.parse(await new Response(process.stdin).text());
const command = input.tool_input?.command ?? "";

const READ_COMMANDS = new Set([
  "grep", "rg", "cat", "head", "tail", "less", "ls", "find", "wc", "sort", "uniq",
  "cut", "diff", "pwd", "cd", "file", "stat", "jq", "tr", "basename", "dirname",
  "realpath", "true", "echo",
]);

const GIT_READ = new Set([
  "diff", "log", "show", "status", "grep", "rev-parse", "merge-base", "blame",
  "ls-files", "ls-tree", "cat-file", "shortlog", "describe", "rev-list", "branch",
  "name-rev", "whatchanged", "diff-tree", "show-ref",
]);

// git branch only lists: no -d, -m, -c or a new branch name.
const GIT_BRANCH_FLAGS = new Set([
  "--show-current", "-a", "--all", "-r", "--remotes", "--list", "-l", "-v", "-vv",
  "--verbose", "--contains", "--merged", "--no-merged", "--no-color",
]);

// find's options that run or delete things.
const FIND_ACTIONS = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprintf", "-fls"]);

// Splits on unquoted separators and spots redirection and substitution outside single quotes.
function scan(text) {
  const parts = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (quote === "'") {
      if (c === "'") quote = null;
      current += c;
      continue;
    }
    if (c === "\\") {
      current += c + (next ?? "");
      i++;
      continue;
    }
    if (c === "`" || (c === "$" && next === "(")) return { error: "command substitution" };
    if (quote === '"') {
      if (c === '"') quote = null;
      current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === ">" || c === "<") {
      const rest = text.slice(i);
      const safe = rest.match(/^(>\s*\/dev\/null|>&[12])/);
      const fd = current.match(/(^|\s)[12]$/);
      if (c === ">" && safe && fd) {
        current += safe[0];
        i += safe[0].length - 1;
        continue;
      }
      return { error: "redirection" };
    }
    if (c === ";" || c === "\n" || c === "|" || c === "&") {
      parts.push(current);
      current = "";
      if ((c === "|" || c === "&") && next === c) i++;
      continue;
    }
    current += c;
  }
  if (quote) return { error: "an unclosed quote" };
  parts.push(current);
  return { parts: parts.map((p) => p.trim()).filter(Boolean) };
}

function words(part) {
  return (part.match(/'[^']*'|"(?:\\.|[^"])*"|\S+/g) ?? []).map((w) => w.replace(/^['"]|['"]$/g, ""));
}

function checkGit(args) {
  let rest = args;
  while (rest[0] === "--no-pager" || rest[0] === "-C") rest = rest.slice(rest[0] === "-C" ? 2 : 1);
  const [sub, ...flags] = rest;
  if (!GIT_READ.has(sub)) return `git ${sub ?? ""} isn't a read-only git command`;
  if (flags.includes("--output") || flags.some((f) => f.startsWith("--output="))) return "git --output writes a file";
  if (sub === "branch" && !branchOnlyLists(flags)) return "git branch may only list branches";
  return null;
}

// A bare name after git branch creates a branch, unless a listing option takes it as a filter.
function branchOnlyLists(flags) {
  const options = flags.filter((f) => f.startsWith("-"));
  const names = flags.filter((f) => !f.startsWith("-"));
  const filtered = options.some((f) => ["--contains", "--merged", "--no-merged", "--list", "-l"].includes(f));
  return options.every((f) => GIT_BRANCH_FLAGS.has(f)) && (names.length === 0 || filtered);
}

function checkPart(part) {
  const [cmd, ...args] = words(part);
  if (/^\w+=/.test(cmd)) return "setting environment variables before a command";
  if (cmd === "git") return checkGit(args);
  if (!READ_COMMANDS.has(cmd)) return `${cmd} isn't on the reviewer's list of read-only commands`;
  if (cmd === "find" && args.some((a) => FIND_ACTIONS.has(a))) return `find ${args.find((a) => FIND_ACTIONS.has(a))} can change files`;
  if (cmd === "sort" && args.some((a) => a === "-o" || a.startsWith("--output"))) return "sort -o writes a file";
  return null;
}

const { parts, error } = scan(command);
const problem = error ?? parts.map(checkPart).find(Boolean);

if (problem) {
  console.error(
    `The reviewer only runs commands that read, and this one was blocked (${problem}). ` +
      "Use git diff, git log, git show, git grep, grep, cat, head, tail, ls or find, " +
      "or the Read, Grep and Glob tools. Don't write files; report what you found instead.",
  );
  process.exit(2);
}
