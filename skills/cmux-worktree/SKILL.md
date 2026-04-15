---
name: cmux-worktree
description: git worktree를 생성/삭제하고 cmux(iTerm2 기반) 새 탭에서 claude를 실행한다. Claude 세션과 docs/plans 맥락을 메인 repo로 자동 마이그레이션한다.
disable-model-invocation: true
argument-hint: "[branch-name] [--base=branch] | --remove [branch-name]"
---

# cmux Git Worktree Skill

현재 repo 옆에 git worktree를 생성/삭제하고 cmux(iTerm2 기반) 새 탭에서 claude를 실행합니다. Claude 세션과 `docs/plans` 맥락도 메인 repo로 자동 마이그레이션합니다.

## 사용법

```
/worktree feature/123              # 현재 브랜치 기반으로 생성 (기본값)
/worktree feature/123 --base=main  # main 기반으로 생성
/worktree my-branch --base=release # release 기반으로 생성
/worktree --remove                 # 현재 워크트리 삭제 (자기 자신)
/worktree --remove 375             # 지정 워크트리 삭제
```

## 동작: 생성 모드 (기본)

인수에 `--remove`가 없으면 생성 모드입니다.

1. **인수 파싱**: 첫 번째 인수는 branch 이름, `--base=` 옵션이 있으면 해당 브랜치를 기반으로, 없으면 **현재 브랜치**(git branch --show-current)를 기반으로 사용합니다. branch 이름이 없으면 요청하세요.

2. **현재 repo 정보 파악**:
   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   REPO_NAME=$(basename "$REPO_ROOT")
   REPO_PARENT=$(dirname "$REPO_ROOT")
   ```

3. **branch 이름을 경로용으로 변환** (슬래시를 하이픈으로):
   ```bash
   BRANCH_NAME="<첫 번째 인수>"
   BASE_BRANCH="<--base 값 또는 $(git branch --show-current)>"
   SAFE_BRANCH=$(echo "$BRANCH_NAME" | tr '/' '-')
   WORKTREE_PATH="${REPO_PARENT}/${REPO_NAME}-wt-${SAFE_BRANCH}"
   ```

4. **기존 worktree 확인 및 생성**:
   ```bash
   # 이미 존재하는지 확인
   if git worktree list | grep -q "$WORKTREE_PATH"; then
     echo "기존 worktree 사용: $WORKTREE_PATH"
   else
     # 브랜치가 이미 존재하면 해당 브랜치로, 없으면 BASE_BRANCH 기반으로 새로 생성
     if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
       git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
     else
       git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
     fi
   fi
   ```

5. **base 브랜치의 docs/plans 복사** (AI 작업 맥락 유지):
   ```bash
   # base 브랜치에 docs/plans가 존재하면 워크트리로 복사
   if git show "${BASE_BRANCH}:docs/plans" &>/dev/null; then
     mkdir -p "$WORKTREE_PATH/docs/plans"
     # base 브랜치의 docs/plans 내용을 추출하여 복사
     cd "$WORKTREE_PATH"
     git checkout "${BASE_BRANCH}" -- docs/plans/
     git reset HEAD docs/plans/ 2>/dev/null  # staged 상태 해제 (untracked로 유지)
     cd -
   fi
   ```

6. **iTerm2 새 탭에서 claude 실행**:
   ```bash
   ~/.claude/skills/worktree/scripts/open-iterm.sh "$WORKTREE_PATH"
   ```

7. **결과 보고**: worktree 경로, 브랜치 이름, 기반 브랜치를 사용자에게 알려줍니다.

## 동작: 삭제 모드 (`--remove`)

인수에 `--remove`가 있으면 삭제 모드입니다.

1. **메인 repo 경로 파악**: 현재 디렉토리가 워크트리일 수 있으므로 메인 repo를 찾습니다.
   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   REPO_NAME=$(basename "$REPO_ROOT")
   REPO_PARENT=$(dirname "$REPO_ROOT")
   # 메인 repo 경로 (워크트리 이름 패턴에서 추출)
   # REPO_NAME이 "-wt-" 를 포함하면 워크트리 안에 있는 것
   MAIN_REPO=$(git worktree list | head -1 | awk '{print $1}')
   ```

