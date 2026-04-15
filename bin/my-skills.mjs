#!/usr/bin/env node
import * as clack from "@clack/prompts";
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

function linkSkills(scope, names) {
  const available = listAvailable();
  if (available.length === 0) {
    console.error("✗ repo 안에 스킬을 찾지 못했습니다.");
    process.exit(1);
  }

  const dest = targetDir(scope);
  mkdirSync(dest, { recursive: true });

  for (const name of names) {
    if (!available.includes(name)) {
      console.warn(`⚠ ${name}: 존재하지 않는 스킬 (사용 가능: ${available.join(", ")})`);
      continue;
    }
    const linkPath = join(dest, name);
    const target = join(CLONE_DIR, "skills", name);

    if (lstatExists(linkPath)) {
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

async function install(scope, names, scopeExplicit) {
  ensureRepo();
  const available = listAvailable();
  if (available.length === 0) {
    console.error("✗ repo 안에 스킬을 찾지 못했습니다.");
    process.exit(1);
  }

  // 인수 없이 install 호출 → 인터랙티브 모드
  if (names.length === 0) {
    await interactiveInstall(scope, scopeExplicit, available);
    return;
  }

  const wantAll = names.includes("--all");
  const explicitNames = names.filter((n) => n !== "--all");
  const targets = wantAll ? available : explicitNames;
  linkSkills(scope, targets);
}

async function interactiveInstall(defaultScope, scopeExplicit, available) {
  clack.intro("my-claude-skills: 인터랙티브 설치");

  const selected = await clack.multiselect({
    message: "설치할 스킬을 선택하세요 (space: 토글, enter: 확정)",
    options: available.map((name) => ({ value: name, label: name })),
    required: true,
  });

  if (clack.isCancel(selected)) {
    clack.cancel("취소됨");
    process.exit(0);
  }

  let scope = defaultScope;
  if (!scopeExplicit) {
    const picked = await clack.select({
      message: "어디에 설치할까요?",
      options: [
        {
          value: "global",
          label: `Global  (~/.claude/skills/)`,
          hint: "모든 프로젝트에서 활성화",
        },
        {
          value: "project",
          label: `Project (${PROJECT_SKILLS_DIR})`,
          hint: "현재 디렉토리 한정",
        },
      ],
      initialValue: "global",
    });
    if (clack.isCancel(picked)) {
      clack.cancel("취소됨");
      process.exit(0);
    }
    scope = picked;
  }

  const spinner = clack.spinner();
  spinner.start(`심볼릭 링크 생성 중 (${selected.length}개)`);
  linkSkills(scope, selected);
  spinner.stop("완료");

  clack.outro(`✓ ${selected.length}개 스킬 설치됨 → ${targetDir(scope)}`);
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
  const wantAll = names.includes("--all");
  const explicitNames = names.filter((n) => n !== "--all");

  if (!wantAll && explicitNames.length === 0) {
    console.error("✗ 제거할 스킬 이름이 필요합니다 (또는 --all 로 관리 대상 전체 제거).");
    process.exit(1);
  }

  const dest = targetDir(scope);
  let targets;

  if (wantAll) {
    if (!existsSync(dest)) {
      console.log("(아무것도 설치되지 않음)");
      return;
    }
    targets = readdirSync(dest)
      .filter((n) => !n.startsWith("."))
      .filter((n) => {
        const p = join(dest, n);
        try {
          const st = lstatSync(p);
          if (!st.isSymbolicLink()) return false;
          const target = readlinkSync(p);
          return target.startsWith(CLONE_DIR);
        } catch {
          return false;
        }
      });
    if (targets.length === 0) {
      console.log("(관리 대상인 스킬이 없음)");
      return;
    }
    console.log(`→ my-claude-skills 관리 대상 ${targets.length}개 제거: ${targets.join(", ")}`);
  } else {
    targets = explicitNames;
  }

  for (const name of targets) {
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
  const scopeExplicit = argv.includes("--project") || argv.includes("--global");
  const scope = argv.includes("--project") ? "project" : "global";
  const rest = argv.filter((a) => a !== "--project" && a !== "--global");
  return { scope, scopeExplicit, rest };
}

function usage() {
  console.log(`사용법:
  npx -y github:jamin12/my-claude-skills install [skill...] [--project]
      # 인수 없음 또는 --all 이면 모든 스킬 설치
  npx -y github:jamin12/my-claude-skills list [--project]
  npx -y github:jamin12/my-claude-skills remove <skill...> [--project]
  npx -y github:jamin12/my-claude-skills remove --all [--project]
      # my-claude-skills 로 관리되는 심볼릭 링크 전체 제거 (다른 스킬은 건드리지 않음)
  npx -y github:jamin12/my-claude-skills update

기본 스코프는 ~/.claude/skills/ (글로벌).
--project 를 주면 현재 디렉토리의 ./.claude/skills/ 로 설치/제거.
update 는 ~/.my-claude-skills 를 git pull 해서 모든 설치된 링크가 즉시 반영됨.
`);
}

async function main() {
  const [cmd, ...rawArgs] = process.argv.slice(2);
  const { scope, scopeExplicit, rest } = parseArgs(rawArgs);

  switch (cmd) {
    case "install":
      await install(scope, rest, scopeExplicit);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
