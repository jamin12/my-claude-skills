#!/usr/bin/env node
import * as clack from "@clack/prompts";
import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/jamin12/my-claude-skills.git";
const CLONE_DIR = join(homedir(), ".my-claude-skills");
const BUNDLES_FILE = "bundles.json";
const PACKAGE_ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const TARGETS = {
  "claude-global": {
    dir: join(homedir(), ".claude", "skills"),
    label: "Claude Global",
    hint: "모든 Claude 프로젝트에서 활성화",
  },
  "claude-project": {
    dir: resolve(".claude", "skills"),
    label: "Claude Project",
    hint: "현재 프로젝트의 Claude 전용",
  },
  "codex-user": {
    dir: join(homedir(), ".agents", "skills"),
    label: "Codex User",
    hint: "공식 Codex 사용자 스킬 경로",
  },
  "codex-project": {
    dir: resolve(".agents", "skills"),
    label: "Codex Project",
    hint: "현재 프로젝트의 Codex 전용",
  },
  "codex-home": {
    dir: join(homedir(), ".codex", "skills"),
    label: "Codex Home",
    hint: "Codex 내부 홈 경로 호환용",
  },
};

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

function buildSkillIndex(baseDir = CLONE_DIR) {
  const skillsRoot = join(baseDir, "skills");
  const index = new Map();

  function visit(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const hasSkill = entries.some((entry) => entry.isFile() && entry.name === "SKILL.md");

    if (hasSkill) {
      const name = basename(dir);
      if (index.has(name)) {
        const prev = index.get(name);
        throw new Error(
          `중복 스킬 이름: ${name} (${prev.relativeDir}, ${relative(skillsRoot, dir)})`
        );
      }

      index.set(name, {
        name,
        dir,
        relativeDir: relative(skillsRoot, dir),
      });
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        visit(join(dir, entry.name));
      }
    }
  }

  if (!existsSync(skillsRoot)) return index;
  visit(skillsRoot);
  return index;
}

function listAvailable() {
  const index = buildSkillIndex();
  return [...index.keys()].sort();
}

