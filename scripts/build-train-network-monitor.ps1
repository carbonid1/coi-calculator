param(
    [string]$CoiRoot = $env:COI_ROOT,
    [switch]$Install,
    [switch]$Package
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
$modId = "TrainNetworkMonitor"
$modSource = Join-Path $repositoryRoot "game-mod\$modId"
$outputDirectory = Join-Path $modSource "bin\Release"
$outputDll = Join-Path $outputDirectory "$modId.dll"
$sourceFiles = Get-ChildItem -LiteralPath $modSource -Filter "*.cs" -File |
    Sort-Object -Property FullName |
    ForEach-Object { $_.FullName }

if ($sourceFiles.Count -eq 0) {
    throw "No C# source files found in $modSource"
}

$sharedSettingsSource = Join-Path $repositoryRoot "game-mod\Shared\CoI.AutoHelpers.Settings.cs"
$sharedSettingsLicense = Join-Path $repositoryRoot "game-mod\Shared\CoI.AutoHelpers.Settings.LICENSE.txt"
$modLicense = Join-Path $modSource "LICENSE.txt"
$manifestFile = Join-Path $modSource "manifest.json"
$configFile = Join-Path $modSource "config.json"
$thumbnailFile = Join-Path $modSource "Thumbnail.png"
$changelogFile = Join-Path $modSource "changelog.txt"
$readmeFile = Join-Path $modSource "README.md"

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$references = @(
    "Mafi.dll",
    "Mafi.Core.dll",
    "Mafi.Unity.dll",
    "UnityEngine.CoreModule.dll",
    "UnityEngine.InputLegacyModule.dll",
    "UnityEngine.UIElementsModule.dll",
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
$compilerArguments += $sharedSettingsSource

& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0) {
    throw "$modId compilation failed with exit code $LASTEXITCODE."
}

Write-Output "Built $outputDll"

if ($Install) {
    $modsRoot = Join-Path $env:APPDATA "Captain of Industry\Mods"
    $installDirectory = Join-Path $modsRoot $modId
    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -LiteralPath $outputDll -Destination $installDirectory -Force
    Copy-Item -LiteralPath $manifestFile -Destination $installDirectory -Force
    Copy-Item -LiteralPath $configFile -Destination $installDirectory -Force
    Copy-Item -LiteralPath $thumbnailFile -Destination $installDirectory -Force
    Copy-Item -LiteralPath $changelogFile -Destination $installDirectory -Force
    Copy-Item -LiteralPath $readmeFile -Destination $installDirectory -Force
    Copy-Item -LiteralPath $modLicense -Destination $installDirectory -Force
    Copy-Item -LiteralPath $sharedSettingsLicense -Destination (Join-Path $installDirectory "CoI.AutoHelpers.Settings.LICENSE.txt") -Force
    Write-Output "Installed $installDirectory"
}

if ($Package) {
    $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
    $buildsDirectory = Join-Path $repositoryRoot "Builds"
    $archivePath = Join-Path $buildsDirectory "$modId-$($manifest.version).zip"
    New-Item -ItemType Directory -Path $buildsDirectory -Force | Out-Null

    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $archive = [System.IO.Compression.ZipFile]::Open(
        $archivePath,
        [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $packageFiles = [ordered]@{
            "$modId/$modId.dll" = $outputDll
            "$modId/manifest.json" = $manifestFile
            "$modId/config.json" = $configFile
            "$modId/Thumbnail.png" = $thumbnailFile
            "$modId/changelog.txt" = $changelogFile
            "$modId/README.md" = $readmeFile
            "$modId/LICENSE.txt" = $modLicense
            "$modId/CoI.AutoHelpers.Settings.LICENSE.txt" = $sharedSettingsLicense
        }

        foreach ($entry in $packageFiles.GetEnumerator()) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $entry.Value,
                $entry.Key,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }

    Write-Output "Packaged $archivePath"
}
