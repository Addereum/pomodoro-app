# ==============================================================================
# Pomodoro App - Windows Native Edge/Chromium Standalone Launcher
# Uses built-in .NET HttpListener (zero external dependencies required)
# ==============================================================================

$ErrorActionPreference = "SilentlyContinue"

# Resolve directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
if (-not (Test-Path "$BaseDir\app\web\index.html")) {
    $BaseDir = $ScriptDir
}
$WebDir = Join-Path $BaseDir "app\web"

if (-not (Test-Path "$WebDir\index.html")) {
    [System.Windows.Forms.MessageBox]::Show("Web-Ressourcen nicht gefunden: $WebDir", "Pomodoro Fehler", 0, 16)
    exit 1
}

# Find Browser executable (Microsoft Edge is preinstalled on 100% of modern Windows 10/11)
$BrowserPath = ""
$PotentialPaths = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

foreach ($path in $PotentialPaths) {
    if (Test-Path $path) {
        $BrowserPath = $path
        break
    }
}

# Find free port
$ListenerSocket = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$ListenerSocket.Start()
$Port = $ListenerSocket.LocalEndpoint.Port
$ListenerSocket.Stop()

$Prefix = "http://127.0.0.1:$Port/"
$HttpListener = New-Object System.Net.HttpListener
$HttpListener.Prefixes.Add($Prefix)
$HttpListener.Start()

# MIME Types mapping
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
    ".wav"  = "audio/wav"
    ".mp3"  = "audio/mpeg"
}

# Background HTTP server job
$ServerJob = Start-Job -ScriptBlock {
    param($Prefix, $WebDir, $MimeTypes)
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($Prefix)
    $listener.Start()

    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            $urlPath = $request.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($urlPath)) {
                $urlPath = "index.html"
            }
            $localFile = Join-Path $WebDir ($urlPath.Replace('/', '\'))

            if (Test-Path $localFile -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
                $mime = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
                $response.ContentType = $mime
                $response.Headers.Add("Cache-Control", "no-cache, no-store")

                $bytes = [System.IO.File]::ReadAllBytes($localFile)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
            $response.OutputStream.Close()
        } catch {
            break
        }
    }
} -ArgumentList $Prefix, $WebDir, $MimeTypes

$UserDataDir = Join-Path $env:TEMP "PomodoroAppProfile"

# Launch Browser in dedicated App Mode (Frameless / No URL Bar / Native Look)
if ($BrowserPath) {
    $Args = @(
        "--app=$Prefix",
        "--window-size=680,820",
        "--user-data-dir=`"$UserDataDir`"",
        "--disable-extensions",
        "--no-first-run"
    )
    $Process = Start-Process -FilePath $BrowserPath -ArgumentList $Args -PassThru -Wait
} else {
    # Fallback to default browser
    Start-Process $Prefix
    Start-Sleep -Seconds 5
}

# Cleanup
Stop-Job $ServerJob -Force -ErrorAction SilentlyContinue
Remove-Job $ServerJob -Force -ErrorAction SilentlyContinue
$HttpListener.Stop()
$HttpListener.Close()