function getSkillEntryMap(baseDir = CLONE_DIR) {
  const index = buildSkillIndex(baseDir);
  return new Map([...index.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function skillCategoryOf(skill) {
  const segments = skill.relativeDir.split("/");
  return segments.length > 1 ? segments[0] : "general";
}

function categoryLabel(category) {
  return category === "general" ? "general" : category;
}

function buildCategoryMap(skillMap) {
  const categories = new Map();

  for (const skill of skillMap.values()) {
    const category = skillCategoryOf(skill);
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category).push(skill);
  }

  return new Map(
    [...categories.entries()]
      .map(([category, skills]) => [category, skills.sort((a, b) => a.name.localeCompare(b.name))])
      .sort(([a], [b]) => {
        if (a === "general") return -1;
        if (b === "general") return 1;
        return a.localeCompare(b);
      })
  );
}

function loadBundles(baseDir = CLONE_DIR) {
  const path = join(baseDir, BUNDLES_FILE);
  if (!existsSync(path)) return {};

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${BUNDLES_FILE} 형식이 올바르지 않습니다.`);
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([name, skills]) => {
      if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== "string")) {
        throw new Error(`${BUNDLES_FILE}: ${name} 은 문자열 배열이어야 합니다.`);
      }
      return [name, skills];
    })
  );
}

function expandNames(names, available, bundles) {
  const resolved = [];
  const seen = new Set();

  for (const name of names) {
    if (name.startsWith("@")) {
      const bundleName = name.slice(1);
      const bundleSkills = bundles[bundleName];
      if (!bundleSkills) {
        console.warn(
          `⚠ @${bundleName}: 존재하지 않는 번들 (사용 가능: ${Object.keys(bundles).join(", ") || "없음"})`
        );
        continue;
      }

      for (const skillName of bundleSkills) {
        if (!available.includes(skillName)) {
          console.warn(`⚠ @${bundleName}: ${skillName} 스킬이 repo 에 없습니다.`);
          continue;
        }
        if (!seen.has(skillName)) {
          seen.add(skillName);
          resolved.push(skillName);
        }
      }
      continue;
    }

    if (!seen.has(name)) {
      seen.add(name);
      resolved.push(name);
    }
  }

  return resolved;
}

function targetDir(target) {
  return TARGETS[target].dir;
}

function targetLabel(target) {
  return `${TARGETS[target].label} (${TARGETS[target].dir})`;
}

function validateTarget(target) {
  if (!TARGETS[target]) {
    console.error(
      `✗ 알 수 없는 target: ${target} (사용 가능: ${Object.keys(TARGETS).join(", ")})`
    );
    process.exit(1);
  }
}

function linkSkills(target, names) {
  const skillMap = getSkillEntryMap();
  const available = [...skillMap.keys()];
  const bundles = loadBundles();
  if (available.length === 0) {
    console.error("✗ repo 안에 스킬을 찾지 못했습니다.");
    process.exit(1);
  }

  validateTarget(target);
  const dest = targetDir(target);
  mkdirSync(dest, { recursive: true });

  for (const name of expandNames(names, available, bundles)) {
    const skill = skillMap.get(name);
    if (!skill) {
      console.warn(`⚠ ${name}: 존재하지 않는 스킬 (사용 가능: ${available.join(", ")})`);
      continue;
    }
    const linkPath = join(dest, name);
    const sourcePath = skill.dir;

    if (lstatExists(linkPath)) {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const current = readlinkSync(linkPath);
        if (current === sourcePath) {
          console.log(`✓ ${name}: 이미 링크됨`);
          continue;
        }
        rmSync(linkPath);
      } else {
        console.warn(`⚠ ${linkPath}: 실제 디렉토리/파일이 존재합니다. 수동 확인 필요.`);
        continue;
      }
    }

    symlinkSync(sourcePath, linkPath, "dir");
    console.log(`✓ ${name}: ${linkPath} → ${sourcePath}`);
  }
}

async function install(target, names, targetExplicit) {
  ensureRepo();
  const skillMap = getSkillEntryMap();
  const available = [...skillMap.keys()];
  const bundles = loadBundles();
  if (available.length === 0) {
    console.error("✗ repo 안에 스킬을 찾지 못했습니다.");
    process.exit(1);
  }

  // 인수 없이 install 호출 → 인터랙티브 모드
  if (names.length === 0) {
    await interactiveInstall(target, targetExplicit, available);
    return;
  }

  const wantAll = names.includes("--all");
  const explicitNames = names.filter((n) => n !== "--all");
  const targets = wantAll ? available : expandNames(explicitNames, available, bundles);
  linkSkills(target, targets);
}

async function interactiveInstall(defaultTarget, targetExplicit, available) {
  clack.intro("my-claude-skills: 인터랙티브 설치");
  const skillMap = getSkillEntryMap();
  const categoryMap = buildCategoryMap(skillMap);

  const pickedCategories = await clack.multiselect({
    message: "설치할 카테고리를 선택하세요 (space: 토글, enter: 확정)",
    options: [...categoryMap.entries()].map(([category, skills]) => ({
      value: category,
      label: categoryLabel(category),
      hint: `${skills.length}개`,
    })),
    required: true,
  });

  if (clack.isCancel(pickedCategories)) {
    clack.cancel("취소됨");
    process.exit(0);
  }

  const selectedSkills = available.filter((name) => {
    const skill = skillMap.get(name);
    return skill && pickedCategories.includes(skillCategoryOf(skill));
  });

  const selected = await clack.multiselect({
    message: "설치할 스킬을 선택하세요 (space: 토글, enter: 확정)",
    options: selectedSkills.map((name) => {
      const skill = skillMap.get(name);
      return {
        value: name,
        label: name,
        hint: skill ? `${categoryLabel(skillCategoryOf(skill))} / ${skill.relativeDir}` : undefined,
      };
    }),
    required: true,
  });

  if (clack.isCancel(selected)) {
    clack.cancel("취소됨");
    process.exit(0);
  }

  let target = defaultTarget;
  if (!targetExplicit) {
    const picked = await clack.select({
      message: "어디에 설치할까요?",
      options: Object.entries(TARGETS).map(([value, meta]) => ({
        value,
        label: `${meta.label} (${meta.dir})`,
        hint: meta.hint,
      })),
      initialValue: defaultTarget,
    });
    if (clack.isCancel(picked)) {
      clack.cancel("취소됨");
      process.exit(0);
    }
    target = picked;
  }

  const spinner = clack.spinner();
  spinner.start(`심볼릭 링크 생성 중 (${selected.length}개)`);
  linkSkills(target, selected);
  spinner.stop("완료");

  clack.outro(`✓ ${selected.length}개 스킬 설치됨 → ${targetDir(target)}`);
}

function lstatExists(p) {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function list(target) {
  validateTarget(target);
  const dest = targetDir(target);
  console.log(`타깃: ${targetLabel(target)}`);
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

function remove(target, names) {
  const bundles = loadBundles();
  const available = listAvailable();
  const wantAll = names.includes("--all");
  const explicitNames = names.filter((n) => n !== "--all");

  if (!wantAll && explicitNames.length === 0) {
    console.error("✗ 제거할 스킬 이름이 필요합니다 (또는 --all 로 관리 대상 전체 제거).");
    process.exit(1);
  }

  validateTarget(target);
  const dest = targetDir(target);
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
    targets = expandNames(explicitNames, available, bundles);
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

function listBundlesCommand() {
  const baseDir = existsSync(join(CLONE_DIR, BUNDLES_FILE)) ? CLONE_DIR : PACKAGE_ROOT_DIR;
  const bundles = loadBundles(baseDir);
  const entries = Object.entries(bundles).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    console.log("(정의된 번들이 없음)");
    return;
  }

  console.log("번들 목록:");
  for (const [name, skills] of entries) {
    console.log(`  @${name} (${skills.length}개): ${skills.join(", ")}`);
  }
}

function parseArgs(argv) {
  let client = null;
  let scope = null;
  let target = null;
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--claude" || arg === "--codex") {
      client = arg.slice(2);
      continue;
    }
    if (arg === "--global" || arg === "--project" || arg === "--user") {
      scope = arg.slice(2);
      continue;
    }
    if (arg === "--target") {
      target = argv[i + 1];
      if (!target) {
        console.error("✗ --target 다음에 target 이름이 필요합니다.");
        process.exit(1);
      }
      i += 1;
      continue;
    }

    rest.push(arg);
  }

  if (target && (client || scope)) {
    console.error("✗ --target 은 --claude/--codex/--global/--project/--user 와 함께 쓸 수 없습니다.");
    process.exit(1);
  }

  if (target) {
    validateTarget(target);
    return { target, targetExplicit: true, rest };
  }

  if (scope === "user" && !client) {
    client = "codex";
  }

  const targetExplicit = Boolean(client || scope);
  const resolvedClient = client ?? "claude";
  const resolvedScope = scope ?? "global";

  if (resolvedClient === "claude") {
    if (resolvedScope === "global") return { target: "claude-global", targetExplicit, rest };
    if (resolvedScope === "project") return { target: "claude-project", targetExplicit, rest };
    console.error("✗ Claude 는 --global 또는 --project 만 지원합니다.");
    process.exit(1);
  }

  if (resolvedClient === "codex") {
    if (resolvedScope === "global" || resolvedScope === "user") {
      return { target: "codex-user", targetExplicit, rest };
    }
    if (resolvedScope === "project") return { target: "codex-project", targetExplicit, rest };
  }

  console.error("✗ Codex 는 --global/--user 또는 --project 를 지원합니다.");
  process.exit(1);
}

function usage() {
  console.log(`사용법:
  npx -y github:jamin12/my-claude-skills install [skill...] [--claude|--codex] [--global|--project|--user]
  npx -y github:jamin12/my-claude-skills install [skill...] --target <target>
      # 번들은 @backend 같은 형태로 지정
      # 인수 없음 또는 --all 이면 모든 스킬 설치
  npx -y github:jamin12/my-claude-skills list [--claude|--codex] [--global|--project|--user]
  npx -y github:jamin12/my-claude-skills list --target <target>
  npx -y github:jamin12/my-claude-skills remove <skill...> [--claude|--codex] [--global|--project|--user]
  npx -y github:jamin12/my-claude-skills remove <skill...> --target <target>
  npx -y github:jamin12/my-claude-skills remove --all [--claude|--codex] [--global|--project|--user]
      # my-claude-skills 로 관리되는 심볼릭 링크 전체 제거 (다른 스킬은 건드리지 않음)
  npx -y github:jamin12/my-claude-skills bundles
  npx -y github:jamin12/my-claude-skills update

기본 타깃은 Claude global (~/.claude/skills/).
기존 호환: --project 만 주면 Claude project (./.claude/skills/).
Codex 사용자 스킬: --codex --global 또는 --codex --user → ~/.agents/skills/
Codex 프로젝트 스킬: --codex --project → ./.agents/skills/
직접 target 지정: ${Object.keys(TARGETS).join(", ")}
update 는 ~/.my-claude-skills 를 git pull 해서 모든 설치된 링크가 즉시 반영됨.
`);
}

async function main() {
  const [cmd, ...rawArgs] = process.argv.slice(2);
  const { target, targetExplicit, rest } = parseArgs(rawArgs);

  switch (cmd) {
    case "install":
      await install(target, rest, targetExplicit);
      break;
    case "list":
      list(target);
      break;
    case "remove":
      remove(target, rest);
      break;
    case "update":
      update();
      break;
    case "bundles":
      listBundlesCommand();
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
