$scriptsDir = "$PSScriptRoot\server_scripts"
$outDir     = "$PSScriptRoot\app_backend"

$Files = Get-ChildItem -Path $scriptsDir -Filter *.ps1

foreach ($f in $Files) {
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)

    Write-Host "Building $fileName"
    if ($fileName -eq "add-document-mount") {
        Invoke-PS2EXE -InputFile "$scriptsDir\$fileName.ps1" -OutputFile "$outDir\$fileName.exe" -requireAdmin
    } else {
        Invoke-PS2EXE -InputFile "$scriptsDir\$fileName.ps1" -OutputFile "$outDir\$fileName.exe"
    }
}