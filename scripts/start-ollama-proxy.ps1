$ErrorActionPreference = "Stop"

$root = "C:\Caio\app"
$node = "C:\Program Files\nodejs\node.exe"
$env:OLLAMA_PROXY_TOKEN = [Environment]::GetEnvironmentVariable("OLLAMA_PROXY_TOKEN", "User")

Set-Location $root
Start-Process -FilePath $node -ArgumentList "scripts/ollama-proxy.mjs" -WindowStyle Hidden `
  -RedirectStandardOutput "$root\.ollama-proxy.log" `
  -RedirectStandardError "$root\.ollama-proxy.err.log"
