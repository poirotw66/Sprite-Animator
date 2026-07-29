param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
)

Add-Type -AssemblyName System.Windows.Forms

$deadline = (Get-Date).AddSeconds(20)
$activated = $false

while ((Get-Date) -lt $deadline) {
    $titles = @("開啟", "Open", "選擇檔案", "檔案上傳")
    foreach ($title in $titles) {
        $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*$title*" } | Select-Object -First 1
        if ($proc) {
            [void][System.Windows.Forms.SendKeys]::SendWait("%{TAB}")
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("^l")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait($FilePath)
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Write-Output "Sent path to dialog: $title"
            exit 0
        }
    }
    Start-Sleep -Milliseconds 400
}

Write-Error "File dialog not found within timeout."
exit 1
