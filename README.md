# my-claude-skills

개인용 Claude Code 스킬 모음. 여러 프로젝트·여러 컴퓨터에서 공통으로 사용한다. [Vercel agent-skills CLI](https://github.com/vercel-labs/skills)로 설치/업데이트한다.

## 설치

### 전제

- Node.js (npx 사용)
- SSH 또는 HTTPS로 이 repo 접근 가능

### 새 컴퓨터 최초 세팅 (글로벌 스킬만)

어떤 프로젝트에서도 활성화될 범용 스킬들을 `~/.claude/skills/` 에 설치한다.

```bash
npx skills add github:jamin12/my-claude-skills -g
```

설치 후 원하는 스킬만 선택적으로 남기고 나머지는 `npx skills remove -g <name>` 으로 제거해도 된다.

### 프로젝트에 Kotlin/Spring 스킬 설치

Kotlin + Spring Boot + 헥사고날 아키텍처 프로젝트의 `.claude/skills/` 에 설치한다. 프로젝트 루트에서:

```bash
cd <your-kotlin-project>
npx skills add github:jamin12/my-claude-skills
```

(스킬 단위로 선택 설치하려면 CLI의 `--include` / 대화형 선택을 사용)

### 업데이트 (모든 컴퓨터 공통)

```bash
# 글로벌 스킬 업데이트
npx skills update -g

# 프로젝트 스킬 업데이트
cd <your-project>
npx skills update
```

심볼릭 링크 모드로 설치되어 있으면 캐노니컬 위치만 갱신되므로, 여러 프로젝트가 같은 스킬을 공유하는 경우에도 한 번의 update로 전체 반영된다.

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

- **수정은 이 repo에서만 한다.** 설치된 각 프로젝트의 `.claude/skills/` 는 심볼릭 링크이므로, 해당 위치에서 수정하면 모든 프로젝트에 즉시 반영된다. 수정 후 `git push` → 다른 컴퓨터에서 `npx skills update -g` (또는 프로젝트별).
- **새 스킬 추가** 시 이 README의 스킬 목록에도 한 줄 추가한다. 스킬 파일은 `skills/<name>/SKILL.md` 구조를 따른다.
- **스킬 작성 포맷**은 `skills/code-convention` 같은 기존 스킬을 참고한다. YAML frontmatter(`name`, `description`) + 본문.
