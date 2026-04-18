param (
    [Parameter(Mandatory=$true, HelpMessage="Path to the source directory (absolute or relative to the docker location)")][string]$sourcePath,
    [Parameter(Mandatory=$true, HelpMessage="Path to the target directory (relative to the 'app/documents' on the container, e.g., test/documents).")][string]$targetPath
)

$filePath = "docker-compose.yml"
$searchText = "# - DOCUMENT MOUNTS -"

$lines = Get-Content -Path $filePath
$targetIndex = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match [regex]::Escape($searchText)) {
        $targetIndex = $i
        break
    }
}

if ($targetIndex -eq -1) {
    Write-Host "Line not found."
    exit
}

$targetLine = $lines[$targetIndex]
$leadingWhitespace = $targetLine -replace '^(\s*).*', '$1'
$whitespaceLength = $leadingWhitespace.Length

$indentedNewLine = @"
$leadingWhitespace- type: bind
$leadingWhitespace  source: $sourcePath
$leadingWhitespace  target: `${MOUNT_PATH}/$targetPath
"@

$before = $lines[0..$targetIndex]
$after  = $lines[($targetIndex + 1)..($lines.Count - 1)]

$updatedLines = @($before) + @($indentedNewLine) + @($after)
Set-Content -Path $filePath -Value $updatedLines

Write-Host "Document mount added successfully. Run './run-container.ps1' to start the container with the new mount."