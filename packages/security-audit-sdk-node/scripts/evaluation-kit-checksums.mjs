import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { assert, byCodePoint, runChecked } from "./verification-helpers.mjs";

export const IDENTITY_FILE = "identity.json";
export const CHECKSUM_LIST_FILE = "checksums.sha256";
export const KIT_DIGEST_FILE = "kit-digest.sha256";

// The checksum list covers every kit file except itself and the digest that records its own SHA-256.
const UNLISTED_FILES = new Set([CHECKSUM_LIST_FILE, KIT_DIGEST_FILE]);

const GUIDE = "docs/evaluation-guide.md";
const GUIDE_INTEGRITY_SECTION = /^## .*How to Check Kit Identity\s*$/m;

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function collectKitFiles(kitDir, directory, paths) {
  for (const entry of await readdir(directory)) {
    const filePath = resolve(directory, entry);
    const path = relative(kitDir, filePath).split(sep).join("/");
    const status = await lstat(filePath);
    if (status.isDirectory()) {
      await collectKitFiles(kitDir, filePath, paths);
    } else {
      assert(status.isFile(), `non-regular file in the kit: ${path}`);
      paths.push(path);
    }
  }
}

export async function assertRegularKitEntries(kitDir) {
  const paths = [];
  await collectKitFiles(kitDir, kitDir, paths);
  return paths;
}

async function listKitFiles(kitDir) {
  return (await assertRegularKitEntries(kitDir)).filter((path) => !UNLISTED_FILES.has(path)).sort(byCodePoint);
}

/**
 * Writes the kit's checksum list, one `<sha256>  <path>` line per kit file in code-point order of path,
 * the format `shasum -a 256 -c` verifies. Returns the list's own SHA-256.
 */
export async function writeChecksumList(kitDir) {
  const lines = [];
  for (const path of await listKitFiles(kitDir)) {
    lines.push(`${sha256Hex(await readFile(resolve(kitDir, path)))}  ${path}\n`);
  }
  const content = lines.join("");
  await writeFile(resolve(kitDir, CHECKSUM_LIST_FILE), content, "utf8");
  return sha256Hex(content);
}

// Writes the checksum-list digest in the same one-line format that `shasum -a 256 -c` accepts.
export async function writeKitDigest(kitDir) {
  const checksumListDigest = sha256Hex(await readFile(resolve(kitDir, CHECKSUM_LIST_FILE)));
  await writeFile(resolve(kitDir, KIT_DIGEST_FILE), `${checksumListDigest}  ${CHECKSUM_LIST_FILE}\n`, "utf8");
  return checksumListDigest;
}

export function parseChecksumList(content) {
  const listed = new Map();
  for (const line of content.split("\n").filter(Boolean)) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    assert(match, `${CHECKSUM_LIST_FILE}: malformed line: ${line}`);
    listed.set(match[2], match[1]);
  }
  return listed;
}

/**
 * Recomputes the checksum list from the kit's files: it must list exactly the kit's files, each with its
 * current digest. Returns the list's own SHA-256.
 */
export async function verifyChecksumList(kitDir) {
  const content = await readFile(resolve(kitDir, CHECKSUM_LIST_FILE), "utf8");
  const listed = parseChecksumList(content);
  const files = await listKitFiles(kitDir);
  for (const path of files) {
    assert(listed.has(path), `${CHECKSUM_LIST_FILE} does not list the kit file ${path}`);
    const actual = sha256Hex(await readFile(resolve(kitDir, path)));
    assert(listed.get(path) === actual, `${CHECKSUM_LIST_FILE}: ${path} changed after the build`);
  }
  assert(listed.size === files.length, `${CHECKSUM_LIST_FILE} lists files the kit does not contain`);
  return sha256Hex(content);
}

