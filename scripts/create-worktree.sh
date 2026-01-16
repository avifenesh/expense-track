#!/bin/bash
# Script to create a worktree with .env file copied automatically

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/create-worktree.sh <branch-name>"
  echo "Example: ./scripts/create-worktree.sh holdings-refresh"
  exit 1
fi

BRANCH_NAME="$1"
WORKTREE_PATH="../expense-track-${BRANCH_NAME}"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
  echo "Error: Worktree directory already exists at $WORKTREE_PATH"
  exit 1
fi

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "Error: Branch $BRANCH_NAME already exists"
  exit 1
fi

echo "Creating worktree at $WORKTREE_PATH with branch $BRANCH_NAME..."
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"

# Copy .env file if it exists
if [ -f ".env" ]; then
  echo "Copying .env file to worktree..."
  cp .env "$WORKTREE_PATH/.env"
  echo "✓ .env file copied"
else
  echo "Warning: No .env file found in main directory"
fi

# Copy .env.local if it exists
if [ -f ".env.local" ]; then
  echo "Copying .env.local file to worktree..."
  cp .env.local "$WORKTREE_PATH/.env.local"
  echo "✓ .env.local file copied"
fi

# Copy .claude directory if it exists (for Claude Code settings)
if [ -d ".claude" ]; then
  echo "Copying .claude directory to worktree..."
  cp -r .claude "$WORKTREE_PATH/.claude"
  echo "✓ .claude directory copied"
fi

echo ""
echo "✓ Worktree created successfully!"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  npm install  # Install dependencies"
echo "  npm test     # Verify tests pass"
echo ""
echo "Then start with plan mode before implementing."
