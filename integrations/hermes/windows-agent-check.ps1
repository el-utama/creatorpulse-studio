# Non-elevated verification only. No credential contents are printed.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Syntax','Receipt','HistorySyntax')][string]$Mode)
$ErrorActionPreference = 'Stop'
try {
    $tokens = $null
    $errors = $null
    $file = if ($Mode -eq 'HistorySyntax') { 'windows-owner-history.ps1' } else { 'windows-owner-agent.ps1' }
    $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $file),[ref]$tokens,[ref]$errors)
    if ($errors.Count) { exit 1 }
    if ($Mode -in @('Syntax','HistorySyntax')) { exit 0 }
    $fn = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-AgentCredentialAcl'},$false)
    if (-not $fn) { exit 1 }
    . ([scriptblock]::Create($fn.Extent.Text))
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $out = 'C:\ProgramData\CreatorPulseAgent-Sandbox'
    Assert-AgentCredentialAcl $out $sid
    Assert-AgentCredentialAcl (Join-Path $out 'provisioning.json') $sid
    Assert-AgentCredentialAcl (Join-Path $out 'hermes.env') $sid
    $receipt = Get-Content -LiteralPath (Join-Path $out 'provisioning.json') -Raw | ConvertFrom-Json
    if ($receipt.bypass_approved -eq $true) { Assert-AgentCredentialAcl (Join-Path $out 'preview-bypass.secret') $sid }
    elseif (Test-Path -LiteralPath (Join-Path $out 'preview-bypass.secret')) { exit 1 }
    exit 0
} catch { exit 1 }
