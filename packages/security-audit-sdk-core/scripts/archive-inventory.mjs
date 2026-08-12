import { existsSync, lstatSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { assert, byCodePoint, git, splitNull } from "./verification-helpers.mjs";

/**
 * Path-keyed inventories of an archived directory, shared by the two gates that
 * compare them: `check-changed-paths.mjs` compares an archive against the active
 * change it replaced, and `check-archive-attestations.mjs` compares it against
 * the commit history shows introduced it.
 *
 * Both return a Map from the path relative to `prefix` to `{ mode, oid, path }`,
 * so a comparison is a lookup rather than a diff of two orderings.
 */
export function gitTreeInventory(revision, prefix) {
  const inventory = new Map();
  const records = splitNull(git(["ls-tree", "-r", "-z", revision, "--", prefix]));
  for (const record of records) {
    const separator = record.indexOf("\t");
    assert(separator !== -1, `unable to parse git tree record for ${prefix}`);
    const [mode, type, oid] = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    assert(type === "blob", `archive movement requires blob entries, found ${type} at ${path}`);
    assert(path.startsWith(`${prefix}/`), `tree path ${path} is outside ${prefix}`);
    const relativePath = path.slice(prefix.length + 1);
    assert(!inventory.has(relativePath), `duplicate tree path ${relativePath}`);
    inventory.set(relativePath, Object.freeze({ mode, oid, path }));
  }
  return inventory;
}

/**
 * Working-tree counterpart. Entries that are neither a file nor a symbolic link
 * cannot be compared by object, so they are returned as `problems` for the
 * caller to report in its own diagnostic vocabulary rather than thrown here.
 */
export function workingTreeInventory(repositoryRoot, rootRelative) {
  const inventory = new Map();
  const problems = [];
  const root = resolve(repositoryRoot, rootRelative);
  if (!existsSync(root)) return { inventory, problems };

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(byName)) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stat = lstatSync(absolute);
      const path = relative(repositoryRoot, absolute).replaceAll("\\", "/");
      const relativePath = path.slice(rootRelative.length + 1);
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        problems.push(Object.freeze({ path }));
        continue;
      }
      const mode = gitFileMode(entry, stat);
      const oid = git(["hash-object", "--no-filters", "--", path]).trim();
      inventory.set(relativePath, Object.freeze({ mode, oid, path }));
    }
  };
  walk(root);
  return { inventory, problems };
}

function byName(left, right) {
  return byCodePoint(left.name, right.name);
}

function gitFileMode(entry, stat) {
  if (entry.isSymbolicLink()) return "120000";
  return (stat.mode & 0o111) === 0 ? "100644" : "100755";
}
