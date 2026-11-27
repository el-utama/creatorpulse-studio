# Owner only. Review this exact revision and stage outside agent-writable directories.
# PC09 Sandbox only. No credential generation, no Bridge or Vercel changes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
# Only known paths in the retired PC09 checkout. No file contents are read.
# Owner must confirm these copies are retired and not used by Production.
function Get-LegacyPrivateItems([string]$Root) {
    if (-not (Test-Path -LiteralPath $Root)) { return }
    $rootItem = Get-Item -LiteralPath $Root -Force
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected old checkout path.' }
    foreach ($relative in @('.secrets\sandbox','local-bridge\.secrets\sandbox','data\sandbox','local-bridge\data\sandbox','.secrets\bridge.env','.secrets\vercel.env','.secrets\hermes.env','local-bridge\.secrets\bridge.env','local-bridge\.secrets\vercel.env','local-bridge\.secrets\hermes.env','.env.local','local-bridge\.env.local')) {
        $current = $Root
        $found = $true
        foreach ($part in $relative.Split('\')) {
            $current = Join-Path $current $part
            if (-not (Test-Path -LiteralPath $current)) { $found = $false; break }
            $item = Get-Item -LiteralPath $current -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected link in old credential path; no protection changes.' }
        }
        if ($found) { $item }
    }
}
function Get-LegacyPrivateTree($Item) {
    if ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected link in old credential tree.' }
    $Item
    if ($Item.PSIsContainer) {
        foreach ($child in Get-ChildItem -LiteralPath $Item.FullName -Force -ErrorAction Stop) { Get-LegacyPrivateTree $child }
    }
}
function Protect-LegacyPrivateItem($Item) {
    $admins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    # Replace inherited and explicit ACEs only for the explicitly approved retired items.
    $acl = Get-Acl -LiteralPath $Item.FullName
    $acl.SetAccessRuleProtection($true,$false)
    foreach ($rule in @($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))) { $acl.RemoveAccessRuleSpecific($rule) }
    $acl.SetOwner($admins)
    $inherit = if ($Item.PSIsContainer) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    foreach ($sid in @($admins,$system)) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
    }
    Set-Acl -LiteralPath $Item.FullName -AclObject $acl
    $actual = Get-Acl -LiteralPath $Item.FullName
    $rules = @($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if (-not $actual.AreAccessRulesProtected -or $actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $admins.Value -or $rules.Count -ne 2 -or @($rules.IdentityReference.Value | Sort-Object -Unique).Count -ne 2) { throw 'Retired copy ACL verification failed.' }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -notin @($admins.Value,$system.Value) -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'Retired copy ACL rights verification failed.' }
    }
}
function Protect-RetiredSandboxCopies([string]$Root) {
    $targets = @(Get-LegacyPrivateItems $Root)
    if (-not $targets.Count) { Write-Host 'No known retired private copies found.'; return }
    # Inventory all selected descendants before any ACL change; never follow links.
    $items = @(foreach ($target in $targets) { Get-LegacyPrivateTree $target })
    Write-Host 'Known old private paths (names only):'
    $targets | ForEach-Object { Write-Host $_.FullName }
    Write-Host 'Only approve if these are retired Sandbox copies and no current service or Production uses them. Contents are preserved; access becomes Administrators/SYSTEM only.'
    if ((Read-Host 'Type PROTECT to secure these exact old paths') -cne 'PROTECT') { throw 'Retired copy protection not authorized; no credential export.' }
    foreach ($item in $items) { Protect-LegacyPrivateItem $item }
    Write-Host 'Known retired private paths protected. No contents read or deleted.'
}
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
$legacy = 'C:\Users\USER\CreatorPulseBridge'
foreach ($parent in @('C:\Users','C:\Users\USER')) {
    $item = Get-Item -LiteralPath $parent -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected old checkout parent.' }
}
Protect-RetiredSandboxCopies $legacy
if ((Read-Host 'Confirm remaining private copies and owner CLI sessions elsewhere are secured, and USER elevation requires your approval. Type ISOLATED only after review') -cne 'ISOLATED') { throw 'Owner isolation review required; no export.' }
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
$receiptPath = Join-Path $out 'provisioning.json'
$receiptContent = ([ordered]@{schema=1;owner_isolation_reviewed=$true;bypass_approved=($decision -ceq 'ACCEPT')} | ConvertTo-Json -Compress)
# Check all existing destinations before writing any.
foreach ($entry in @(@{Path=$agentPath;Content="CREATORPULSE_AGENT_KEY=$key"},@{Path=$bypassPath;Content=$bypass},@{Path=$receiptPath;Content=$receiptContent})) {
    if ($null -ne $entry.Content -and (Test-Path -LiteralPath $entry.Path)) {
        Assert-AgentCredentialAcl $entry.Path $account.SID
        if ([IO.File]::ReadAllText($entry.Path) -cne $entry.Content) { throw 'Existing credential differs. No overwrite.' }
    }
}
Write-AgentCredential $agentPath "CREATORPULSE_AGENT_KEY=$key" $account.SID
if ($bypass) { Write-AgentCredential $bypassPath $bypass $account.SID }
Write-AgentCredential $receiptPath $receiptContent $account.SID
Remove-Variable key,bypass,entry -ErrorAction SilentlyContinue
[pscustomobject]@{agent_file=$agentPath;bypass_approved=($decision -ceq 'ACCEPT');bypass_file=if ($decision -ceq 'ACCEPT') {$bypassPath} else {$null};scope='Windows USER, not profile-only isolation';next='Owner verifies old private duplicates and enrolls TikTok in Sandbox dashboard; Hermes resumes without elevation.'} | ConvertTo-Json
