param(
    [Parameter(Mandatory=$true)]
    [string]$FileName,

    [Parameter(Mandatory=$false)]
    [bool]$IsPartitioning = $true,

    [Parameter(Mandatory=$false)]
    [bool]$IsChunking = $true,

    [Parameter(Mandatory=$false)]
    [bool]$IsStoring = $true,

    [Parameter(Mandatory=$false)]
    [bool]$LoadCheckpoint = $true,
    
    [Parameter(Mandatory=$false)]
    [bool]$Recreate = $false
)

$baseUrl = "http://localhost:8015/store_pdfs?filename=$FileName&is_partitioning=$IsPartitioning&is_chunking=$IsChunking&is_vector_storing=$IsStoring&load_checkpoint=$LoadCheckpoint&recreate=$Recreate"

Write-Host "Sending request to process PDFs with the following parameters:" -ForegroundColor Cyan
Write-Host "File Name: $FileName" -ForegroundColor Yellow
Write-Host "Is Partitioning: $IsPartitioning" -ForegroundColor Yellow
Write-Host "Is Chunking: $IsChunking" -ForegroundColor Yellow
Write-Host "Is Storing: $IsStoring" -ForegroundColor Yellow
Write-Host "Load Checkpoint: $LoadCheckpoint" -ForegroundColor Yellow
Write-Host "Recreate: $Recreate" -ForegroundColor Yellow
Write-Host "Request URL: $baseUrl" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method Post
    Write-Host "Response from server:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor Green
} catch {
    Write-Error "An error occurred while sending the request: $_"
}