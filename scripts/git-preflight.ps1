$repoRoot = (Get-Location).Path -replace "\\", "/"
$stagedFiles = & git -c "safe.directory=$repoRoot" diff --cached --name-only --diff-filter=ACMR

if ($LASTEXITCODE -ne 0) {
  Write-Error "Git preflight could not complete."
  exit 1
}

$blockedFiles = @($stagedFiles | Where-Object { $_ -match '^(?i)\.env($|\.)' })

if ($blockedFiles.Count -gt 0) {
  Write-Error "Blocked staged env files detected:"
  $blockedFiles | ForEach-Object { Write-Error "- $_" }
  Write-Error "Remove real environment files from staging before pushing."
  exit 1
}

Write-Output "Git preflight passed: no env files are staged."
