# Owner only. Review this exact revision and stage outside agent-writable directories.
# PC09 Sandbox only. No credential generation, no Bridge or Vercel changes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
function Get-ExistingAgentKey([string]$Root) {
    $keys = @()
    foreach ($name in @('hermes.env','vercel.env')) {
        $path = Join-Path $Root $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected credential link.' }
        $rows = @(Get-Content -LiteralPath $path | Where-Object { $_ -match '^CREATORPULSE_AGENT_KEY=' })
        if ($rows.Count -ne 1) { throw 'Existing credential source has missing or duplicate Agent Key.' }
        $key = $rows[0].Substring('CREATORPULSE_AGENT_KEY='.Length)
        if ($key -cnotmatch '^cp_sandbox_agent_[A-Za-z0-9_-]{32,}$') { throw 'Existing credential source has invalid Sandbox Agent Key.' }
        $keys += $key
    }
    if ($keys.Count -gt 1 -and $keys[0] -cne $keys[1]) { throw 'Existing credential sources disagree. No overwrite or rotation.' }
    if ($keys.Count) { return $keys[0] }
}
function Read-PrivateValue([string]$Prompt) {
    $secret = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }
}
function New-AgentCredentialAcl([Security.Principal.SecurityIdentifier]$AgentSid) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    $admins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $acl.SetOwner($admins)
    foreach ($sid in @($admins,$system,$AgentSid)) {
        $rights = if ($sid -eq $AgentSid) { 'ReadAndExecute' } else { 'FullControl' }
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid,$rights,'ContainerInherit, ObjectInherit','None','Allow')
        $acl.AddAccessRule($rule)
    }
    return $acl
}
function Assert-AgentCredentialAcl([string]$Path,[Security.Principal.SecurityIdentifier]$AgentSid) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected credential output link.' }
    $acl = Get-Acl -LiteralPath $Path
    $admins = 'S-1-5-32-544'
    $allowed = @($admins,'S-1-5-18',$AgentSid.Value)
    $rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @($admins,'S-1-5-18') -or $rules.Count -ne 3 -or @($rules.IdentityReference.Value | Sort-Object -Unique).Count -ne 3) { throw 'Unexpected output ACL or owner.' }
    if ($item.PSIsContainer -and -not $acl.AreAccessRulesProtected) { throw 'Output directory ACL inherits unexpected rules.' }
    foreach ($rule in $rules) {
        $expected = if ($rule.IdentityReference.Value -eq $AgentSid.Value) { [Security.AccessControl.FileSystemRights]'ReadAndExecute, Synchronize' } else { [Security.AccessControl.FileSystemRights]::FullControl }
        if ($rule.IdentityReference.Value -notin $allowed -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne $expected) { throw 'Unexpected output ACL rights.' }
    }
}
function Write-AgentCredential([string]$Path,[string]$Content,[Security.Principal.SecurityIdentifier]$AgentSid) {
    if (Test-Path -LiteralPath $Path) {
        Assert-AgentCredentialAcl $Path $AgentSid
        if ([IO.File]::ReadAllText($Path) -cne $Content) { throw 'Existing credential differs. No overwrite.' }
        return
    }
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
        $bytes = [Text.Encoding]::ASCII.GetBytes($Content)
        $stream.Write($bytes,0,$bytes.Length)
    } finally { $stream.Dispose() }
    # New files inherit the restricted DACL; set trusted group ownership explicitly.
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    Set-Acl -LiteralPath $Path -AclObject $acl
    Assert-AgentCredentialAcl $Path $AgentSid
}
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Owner must run elevated; never elevate Hermes.' }
if ($env:COMPUTERNAME -ne 'PC09-PR' -or $env:ProgramData -ne 'C:\ProgramData') { throw 'This helper is specific to PC09 Sandbox.' }
$account = Get-LocalUser -Name USER
if (-not $account.Enabled) { throw 'Agent Windows account disabled.' }
$base = 'C:\ProgramData\CreatorPulseBridge\local-bridge\.secrets\sandbox'
foreach ($path in @('C:\ProgramData','C:\ProgramData\CreatorPulseBridge','C:\ProgramData\CreatorPulseBridge\local-bridge','C:\ProgramData\CreatorPulseBridge\local-bridge\.secrets',$base)) {
    $item = Get-Item -LiteralPath $path -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected protected source path.' }
}
$out = 'C:\ProgramData\CreatorPulseAgent-Sandbox'
if ((Read-Host 'Type REVIEWED to authorize only the existing Sandbox Agent Key export to Windows USER') -cne 'REVIEWED') { throw 'Owner approval required.' }
$key = Get-ExistingAgentKey $base
if (-not $key) { $key = Read-PrivateValue 'Enter EXISTING Sandbox Agent Key from your password manager or Vercel (no new key)' }
if ($key -cnotmatch '^cp_sandbox_agent_[A-Za-z0-9_-]{32,}$') { throw 'Invalid or unavailable existing Sandbox Agent Key.' }
$decision = Read-Host 'Vercel bypass grants project-wide deployment access to USER; type ACCEPT to reuse existing secret or DECLINE'
if ($decision -cnotin @('ACCEPT','DECLINE')) { throw 'Explicit bypass decision required.' }
$bypass = $null
if ($decision -ceq 'ACCEPT') {
    $bypass = Read-PrivateValue 'Enter EXISTING Vercel automation bypass secret (not Agent Key)'
    if ($bypass -cnotmatch '^[A-Za-z0-9_-]{20,256}$') { throw 'Invalid existing bypass secret.' }
}
if (-not (Test-Path -LiteralPath $out)) {
    $acl = New-AgentCredentialAcl $account.SID
    $null = [IO.Directory]::CreateDirectory($out,$acl)
}
Assert-AgentCredentialAcl $out $account.SID
$agentPath = Join-Path $out 'hermes.env'
$bypassPath = Join-Path $out 'preview-bypass.secret'
if ($decision -ceq 'DECLINE' -and (Test-Path -LiteralPath $bypassPath)) { throw 'Previously provisioned bypass exists; owner must review/revoke separately before declining. No changes.' }
# Check both existing destinations before writing either.
foreach ($entry in @(@{Path=$agentPath;Content="CREATORPULSE_AGENT_KEY=$key"},@{Path=$bypassPath;Content=$bypass})) {
    if ($null -ne $entry.Content -and (Test-Path -LiteralPath $entry.Path)) {
        Assert-AgentCredentialAcl $entry.Path $account.SID
        if ([IO.File]::ReadAllText($entry.Path) -cne $entry.Content) { throw 'Existing credential differs. No overwrite.' }
    }
}
Write-AgentCredential $agentPath "CREATORPULSE_AGENT_KEY=$key" $account.SID
if ($bypass) { Write-AgentCredential $bypassPath $bypass $account.SID }
Remove-Variable key,bypass,entry -ErrorAction SilentlyContinue
[pscustomobject]@{agent_file=$agentPath;bypass_approved=($decision -ceq 'ACCEPT');bypass_file=if ($decision -ceq 'ACCEPT') {$bypassPath} else {$null};scope='Windows USER, not profile-only isolation';next='Owner verifies old private duplicates and enrolls TikTok in Sandbox dashboard; Hermes resumes without elevation.'} | ConvertTo-Json
