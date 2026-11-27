# Read-only Windows Sandbox preflight. No secret contents, command lines or env dumps.
$ErrorActionPreference = 'Stop'
function Probe([scriptblock]$Action) {
    try { & $Action } catch { 'unknown_or_access_denied' }
}
$root = Join-Path $env:ProgramData 'CreatorPulseBridge'
$profile = Join-Path $env:LOCALAPPDATA 'hermes\profiles\creatorpulse-sandbox'
$report = [ordered]@{
    host = $env:COMPUTERNAME
    boot_utc = (Probe { $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop; $os.LastBootUpTime.ToUniversalTime().ToString('o') })
    identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    service_account = (Probe { $u = Get-LocalUser -Name CreatorPulseBridge -ErrorAction SilentlyContinue; if ($u) { if ($u.Enabled) { 'enabled' } else { 'disabled' } } else { 'not_found_or_hidden' } })
    bridge_root = (Probe { if (Test-Path -LiteralPath $root -ErrorAction Stop) { 'present' } else { 'not_found_or_hidden' } })
    listener = (Probe { $l = @(Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue); if ($l.Count) { @($l | Select-Object LocalAddress,LocalPort,OwningProcess) } else { 'not_found_or_hidden' } })
    task = (Probe { $t = Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\' -ErrorAction SilentlyContinue; if ($t) { $t.State.ToString() } else { 'not_found_or_hidden' } })
    profile_hint = (Probe { if (Test-Path -LiteralPath (Join-Path $profile 'config.yaml')) { 'present' } else { 'inspect_Hermes_profile_list' } })
    python_launcher = [bool](Get-Command py -ErrorAction SilentlyContinue)
    python_command = [bool](Get-Command python -ErrorAction SilentlyContinue)
    hermes_command = [bool](Get-Command hermes -ErrorAction SilentlyContinue)
}
$report | ConvertTo-Json -Depth 4
