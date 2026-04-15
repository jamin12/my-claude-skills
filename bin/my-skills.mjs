#!/usr/bin/env node
import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const REPO_URL = "https://github.com/jamin12/my-claude-skills.git";
const CLONE_DIR = join(homedir(), ".my-claude-skills");
const GLOBAL_SKILLS_DIR = join(homedir(), ".claude", "skills");
const PROJECT_SKILLS_DIR = resolve(".claude", "skills");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureRepo() {
  if (existsSync(CLONE_DIR)) {
    console.log(`→ 업데이트: ${CLONE_DIR}`);
    run(`git -C "${CLONE_DIR}" pull --ff-only`);
  } else {
    console.log(`→ 최초 clone: ${REPO_URL} → ${CLONE_DIR}`);
    run(`git clone "${REPO_URL}" "${CLONE_DIR}"`);
  }
}

function listAvailable() {
  const dir = join(CLONE_DIR, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

function targetDir(scope) {
  return scope === "project" ? PROJECT_SKILLS_DIR : GLOBAL_SKILLS_DIR;
}

function install(scope, names) {
  ensureRepo();
  const available = listAvailable();
  if (available.length === 0) {
    console.error("✗ repo 안에 스킬을 찾지 못했습니다.");
    process.exit(1);
  }

  const dest = targetDir(scope);
  mkdirSync(dest, { recursive: true });

  const wantAll = names.includes("--all") || names.length === 0;
  const targets = wantAll ? available : names;

  for (const name of targets) {
    if (!available.includes(name)) {
      console.warn(`⚠ ${name}: 존재하지 않는 스킬 (사용 가능: ${available.join(", ")})`);
      continue;
    }
    const linkPath = join(dest, name);
    const target = join(CLONE_DIR, "skills", name);

    if (existsSync(linkPath) || lstatExists(linkPath)) {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const current = readlinkSync(linkPath);
        if (current === target) {
          console.log(`✓ ${name}: 이미 링크됨`);
          continue;
        }
        rmSync(linkPath);
      } else {
        console.warn(`⚠ ${linkPath}: 실제 디렉토리/파일이 존재합니다. 수동 확인 필요.`);
        continue;
      }
    }

    symlinkSync(target, linkPath, "dir");
    console.log(`✓ ${name}: ${linkPath} → ${target}`);
  }
}

function lstatExists(p) {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function list(scope) {
  const dest = targetDir(scope);
  console.log(`스코프: ${scope === "project" ? "project" : "global"}  (${dest})`);
  if (!existsSync(dest)) {
    console.log("(아무것도 설치되지 않음)");
    return;
  }

  const names = readdirSync(dest)
    .filter((n) => !n.startsWith("."))
    .sort();
  if (names.length === 0) {
    console.log("(비어있음)");
    return;
  }

  for (const name of names) {
    const p = join(dest, name);
    const stat = lstatSync(p);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(p);
      const mark = target.startsWith(CLONE_DIR) ? "●" : "○";
      console.log(`  ${mark} ${name}  →  ${target}`);
    } else {
      console.log(`    ${name}  (local, not managed)`);
    }
  }
  console.log("\n● = my-claude-skills 로 관리됨, ○ = 다른 경로 심볼릭 링크, (local) = 관리 대상 아님");
}

function remove(scope, names) {
  if (names.length === 0) {
    console.error("✗ 제거할 스킬 이름이 필요합니다.");
    process.exit(1);
  }
  const dest = targetDir(scope);
  for (const name of names) {
    const p = join(dest, name);
    if (!lstatExists(p)) {
      console.warn(`⚠ ${name}: 설치되지 않음`);
      continue;
    }
    const stat = lstatSync(p);
    if (!stat.isSymbolicLink()) {
      console.warn(`⚠ ${name}: 심볼릭 링크가 아니라 실제 디렉토리입니다. 수동 확인 필요.`);
      continue;
    }
    rmSync(p);
    console.log(`✓ ${name}: 제거됨`);
  }
}

function update() {
  if (!existsSync(CLONE_DIR)) {
    console.error(`✗ ${CLONE_DIR} 이 없습니다. 먼저 install 을 실행하세요.`);
    process.exit(1);
  }
  run(`git -C "${CLONE_DIR}" pull --ff-only`);
  console.log("\n✓ 업데이트 완료. 심볼릭 링크는 자동으로 새 버전을 가리킵니다.");
}

function parseArgs(argv) {
  const scope = argv.includes("--project") ? "project" : "global";
  const rest = argv.filter((a) => a !== "--project" && a !== "--global");
  return { scope, rest };
}

function usage() {
  console.log(`사용법:
  npx -y github:jamin12/my-claude-skills install [skill...] [--project]
      # 인수 없음 또는 --all 이면 모든 스킬 설치
  npx -y github:jamin12/my-claude-skills list [--project]
  npx -y github:jamin12/my-claude-skills remove <skill...> [--project]
  npx -y github:jamin12/my-claude-skills update

기본 스코프는 ~/.claude/skills/ (글로벌).
--project 를 주면 현재 디렉토리의 ./.claude/skills/ 로 설치/제거.
update 는 ~/.my-claude-skills 를 git pull 해서 모든 설치된 링크가 즉시 반영됨.
`);
}

function main() {
  const [cmd, ...rawArgs] = process.argv.slice(2);
  const { scope, rest } = parseArgs(rawArgs);

  switch (cmd) {
    case "install":
      install(scope, rest);
      break;
    case "list":
      list(scope);
      break;
    case "remove":
      remove(scope, rest);
      break;
    case "update":
      update();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      process.exit(cmd ? 0 : 1);
      break;
    default:
      console.error(`✗ 알 수 없는 명령: ${cmd}\n`);
      usage();
      process.exit(1);
  }
}

main();
