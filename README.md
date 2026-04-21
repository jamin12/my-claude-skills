# my-claude-skills

개인용 Claude/Codex 스킬 저장소. 여러 프로젝트·여러 컴퓨터에서 같은 스킬을 심볼릭 링크 기반으로 공유한다. 외부 CLI 의존 없이 `npx` 로 직접 실행되는 얇은 Node.js 스크립트(`bin/my-skills.mjs`) 하나로 설치/업데이트를 관리한다. 저장소 이름은 예전 이름을 유지하지만, 이제 Claude와 Codex 둘 다 지원한다.

## 동작 원리

1. `npx github:jamin12/my-claude-skills install ...` 실행
2. `bin/my-skills.mjs` 가 `~/.my-claude-skills` 에 repo 를 clone (또는 기존 clone 을 `git pull`)
3. `~/.my-claude-skills/skills/**/<name>` 를 재귀 탐색해서, 설치 시에는 선택한 대상 디렉토리(`~/.claude/skills`, `./.claude/skills`, `~/.agents/skills`, `./.agents/skills`, `~/.codex/skills`) 아래에 `<name>` 으로 평탄하게 심볼릭 링크 생성
4. 이후 스킬 수정은 `~/.my-claude-skills` 에서만 하고 `git push`
5. 다른 컴퓨터에서는 `npx github:jamin12/my-claude-skills update` 한 줄로 모든 설치가 즉시 최신 상태

Node.js 외 다른 런타임·CLI 가 필요하지 않다. 심볼릭 링크라서 `update` 후 재설치도 필요 없다.

## 설치

### 새 컴퓨터 세팅 (Claude 글로벌)

```bash
# 전부 설치
npx -y github:jamin12/my-claude-skills install

# 일부만 설치
npx -y github:jamin12/my-claude-skills install spec-setup cmux-worktree
```

`~/.claude/skills/` 아래에 심볼릭 링크가 생성된다. 원본은 `~/.my-claude-skills/skills/` 아래의 실제 스킬 디렉토리다.

인수 없이 `install` 을 실행하면 인터랙티브 모드가 열리고, 먼저 카테고리(`backend`, `general` 등)를 고른 뒤 그 안의 스킬을 선택하게 된다.

### Codex 사용자 전역에 설치

```bash
# Codex 사용자 스킬 경로 (~/.agents/skills)
npx -y github:jamin12/my-claude-skills install --codex --global

# backend 번들을 한 번에 설치
npx -y github:jamin12/my-claude-skills install --codex --global @backend
```

`~/.agents/skills/` 아래에 심볼릭 링크가 생성된다.

### 프로젝트에 설치

프로젝트 루트에서 설치 대상을 명시한다:

```bash
cd <your-project>

# Claude 프로젝트 스킬 (기존 방식과 동일)
npx -y github:jamin12/my-claude-skills install --project \
  domain-model jpa-entity rest-controller usecase \
  setup-gradle mapper testing architecture code-convention ai-memory-plan

# Codex 프로젝트 스킬
npx -y github:jamin12/my-claude-skills install --codex --project \
  domain-model jpa-entity rest-controller usecase \
  setup-gradle mapper testing architecture code-convention ai-memory-plan
```

Claude 는 `./.claude/skills/`, Codex 는 `./.agents/skills/` 아래에 심볼릭 링크가 생성된다.

### Codex 내부 홈 경로에 설치

Codex 내장 installer 와 같은 경로를 직접 쓰고 싶다면:

```bash
npx -y github:jamin12/my-claude-skills install --target codex-home
```

이 경우 `~/.codex/skills/` 아래에 심볼릭 링크가 생성된다.

## 명령어

```bash
# 업데이트 (모든 컴퓨터 공통)
npx -y github:jamin12/my-claude-skills update

# 번들 확인
npx -y github:jamin12/my-claude-skills bundles

# 설치된 스킬 확인
npx -y github:jamin12/my-claude-skills list
npx -y github:jamin12/my-claude-skills list --project
npx -y github:jamin12/my-claude-skills list --codex --global
npx -y github:jamin12/my-claude-skills list --codex --project
npx -y github:jamin12/my-claude-skills list --target codex-home

# 제거
npx -y github:jamin12/my-claude-skills remove spec-setup
npx -y github:jamin12/my-claude-skills remove --project usecase
npx -y github:jamin12/my-claude-skills remove --codex --project usecase
npx -y github:jamin12/my-claude-skills remove --codex --project @backend
```

`update` 는 `~/.my-claude-skills` 를 `git pull` 한 번 하는 것. 심볼릭 링크가 새 파일 내용을 자동으로 가리킨다.

## 설치 대상

