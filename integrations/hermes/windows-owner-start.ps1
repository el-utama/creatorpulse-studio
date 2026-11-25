# Owner-only: review and copy to an administrator-controlled directory before running.
# For an already migrated Sandbox; does not create accounts, generate keys or alter tunnels.
[CmdletBinding()]
param(
    [string]$PythonArchive,
    [ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$PythonSha256
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Owner must run elevated; never elevate Hermes.' }
$root = Join-Path $env:ProgramData 'CreatorPulseBridge'
$bridge = Join-Path $root 'local-bridge'
$taskName = 'CreatorPulseBridge-Sandbox'
$account = Get-LocalUser -Name CreatorPulseBridge
if (-not $account.Enabled) { throw 'Dedicated account disabled.' }
$identity = "$env:COMPUTERNAME\CreatorPulseBridge"
$admins = Get-LocalGroup -SID 'S-1-5-32-544'
if (@(Get-LocalGroupMember -Group $admins.Name | Where-Object { $_.SID -eq $account.SID }).Count) { throw 'Service account must not be an administrator.' }
if (-not (Test-Path -LiteralPath (Join-Path $bridge 'run.py') -PathType Leaf)) { throw 'Protected Bridge not migrated.' }
$keyFile = Join-Path $bridge '.secrets\sandbox\bridge.env'
$dbFile = Join-Path $bridge 'data\sandbox\creatorpulse.sqlite3'
if (-not (Test-Path -LiteralPath $keyFile -PathType Leaf) -or -not (Test-Path -LiteralPath $dbFile -PathType Leaf)) { throw 'Existing credentials or database missing; do not regenerate or overwrite.' }
# Refuse to traverse junctions/symlinks. Enumerate one level at a time before any ACL write.
function Get-BridgeTree([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected reparse point under protected root; no ACL changes made.' }
    $item
    if ($item.PSIsContainer) {
        foreach ($child in Get-ChildItem -LiteralPath $item.FullName -Force) {
            Get-BridgeTree -Path $child.FullName
        }
    }
}
# Replace the DACL, not merely add three ACEs while retaining old permissions.
function Set-BridgeItemAcl($Item, [Security.Principal.SecurityIdentifier]$ServiceSid, [Security.AccessControl.FileSystemRights]$ServiceRights = [Security.AccessControl.FileSystemRights]::Modify) {
    $adminsSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $acl = Get-Acl -LiteralPath $Item.FullName
    $acl.SetAccessRuleProtection($true,$false)
    foreach ($rule in @($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))) {
        $acl.RemoveAccessRuleSpecific($rule)
    }
    $inherit = if ($Item.PSIsContainer) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    foreach ($sid in @($systemSid,$adminsSid,$ServiceSid)) {
        $rights = if ($sid -eq $ServiceSid) { $ServiceRights } else { [Security.AccessControl.FileSystemRights]::FullControl }
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid,$rights,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    $acl.SetOwner($adminsSid)
    Set-Acl -LiteralPath $Item.FullName -AclObject $acl
    $actual = Get-Acl -LiteralPath $Item.FullName
    $allowed = @($systemSid.Value,$adminsSid.Value,$ServiceSid.Value)
    $rules = @($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if (-not $actual.AreAccessRulesProtected -or $actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $adminsSid.Value -or $rules.Count -ne 3 -or @($rules | Where-Object { $_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow' }).Count -or @($rules.IdentityReference.Value | Sort-Object -Unique).Count -ne 3) { throw 'ACL verification failed; do not start Bridge.' }
}
# Stable file-based launcher avoids nested quoting in the Task Scheduler action.
function Write-BridgeLauncher([string]$Path) {
    $source = @'
import json
import runpy
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
bridge = root / "local-bridge"
status = bridge / "data" / "sandbox" / "bridge-startup.json"
def record(stage, error=None):
    data = {"stage": stage}
    if error is not None:
        data["error_type"] = type(error).__name__
        for attr in ("errno", "winerror", "sqlite_errorcode"):
            value = getattr(error, attr, None)
            if isinstance(value, int):
                data[attr] = value
    status.write_text(json.dumps(data), encoding="utf-8")

try:
    record("launcher_started")
    sys.path.insert(0, str(bridge))
    import bridge as bridge_module
    record("bridge_imported")
    sys.argv = [str(bridge / "run.py"), "--environment", "sandbox"]
    runpy.run_path(sys.argv[0], run_name="__main__")
    record("bridge_exited")
    sys.exit(1)
except BaseException as exc:
    if isinstance(exc, KeyboardInterrupt):
        raise
    record("startup_failed", exc)
    raise SystemExit(1) from None
'@
    Set-Content -LiteralPath $Path -Value $source -Encoding Ascii
}
function New-BridgeTaskAction([string]$Python, [string]$Launcher, [string]$WorkingDirectory) {
    New-ScheduledTaskAction -Execute $Python -Argument ('-I -B "' + $Launcher + '"') -WorkingDirectory $WorkingDirectory
}
$runtime = Join-Path $root 'python'
$python = Join-Path $runtime 'python.exe'
$launcher = Join-Path $root 'sandbox-launcher.py'
$oldRunner = "import sys,runpy; sys.path.insert(0,r'$bridge'); sys.argv=[r'$bridge\run.py','--environment','sandbox']; runpy.run_path(sys.argv[0],run_name='__main__')"
$oldArgs = '-I -c "' + $oldRunner + '"'
$newArgs = '-I -B "' + $launcher + '"'
$existingTask = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue
if ($existingTask) {
    $taskSid = try { ([Security.Principal.NTAccount]::new($existingTask.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value } catch { $existingTask.Principal.UserId }
    $actions = @($existingTask.Actions)
    if ($taskSid -ne $account.SID.Value -or $actions.Count -ne 1 -or $actions[0].Execute -ne $python -or $actions[0].WorkingDirectory -ne $bridge -or $actions[0].Arguments -notin @($oldArgs,$newArgs)) {
        throw 'Existing task is not the known Sandbox Bridge task; will not replace it.'
    }
    Write-Host "Known previous task detected: $($existingTask.State). Installer can repair it after owner confirmation."
}
if (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8766 occupied; stop only the identified old Bridge first.' }
if ($root -ne 'C:\ProgramData\CreatorPulseBridge') { throw 'Unexpected service root.' }
$items = @(Get-BridgeTree -Path $root)
$top = @(Get-ChildItem -LiteralPath $root -Force)
if (@($top | Where-Object { $_.Name -notin @('local-bridge','python','python-3.13.17-embed-amd64.zip','sandbox-launcher.py') }).Count) { throw 'Unexpected contents in protected root; inspect before changing permissions.' }
Write-Host "Installer will replace permissions only on $root and its $($items.Count - 1) descendants. SYSTEM and Administrators: FullControl; CreatorPulseBridge: read/execute on runtime and code, Modify only in Sandbox data. Other entries removed. Existing contents and secrets retained."
if ((Read-Host 'Type REVIEWED after independently reviewing this script, protected code and scope') -cne 'REVIEWED') { throw 'Owner review required.' }
if ($existingTask -and $existingTask.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName -TaskPath '\'
    for ($i=0; $i -lt 20 -and (Get-ScheduledTask -TaskName $taskName -TaskPath '\').State -eq 'Running'; $i++) { Start-Sleep -Seconds 1 }
    if ((Get-ScheduledTask -TaskName $taskName -TaskPath '\').State -eq 'Running') { throw 'Known task did not stop.' }
}
$dataRoot = Join-Path $bridge 'data\sandbox'
foreach ($item in $items) {
    $writable = $item.FullName -eq $dataRoot -or $item.FullName.StartsWith($dataRoot + '\',[StringComparison]::OrdinalIgnoreCase)
    $rights = if ($writable) { 'Modify' } else { 'ReadAndExecute' }
    Set-BridgeItemAcl -Item $item -ServiceSid $account.SID -ServiceRights $rights
}
Write-Host 'Protected ACLs normalized and verified.'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    # SHA256 published on https://www.python.org/downloads/release/python-31317/
    if (-not $PythonArchive -and -not $PythonSha256) {
        if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Default runtime requires Windows x64; supply a matching verified archive.' }
        $PythonArchive = Join-Path $root 'python-3.13.17-embed-amd64.zip'
        $PythonSha256 = '9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38'
        if (-not (Test-Path -LiteralPath $PythonArchive -PathType Leaf)) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.13.17/python-3.13.17-embed-amd64.zip' -OutFile $PythonArchive -UseBasicParsing
        }
    }
    if (-not $PythonArchive -or -not $PythonSha256) { throw 'Supply both archive and verified SHA256, or neither.' }
    if ((Get-FileHash -LiteralPath $PythonArchive -Algorithm SHA256).Hash -ne $PythonSha256) { throw 'Python archive SHA256 mismatch.' }
    if (Test-Path -LiteralPath $runtime) { throw 'Partial runtime exists; inspect before retrying.' }
    New-Item -ItemType Directory -Path $runtime | Out-Null
    Expand-Archive -LiteralPath $PythonArchive -DestinationPath $runtime
}
$signature = Get-AuthenticodeSignature -LiteralPath $python
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw 'Python executable signer verification failed.' }
& $python -I -c "import sys,sqlite3,ssl; assert sys.version_info >= (3,10); print(sys.version.split()[0])"
if ($LASTEXITCODE -ne 0) { throw 'Python runtime check failed.' }
Write-BridgeLauncher -Path $launcher
Set-BridgeItemAcl -Item (Get-Item -LiteralPath $launcher) -ServiceSid $account.SID -ServiceRights ReadAndExecute
$startupStatus = Join-Path $dataRoot 'bridge-startup.json'
if (Test-Path -LiteralPath $startupStatus) { Remove-Item -LiteralPath $startupStatus }
$action = New-BridgeTaskAction -Python $python -Launcher $launcher -WorkingDirectory $bridge
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -MultipleInstances IgnoreNew
$password = Read-Host "Password for $identity (local only)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $registration = @{TaskName=$taskName;TaskPath='\';Action=$action;Trigger=$trigger;Settings=$settings;User=$identity;Password=$plain;RunLevel='Limited'}
    if ($existingTask) { $registration.Force = $true }
    Register-ScheduledTask @registration | Out-Null
    Remove-Variable registration -ErrorAction SilentlyContinue
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Variable plain,password,ptr,registration -ErrorAction SilentlyContinue
}
$registered = Get-ScheduledTask -TaskName $taskName -TaskPath '\'
if (-not $registered) { throw 'Task registration could not be verified.' }
Start-ScheduledTask -TaskName $taskName -TaskPath '\'
$listener = $null
for ($i=0; $i -lt 45; $i++) {
    $listener = @(Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)
    if ($listener.Count) { break }
    Start-Sleep -Seconds 1
}
if ($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1') {
    $task = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue
    $info = if ($task) { Get-ScheduledTaskInfo -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue } else { $null }
    $diag = [ordered]@{gate='listener';task_present=[bool]$task;task_state=if ($task) {$task.State.ToString()} else {'unknown'};last_result=if ($info) {$info.LastTaskResult} else {$null};launcher_stage='not_recorded'}
    if (Test-Path -LiteralPath $startupStatus) {
        try {
            $status = Get-Content -LiteralPath $startupStatus -Raw | ConvertFrom-Json
            if ($status.stage -in @('launcher_started','bridge_imported','bridge_exited','startup_failed')) { $diag.launcher_stage = $status.stage }
            if ($status.error_type -match '^[A-Za-z0-9_]{1,80}$') { $diag.error_type = $status.error_type }
            foreach ($name in @('errno','winerror','sqlite_errorcode')) {
                if ($status.$name -is [int] -or $status.$name -is [long]) { $diag[$name] = $status.$name }
            }
        } catch { $diag.launcher_stage = 'unreadable' }
    }
    $diag | ConvertTo-Json -Compress | Write-Host
    throw 'Bridge startup not verified. Report the redacted diagnostic above; do not edit folders or commands manually.'
}
$proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener[0].OwningProcess)"
$owner = Invoke-CimMethod -InputObject $proc -MethodName GetOwner
if ($owner.ReturnValue -ne 0 -or $owner.User -ne 'CreatorPulseBridge') { throw 'Unexpected listener identity.' }
# Read only the Bridge bearer privately in the owner process; never echo it.
$rows = @(Get-Content -LiteralPath $keyFile | Where-Object { $_ -match '^CREATORPULSE_BRIDGE_TOKEN=' })
if ($rows.Count -ne 1) { throw 'Invalid Bridge credential file.' }
$token = $rows[0].Substring('CREATORPULSE_BRIDGE_TOKEN='.Length)
if ($token -notmatch '^cp_sandbox_bridge_[A-Za-z0-9_-]{32,}$') { throw 'Invalid Sandbox Bridge credential.' }
try {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8766/storage/v1' -Method Post -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -Body '["PING"]' -TimeoutSec 10
    if ($response.result -ne 'PONG') { throw 'Unexpected PING response.' }
    $remote = Invoke-RestMethod -Uri 'https://pc09-pr.markhor-cat.ts.net:10000/storage/v1' -Method Post -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -Body '["PING"]' -MaximumRedirection 0 -TimeoutSec 20
    if ($remote.result -ne 'PONG') { throw 'Unexpected HTTPS PING response.' }
} catch { throw 'Local or HTTPS authenticated PING failed; inspect task and existing tunnel privately.' }
finally { Remove-Variable token,rows -ErrorAction SilentlyContinue }
[pscustomobject]@{ task=$taskName; identity="$($owner.Domain)\$($owner.User)"; loopback='127.0.0.1:8766'; ping='PONG'; https_ping='PONG'; next='Owner secures old duplicate credentials before enrollment.' } | ConvertTo-Json
