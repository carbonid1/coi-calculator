param(
    [string]$CoiRoot = $env:COI_ROOT,
    [switch]$Install,
    [switch]$Package,
    [switch]$Test
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($CoiRoot)) {
    $CoiRoot = @(
        "E:\Steam\steamapps\common\Captain of Industry",
        "C:\Program Files (x86)\Steam\steamapps\common\Captain of Industry"
    ) | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ "Captain of Industry_Data\Managed\Mafi.Core.dll")
    } | Select-Object -First 1
}
if ([string]::IsNullOrWhiteSpace($CoiRoot)) { throw "Set COI_ROOT to the installed game directory." }
$managed = Join-Path (Resolve-Path -LiteralPath $CoiRoot).Path "Captain of Industry_Data\Managed"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$modId = "MineStorageControl"
$source = Join-Path $repositoryRoot "game-mod\$modId"
$output = Join-Path $source "bin\Release"
New-Item -ItemType Directory -Path $output -Force | Out-Null
$dll = Join-Path $output "$modId.dll"
$references = @("Mafi.dll", "Mafi.Core.dll", "Mafi.Unity.dll", "UnityEngine.CoreModule.dll",
    "UnityEngine.InputLegacyModule.dll", "UnityEngine.UIElementsModule.dll", "netstandard.dll") |
    ForEach-Object { "/reference:" + (Join-Path $managed $_) }
$sources = Get-ChildItem -LiteralPath $source -Filter '*.cs' -File |
    Sort-Object FullName | ForEach-Object { $_.FullName }
$sources += Join-Path $repositoryRoot "game-mod\Shared\CoI.AutoHelpers.Settings.cs"
& $compiler /nologo /target:library /optimize+ /warn:4 "/out:$dll" @references @sources
if ($LASTEXITCODE -ne 0) { throw "Mine Storage Control compilation failed." }
Write-Output "Built $dll"
if ($Test) {
    $testExe = Join-Path $output "MineStorageControl.Tests.exe"
    & $compiler /nologo /target:exe /warn:4 "/out:$testExe" `
        (Join-Path $source "MineStorageRule.cs") (Join-Path $source "tests\MineStorageRuleTests.cs")
    if ($LASTEXITCODE -ne 0) { throw "Test compilation failed." }
    & $testExe
    if ($LASTEXITCODE -ne 0) { throw "Mine storage regression failed." }
}
$files = @("$modId.dll", "manifest.json", "config.json", "README.md", "changelog.txt", "LICENSE.txt",
    "CoI.AutoHelpers.Settings.LICENSE.txt")
$stage = Join-Path $output $modId
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($name in $files) {
    $file = if ($name -eq "$modId.dll") { $dll }
        elseif ($name -eq "CoI.AutoHelpers.Settings.LICENSE.txt") { Join-Path $repositoryRoot "game-mod\Shared\$name" }
        else { Join-Path $source $name }
    Copy-Item -LiteralPath $file -Destination $stage -Force
}
if ($Install) {
    $destination = Join-Path $env:APPDATA "Captain of Industry\Mods\$modId"
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $stage $name) -Destination $destination -Force }
    Write-Output "Installed $destination"
}
if ($Package) {
    $version = (Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json).version
    $builds = Join-Path $repositoryRoot "Builds"
    New-Item -ItemType Directory -Path $builds -Force | Out-Null
    $archive = Join-Path $builds "$modId-$version.zip"
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($name in $files) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, (Join-Path $stage $name), "$modId/$name",
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally { $zip.Dispose() }
    Write-Output "Packaged $archive"
}
