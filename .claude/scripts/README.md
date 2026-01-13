# Claude Code Scripts

Windows PowerShell scripts for Claude Code hooks and status line.

## Scripts

| Script           | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `notify.ps1`     | Play notification sound when Claude stops |
| `statusline.ps1` | Show context/git info in status bar       |

## Setup (Windows)

Add to your global `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -ExecutionPolicy Bypass -File \"C:\\Users\\avife\\expense-track\\.claude\\scripts\\statusline.ps1\""
  }
}
```

## What the Status Line Shows

```
expense-track | 73% left | main* +2 -1
     │            │         │    │  └─ commits behind upstream
     │            │         │    └──── commits ahead of upstream
     │            │         └───────── branch name (* = uncommitted changes)
     │            └─────────────────── context window remaining
     └──────────────────────────────── current directory
```
