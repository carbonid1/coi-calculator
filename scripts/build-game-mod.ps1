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
$modSource = Join-Path $repositoryRoot "game-mod\CoiCalculatorExporter"
$outputDirectory = Join-Path $modSource "bin\Release"
$outputDll = Join-Path $outputDirectory "CoiCalculatorExporter.dll"
$sourceFiles = Get-ChildItem -LiteralPath $modSource -Filter "*.cs" -File |
    Sort-Object -Property FullName |
    ForEach-Object { $_.FullName }

if ($sourceFiles.Count -eq 0) {
    throw "No C# source files found in $modSource"
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$references = @(
    "Mafi.dll",
    "Mafi.Core.dll",
    "Mafi.Base.dll",
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
$compilerArguments += $sourceFiles

& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0) {
    throw "CoiCalculatorExporter compilation failed with exit code $LASTEXITCODE."
}

Write-Output "Built $outputDll"

$geometrySmokeExe = Join-Path $outputDirectory "BridgeGeometrySmoke.exe"
& $compiler "/nologo" "/target:exe" "/optimize+" "/out:$geometrySmokeExe" `
    (Join-Path $modSource "FactoryFootprint.cs") (Join-Path $repositoryRoot "tests\bridge-geometry.smoke.cs")
if ($LASTEXITCODE -ne 0) { throw "Bridge geometry smoke compilation failed." }
& $geometrySmokeExe
if ($LASTEXITCODE -ne 0) { throw "Bridge geometry smoke failed." }

$cargoSmokeExe = Join-Path $outputDirectory "BridgeCargoConnectionsSmoke.exe"
& $compiler "/nologo" "/target:exe" "/optimize+" "/out:$cargoSmokeExe" `
    ($references | ForEach-Object { "/reference:$_" }) `
    (Join-Path $modSource "CargoConnectionFlow.cs") (Join-Path $modSource "CargoConnectionTypes.cs") `
    (Join-Path $modSource "CargoStorageReach.cs") `
    (Join-Path $repositoryRoot "tests\bridge-cargo-connections.smoke.cs")
if ($LASTEXITCODE -ne 0) { throw "Cargo connections smoke compilation failed." }
& $cargoSmokeExe $managed
if ($LASTEXITCODE -ne 0) { throw "Cargo connections smoke failed." }

if ($Install) {
    $modsRoot = Join-Path $env:APPDATA "Captain of Industry\Mods"
    $installDirectory = Join-Path $modsRoot "CoiCalculatorExporter"
    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -LiteralPath $outputDll -Destination $installDirectory -Force
    Copy-Item -LiteralPath (Join-Path $modSource "manifest.json") -Destination $installDirectory -Force
    Write-Output "Installed $installDirectory"
}
