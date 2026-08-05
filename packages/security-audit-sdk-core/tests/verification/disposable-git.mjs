import { spawnSync } from "node:child_process";
import { devNull } from "node:os";

export const DISPOSABLE_GIT_IDENTITY = Object.freeze({
  name: "Bloodtrail Verification",
  email: "verification@invalid.example",
});

const boundedConfig = Object.freeze([
  "-c", `user.name=${DISPOSABLE_GIT_IDENTITY.name}`,
  "-c", `user.email=${DISPOSABLE_GIT_IDENTITY.email}`,
  "-c", "commit.gpgsign=false",
  "-c", `core.hooksPath=${devNull}`,
]);

export function disposableGitEnvironment(environment = process.env) {
  const isolated = Object.fromEntries(
    Object.entries(environment).filter(([key]) => !key.startsWith("GIT_CONFIG_")),
  );
  return {
    ...isolated,
    GIT_AUTHOR_NAME: DISPOSABLE_GIT_IDENTITY.name,
    GIT_AUTHOR_EMAIL: DISPOSABLE_GIT_IDENTITY.email,
    GIT_COMMITTER_NAME: DISPOSABLE_GIT_IDENTITY.name,
    GIT_COMMITTER_EMAIL: DISPOSABLE_GIT_IDENTITY.email,
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_SYSTEM: devNull,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
  };
}

export function runDisposableGit(cwd, args) {
  if (args.includes("--global") || args.includes("--system")) {
    throw new Error("disposable Git helper refuses global or system configuration writes");
  }
  return spawnSync("git", [...boundedConfig, ...args], {
    cwd,
    encoding: "utf8",
    env: disposableGitEnvironment(),
  });
}
