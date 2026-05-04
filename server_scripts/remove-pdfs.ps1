param(
    [Parameter(Mandatory=$true)]
    [string]$FileName
)

$baseUrl = "http://localhost:8015/remove_pdf?name=$FileName"

Write-Host "Sending request to remove PDF with the following parameters:" -ForegroundColor Cyan
Write-Host "File Name: $FileName" -ForegroundColor Yellow
Write-Host "Request URL: $baseUrl" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method Post
    Write-Host "Response from server:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor Green
} catch {
    Write-Error "An error occurred while sending the request: $_"
}