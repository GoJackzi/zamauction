$ErrorActionPreference = "Stop"
git add .
try {
    git commit -m "Initial commit of Zama Dashboard"
} catch {
    Write-Host "Nothing to commit or commit failed. Checking why..."
    git status
    # If no identity, set dummy
    if ($LASTEXITCODE -ne 0) {
        git config user.email "antigravity@gemini.com"
        git config user.name "Antigravity Agent"
        git commit -m "Initial commit of Zama Dashboard"
    }
}
git branch -M main
try {
    git remote remove origin
} catch {}
git remote add origin https://github.com/GoJackzi/zamauction
Write-Host "Pushing to remote..."
git push -u origin main