| 대상 | 명령 예시 | 경로 |
|------|-----------|------|
| Claude global | `install` | `~/.claude/skills/` |
| Claude project | `install --project` | `./.claude/skills/` |
| Codex user | `install --codex --global` | `~/.agents/skills/` |
| Codex project | `install --codex --project` | `./.agents/skills/` |
| Codex home | `install --target codex-home` | `~/.codex/skills/` |

Codex는 공식 문서 기준으로 사용자 스킬은 `~/.agents/skills/`, 프로젝트 스킬은 `./.agents/skills/` 를 사용하는 쪽을 우선 권장한다. `~/.codex/skills/` 는 Codex 내부 홈 경로와의 호환용 타깃이다.

## 번들

자주 같이 쓰는 스킬 묶음은 `bundles.json` 에 정의한다. 설치/제거 시 번들은 `@이름` 형태로 넘긴다.

```bash
# 번들 목록 보기
npx -y github:jamin12/my-claude-skills bundles

# backend 묶음 설치
npx -y github:jamin12/my-claude-skills install --codex --project @backend

# 개별 스킬과 섞어서 설치 가능
npx -y github:jamin12/my-claude-skills install --codex --project @backend spec-setup
```

현재 제공 번들:

| 번들 | 포함 스킬 |
|------|-----------|
| `@backend` | `architecture`, `domain-model`, `usecase`, `rest-controller`, `jpa-entity`, `mapper`, `testing`, `setup-gradle`, `code-convention` |

## 저장소 구조

저장소 안에서는 카테고리별로 폴더를 나눌 수 있다. 예를 들어 backend 스킬은 다음처럼 정리해도, 설치 결과는 여전히 `architecture`, `usecase` 같은 평탄한 이름으로 생성된다.

```text
skills/
  backend/
    architecture/
    code-convention/
    domain-model/
    jpa-entity/
    mapper/
    rest-controller/
    setup-gradle/
    testing/
    usecase/
  ai-memory-plan/
  cmux-worktree/
  spec-setup/
```

## 스킬 목록

### 범용 (어떤 프로젝트에도 적용)

| 스킬 | 설명 |
|------|------|
| `spec-setup` | CLAUDE.md + `docs/specs/` 기반 맥락 문서 체계를 새 프로젝트에 이식 |
| `cmux-worktree` | git worktree 생성/삭제 + cmux(iTerm2) 새 탭 + Claude 세션 마이그레이션 |

### Kotlin / Spring Boot / 헥사고날 아키텍처 전용

| 스킬 | 설명 |
|------|------|
| `architecture` | 헥사고날(Ports & Adapters) 레이어 구조와 의존성 방향 |
| `domain-model` | 도메인 모델·VO 작성 규칙 (private constructor, factory, 불변성) |
| `usecase` | UseCase 패턴 (OutPort 의존, Result DTO, Command/Spec/Query/Result 파일 분리) |
| `rest-controller` | REST 컨트롤러·Request/Response DTO·매퍼 규칙 |
| `jpa-entity` | JPA Entity / Repository / Persistence Adapter 규칙 |
| `mapper` | MapStruct vs 확장함수, REST/JPA/Application 매퍼 패턴 |
| `testing` | Kotest BehaviorSpec, OutPort 모킹 전략 |
| `setup-gradle` | Gradle Convention Plugin 빌드 구조 |
| `code-convention` | 필드 네이밍(자기 도메인 vs 외부 도메인), Boolean 접두사 금지, ktlint |
| `ai-memory-plan` | `docs/plans/` 계획서·맥락노트·체크리스트 3종 문서 체계 |

## 규칙

- **수정은 `~/.my-claude-skills` 에서만 한다.** 설치된 각 프로젝트의 `.claude/skills/`, `.agents/skills/`, `~/.agents/skills/`, `~/.codex/skills/` 는 모두 심볼릭 링크이므로, 그 경로에서 편집하면 원본도 바뀐다. 단 편집 후 반드시 `~/.my-claude-skills` 에서 `git add/commit/push` 해야 다른 컴퓨터에 전파된다.
- **새 스킬 추가** 시 `skills/**/<name>/SKILL.md` 구조를 따르고 이 README 의 스킬 목록에도 한 줄 추가한다. 카테고리 폴더는 자유롭게 나눌 수 있다.
- **스킬 작성 포맷**은 `skills/backend/code-convention` 같은 기존 스킬을 참고한다. YAML frontmatter 에 `name` + `description` 필드가 있어야 한다.

## 제약

- Node.js 18 이상 필요 (npx 포함)
- Windows 의 심볼릭 링크 생성은 관리자 권한 또는 Developer Mode 필요
