$ErrorActionPreference = "Stop"

$root = "C:\Caio\app"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$token = [Environment]::GetEnvironmentVariable("EMBREPOLI_CLOUDFLARED_TOKEN", "User")

if (-not $token) {
  throw "EMBREPOLI_CLOUDFLARED_TOKEN nao configurado no ambiente do usuario."
}

Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "run", "--token", $token -WindowStyle Hidden `
  -RedirectStandardOutput "$root\.cloudflared-named-tunnel.log" `
  -RedirectStandardError "$root\.cloudflared-named-tunnel.err.log"