// The commands the evaluation guide tells an evaluator to run inside the unpacked kit: every line of every
// fenced block in its kit identity section. Every such block must be an `sh` block, so that no command the
// section documents escapes the checks below.
function guideIntegrityCommands(guideText) {
  const heading = GUIDE_INTEGRITY_SECTION.exec(guideText);
  assert(heading, `${GUIDE} has no kit identity section`);
  const rest = guideText.slice(heading.index + heading[0].length);
  const nextSection = rest.search(/^## /m);
  const section = nextSection === -1 ? rest : rest.slice(0, nextSection);
  const commands = [];
  for (const [, language, body] of section.matchAll(/^[ \t]*```(\S*)\n([\s\S]*?)^[ \t]*```/gm)) {
    assert(language === "sh", `${GUIDE}'s kit identity section may hold only sh blocks, found \`${language}\``);
    commands.push(...body.split("\n").map((line) => line.trim()).filter(Boolean));
  }
  assert(commands.length > 0, `${GUIDE}'s kit identity section documents no integrity command`);
  return commands;
}

// Validates one documented command and returns its arguments: only `shasum`, naming only files the kit
// ships, so an evaluator needs nothing but the kit to run it.
function integrityCommandArgs(command, kitDir) {
  const [program, ...args] = command.split(/\s+/);
  assert(program === "shasum", `${GUIDE} integrity command must use only shasum: ${command}`);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-a") {
      i++;
    } else if (!args[i].startsWith("-")) {
      assert(existsSync(resolve(kitDir, args[i])), `${GUIDE} integrity command names a file the kit does not ship: ${command}`);
    }
  }
  return args;
}

// Reads the sole checksum-list digest recorded outside the checksum list. Keeping this parser strict makes
// the file usable directly with `shasum -a 256 -c` and prevents a second line from changing its meaning.
export async function readKitDigest(kitDir) {
  const content = await readFile(resolve(kitDir, KIT_DIGEST_FILE), "utf8");
  const match = /^([0-9a-f]{64}) {2}checksums\.sha256\n$/.exec(content);
  assert(match, `${KIT_DIGEST_FILE} must contain exactly one ${CHECKSUM_LIST_FILE} digest`);
  return match[1];
}

// Every digest the kit records: each listed file's, and the checksum list's own, from its separate digest file.
async function recordedDigests(kitDir) {
  const records = parseChecksumList(await readFile(resolve(kitDir, CHECKSUM_LIST_FILE), "utf8"));
  records.set(CHECKSUM_LIST_FILE, await readKitDigest(kitDir));
  return records;
}

// A digest the guide has an evaluator compute must be one the kit records, or there is nothing to compare
// it with. `shasum -c` prints `<path>: OK` lines, which carry no digest.
function assertPrintedDigestsRecorded(output, records, command) {
  for (const line of output.split("\n")) {
    const printed = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (printed) {
      assert(records.get(printed[2]) === printed[1], `${GUIDE} integrity command \`${command}\` printed a digest the kit does not record for ${printed[2]}`);
    }
  }
}

export function runShasum(args, cwd, label) {
  try {
    return runChecked("shasum", args, { cwd, capture: true });
  } catch (err) {
    throw new Error(`${label} failed: ${err.message}`);
  }
}

export function runChecksumListCheck(kitDir) {
  return runShasum(["-a", "256", "-c", CHECKSUM_LIST_FILE], kitDir, `shasum -a 256 -c ${CHECKSUM_LIST_FILE}`);
}

export function runKitDigestCheck(kitDir) {
  return runShasum(["-a", "256", "-c", KIT_DIGEST_FILE], kitDir, `shasum -a 256 -c ${KIT_DIGEST_FILE}`);
}

async function withUnpackedKit(kitDir, run) {
  const workDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-unpacked-"));
  try {
    const archive = resolve(workDir, "kit.tar.gz");
    runChecked("tar", ["-czf", archive, "-C", dirname(kitDir), basename(kitDir)], { capture: true });
    const unpackRoot = resolve(workDir, "unpacked");
    await mkdir(unpackRoot);
    runChecked("tar", ["-xzf", archive, "-C", unpackRoot], { capture: true });
    return await run(resolve(unpackRoot, basename(kitDir)));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Archives the kit, unpacks it in a fresh directory, and there runs `shasum -a 256 -c` over the checksum
 * list, then every integrity command the kit's evaluation guide documents. Each command must pass, and
 * every digest it prints must be one the kit records. Returns the guide commands that ran so the kit gate's
 * verification summary can name them without claiming the guide's archive command.
 */
export async function verifyUnpackedKitIntegrity(kitDir) {
  return withUnpackedKit(kitDir, async (unpacked) => {
    runChecksumListCheck(unpacked);
    runKitDigestCheck(unpacked);
    const records = await recordedDigests(unpacked);
    const guideText = await readFile(resolve(unpacked, GUIDE), "utf8");
    const commands = guideIntegrityCommands(guideText);
    for (const command of commands) {
      const output = runShasum(integrityCommandArgs(command, unpacked), unpacked, `${GUIDE} integrity command \`${command}\``);
      assertPrintedDigestsRecorded(output, records, command);
    }
    return commands;
  });
}
