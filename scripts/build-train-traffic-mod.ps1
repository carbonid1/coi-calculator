param(
    [string]$CoiRoot = $env:COI_ROOT,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CoiRoot)) {
    $steamCandidates = @(
        "E:\Steam\steamapps\common\Captain of Industry",
        "C:\Program Files (x86)\Steam\steamapps\common\Captain of Industry"
    )
    $CoiRoot = $steamCandidates | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ "Captain of Industry_Data\Managed\Mafi.Core.dll")
    } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($CoiRoot)) {
    throw "Captain of Industry was not found. Set COI_ROOT to the installed game directory."
}

$CoiRoot = (Resolve-Path -LiteralPath $CoiRoot).Path
$managed = Join-Path $CoiRoot "Captain of Industry_Data\Managed"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $compiler)) {
    throw ".NET Framework compiler not found at $compiler"
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$modSource = Join-Path $repositoryRoot "game-mod\CoiTrainTrafficMonitor"
$outputDirectory = Join-Path $modSource "bin\Release"
$outputDll = Join-Path $outputDirectory "CoiTrainTrafficMonitor.dll"
$sourceFile = Join-Path $modSource "CoiTrainTrafficMonitorMod.cs"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$references = @(
    "Mafi.dll",
    "Mafi.Core.dll",
    "netstandard.dll"
) | ForEach-Object { Join-Path $managed $_ }

foreach ($reference in $references) {
    if (-not (Test-Path -LiteralPath $reference)) {
        throw "Required game assembly not found: $reference"
    }
}

$compilerArguments = @(
    "/nologo",
    "/target:library",
    "/optimize+",
    "/warn:4",
    "/out:$outputDll"
)
$compilerArguments += $references | ForEach-Object { "/reference:$_" }
$compilerArguments += $sourceFile

& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0) {
    throw "CoiTrainTrafficMonitor compilation failed with exit code $LASTEXITCODE."
}

Write-Output "Built $outputDll"

if ($Install) {
    $modsRoot = Join-Path $env:APPDATA "Captain of Industry\Mods"
    $installDirectory = Join-Path $modsRoot "CoiTrainTrafficMonitor"
    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -LiteralPath $outputDll -Destination $installDirectory -Force
    Copy-Item -LiteralPath (Join-Path $modSource "manifest.json") -Destination $installDirectory -Force
    Copy-Item -LiteralPath (Join-Path $modSource "config.json") -Destination $installDirectory -Force
    Write-Output "Installed $installDirectory"
}
