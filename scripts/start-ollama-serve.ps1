$ErrorActionPreference = "Stop"

$ollama = "C:\Users\User\AppData\Local\Programs\Ollama\ollama.exe"
$root = "C:\Caio\app"
$env:OLLAMA_ORIGINS = "https://ia.embrepoli.com.br"

Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden `
  -RedirectStandardOutput "$root\.ollama-serve.log" `
  -RedirectStandardError "$root\.ollama-serve.err.log"