2. **삭제 대상 결정**:
   - `--remove` 뒤에 branch 이름이 있으면: 해당 branch의 워크트리를 삭제
   - `--remove`만 있으면 (인수 없음): **현재 워크트리 자기 자신**을 삭제
   ```bash
   if [ -n "$TARGET_BRANCH" ]; then
     # branch 이름으로 워크트리 경로 찾기
     SAFE_BRANCH=$(echo "$TARGET_BRANCH" | tr '/' '-')
     MAIN_REPO_NAME=$(basename "$MAIN_REPO")
     TARGET_PATH="$(dirname "$MAIN_REPO")/${MAIN_REPO_NAME}-wt-${SAFE_BRANCH}"
   else
     # 현재 디렉토리가 워크트리인지 확인
     TARGET_PATH="$REPO_ROOT"
   fi
   ```

3. **삭제 대상 검증**:
   - 메인 repo는 삭제 불가 (워크트리만 삭제 가능)
   - `git worktree list`에서 대상 경로가 존재하는지 확인
   ```bash
   # 메인 repo 삭제 방지
   if [ "$TARGET_PATH" = "$MAIN_REPO" ]; then
     echo "메인 repo는 삭제할 수 없습니다."
     exit
   fi
   ```

4. **Claude 세션 마이그레이션** (삭제 전에 실행):
   워크트리에서 진행한 Claude 대화를 메인 프로젝트에서 `--resume`으로 이어서 볼 수 있도록 세션 파일을 복사합니다.
   ```bash
   CLAUDE_PROJECTS="${HOME}/.claude/projects"
   # 경로를 Claude 프로젝트 디렉토리명으로 변환 (/를 -로)
   WT_PROJECT_DIR="${CLAUDE_PROJECTS}/$(echo "$TARGET_PATH" | sed 's|^/||; s|/|-|g; s|^|-|')"
   MAIN_PROJECT_DIR="${CLAUDE_PROJECTS}/$(echo "$MAIN_REPO" | sed 's|^/||; s|/|-|g; s|^|-|')"

   if [ -d "$WT_PROJECT_DIR" ]; then
     mkdir -p "$MAIN_PROJECT_DIR"
     MIGRATED=0
     for jsonl_file in "$WT_PROJECT_DIR"/*.jsonl; do
       [ -f "$jsonl_file" ] || continue
       filename=$(basename "$jsonl_file")
       uuid="${filename%.jsonl}"
       # JSONL 내 cwd 경로를 메인 repo 경로로 치환하여 복사
       sed "s|${TARGET_PATH}|${MAIN_REPO}|g" "$jsonl_file" > "${MAIN_PROJECT_DIR}/${filename}"
       # 관련 서브디렉토리(파일 스냅샷 등)도 복사
       if [ -d "${WT_PROJECT_DIR}/${uuid}" ]; then
         cp -r "${WT_PROJECT_DIR}/${uuid}" "${MAIN_PROJECT_DIR}/${uuid}"
       fi
       MIGRATED=$((MIGRATED + 1))
     done
     echo "Claude 세션 ${MIGRATED}개를 메인 프로젝트로 마이그레이션 완료"
     # 마이그레이션 완료 후 워크트리 프로젝트 폴더 삭제
     rm -rf "$WT_PROJECT_DIR"
     echo "Claude 프로젝트 폴더 삭제: $WT_PROJECT_DIR"
   else
     echo "마이그레이션할 Claude 세션 없음"
   fi
   ```

5. **워크트리 삭제 실행**:
   ```bash
   # 먼저 일반 삭제 시도, 실패하면 --force로 재시도
   if ! git -C "$MAIN_REPO" worktree remove "$TARGET_PATH" 2>/dev/null; then
     git -C "$MAIN_REPO" worktree remove --force "$TARGET_PATH"
   fi
   ```

6. **결과 보고**: 삭제된 워크트리 경로와 브랜치 이름을 사용자에게 알려줍니다. 현재 워크트리를 삭제한 경우 메인 repo로 이동하라고 안내합니다. 세션 마이그레이션이 수행된 경우, 메인 프로젝트에서 `claude --resume`으로 워크트리 대화를 이어갈 수 있다고 안내합니다.
