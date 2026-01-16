# PowerShell script to create a worktree with .env file copied automatically

param(
    [Parameter(Mandatory=$true)]
    [string]$BranchName
)

$WorktreePath = "..\expense-track-$BranchName"

# Check if worktree already exists
if (Test-Path $WorktreePath) {
    Write-Host "Error: Worktree directory already exists at $WorktreePath" -ForegroundColor Red
    exit 1
}

# Check if branch already exists
$branchExists = git show-ref --verify --quiet "refs/heads/$BranchName"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Error: Branch $BranchName already exists" -ForegroundColor Red
    exit 1
}

Write-Host "Creating worktree at $WorktreePath with branch $BranchName..." -ForegroundColor Cyan
git worktree add -b $BranchName $WorktreePath

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create worktree" -ForegroundColor Red
    exit 1
}

# Copy .env file if it exists
if (Test-Path ".env") {
    Write-Host "Copying .env file to worktree..." -ForegroundColor Cyan
    Copy-Item ".env" "$WorktreePath\.env"
    Write-Host "✓ .env file copied" -ForegroundColor Green
} else {
    Write-Host "Warning: No .env file found in main directory" -ForegroundColor Yellow
}

# Copy .env.local if it exists
if (Test-Path ".env.local") {
    Write-Host "Copying .env.local file to worktree..." -ForegroundColor Cyan
    Copy-Item ".env.local" "$WorktreePath\.env.local"
    Write-Host "✓ .env.local file copied" -ForegroundColor Green
}

# Copy .claude directory if it exists (for Claude Code settings)
if (Test-Path ".claude") {
    Write-Host "Copying .claude directory to worktree..." -ForegroundColor Cyan
    Copy-Item -Recurse ".claude" "$WorktreePath\.claude"
    Write-Host "✓ .claude directory copied" -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ Worktree created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  cd $WorktreePath"
Write-Host "  npm install  # Install dependencies"
Write-Host "  npm test     # Verify tests pass"
Write-Host ""
Write-Host "Then start with plan mode before implementing." -ForegroundColor Yellow
