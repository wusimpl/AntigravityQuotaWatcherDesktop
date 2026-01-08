# Check for remaining Node.js processes
# Usage: .\checknode.ps1 [-kill]

param(
    [switch]$kill
)

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es):" -ForegroundColor Yellow
    Write-Host ""
    $nodeProcesses | Format-Table Id, ProcessName, CPU, @{N='Memory(MB)';E={[math]::Round($_.WorkingSet64/1MB,1)}}, StartTime -AutoSize
    
    if ($kill) {
        Write-Host "Killing all Node.js processes..." -ForegroundColor Red
        $nodeProcesses | Stop-Process -Force
        Write-Host "All Node.js processes terminated" -ForegroundColor Green
    } else {
        Write-Host "Tip: Use .\checknode.ps1 -kill to terminate all processes" -ForegroundColor Cyan
    }
} else {
    Write-Host "No Node.js processes found" -ForegroundColor Green
}
