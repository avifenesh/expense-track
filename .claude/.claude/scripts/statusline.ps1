$input_json = [Console]::In.ReadToEnd()

# Path
$dir = Split-Path -Leaf (Get-Location)

# Context left
$ctx_info = ""
try {
    $data = $input_json | ConvertFrom-Json
    $ctx_size = $data.context_window.context_window_size
    $usage = $data.context_window.current_usage
    if ($ctx_size -and $usage) {
        $current = ($usage.input_tokens + $usage.cache_creation_input_tokens + $usage.cache_read_input_tokens)
        if ($current -gt 0) {
            $left = $ctx_size - $current
            $pct = [math]::Floor($left * 100 / $ctx_size)
            $ctx_info = "$pct% left"
        }
    }
} catch {}

# Git info
$git_info = ""
try {
    $branch = git branch --show-current 2>$null
    if ($branch) {
        $git_info = $branch

        # Dirty
        $status = git status --porcelain 2>$null
        if ($status) {
            $git_info = "$git_info*"
        }

        # Ahead/behind
        $upstream = git rev-parse --abbrev-ref '@{upstream}' 2>$null
        if ($upstream) {
            $ahead = git rev-list --count '@{upstream}..HEAD' 2>$null
            $behind = git rev-list --count 'HEAD..@{upstream}' 2>$null
            if ($ahead -gt 0 -and $behind -gt 0) {
                $git_info = "$git_info +$ahead -$behind"
            } elseif ($ahead -gt 0) {
                $git_info = "$git_info +$ahead"
            } elseif ($behind -gt 0) {
                $git_info = "$git_info -$behind"
            }
        }
    }
} catch {}

# Output
$output = $dir
if ($ctx_info) { $output = "$output | $ctx_info" }
if ($git_info) { $output = "$output | $git_info" }

Write-Output $output
