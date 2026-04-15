#!/bin/bash
# open-terminal.sh - cmux 또는 iTerm2에서 새 터미널을 열고 지정 경로에서 claude를 실행
# Usage: ./open-iterm.sh <worktree-path>

WORKTREE_PATH="$1"

if [ -z "$WORKTREE_PATH" ]; then
  echo "Error: worktree path required"
  exit 1
fi

# cmux가 있으면 cmux 사용, 없으면 iTerm2 사용
if command -v cmux &>/dev/null; then
  # 현재 워크스페이스에 오른쪽 분할 터미널 생성
  RESULT=$(cmux new-split right 2>&1)
  # 결과에서 surface ID 추출 (예: "OK surface:5")
  SURFACE=$(echo "$RESULT" | grep -o 'surface:[0-9]*')
  if [ -n "$SURFACE" ]; then
    # 새 split 셸 초기화 대기
    sleep 1
    cmux send --surface "$SURFACE" "cd '$WORKTREE_PATH' && claude --dangerously-skip-permissions\n"
  else
    # surface 추출 실패 시 새 워크스페이스로 fallback
    cmux new-workspace --cwd "$WORKTREE_PATH" --command "claude --dangerously-skip-permissions"
  fi
else
  osascript -e "
tell application \"iTerm2\"
  activate
  tell current window
    create tab with default profile
    tell current session
      write text \"cd '$WORKTREE_PATH' && claude --dangerously-skip-permissions\"
    end tell
  end tell
end tell
"
fi
