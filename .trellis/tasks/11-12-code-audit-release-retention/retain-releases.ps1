param(
  [ValidateSet('Plan','Apply')][string]$Mode='Plan',
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$CurrentTree
)
$ErrorActionPreference='Stop'
$repoApi='https://api.github.com/repos/hikling/shendu-v1'
$planPath=Join-Path $PSScriptRoot 'release-plan.json'
$resultPath=Join-Path $PSScriptRoot 'release-retention-result.json'
$credentialLines=$null
$credentialParts=$null
$githubHeaders=$null

function Get-ReleaseInventory {
  $items=[System.Collections.Generic.List[object]]::new()
  for($page=1;$page -le 10;$page++){
    $batch=Invoke-RestMethod -Uri "$repoApi/releases?per_page=100&page=$page" -Headers $githubHeaders -TimeoutSec 25
    foreach($release in $batch){
      if(-not $release.draft){$items.Add([PSCustomObject]@{
        id=$release.id;tag=$release.tag_name;published_at=$release.published_at
        assets=@($release.assets | Select-Object name,size,state)
      })}
    }
    if($batch.Count -lt 100){return @($items | Sort-Object published_at -Descending)}
  }
  throw 'Release inventory exceeded pagination bound; no deletion allowed.'
}

function Assert-KeptAssets($kept){
  if($kept.Count -ne 4){throw 'Exactly four retained releases are required.'}
  if("deploy-$CurrentTree" -notin @($kept.tag)){throw 'Current application release is not in the retained set.'}
  foreach($release in $kept){
    foreach($name in @('shendu-linux-amd64.tar.gz','shendu-linux-amd64.tar.gz.sha256','shendu-linux-arm64.tar.gz','shendu-linux-arm64.tar.gz.sha256')){
      $asset=@($release.assets | Where-Object name -eq $name)
      if($asset.Count -ne 1 -or $asset[0].state -ne 'uploaded' -or $asset[0].size -le 0){throw "Incomplete retained release: $($release.tag)"}
    }
  }
}

try{
  $credentialLines="protocol=https`nhost=github.com`n`n" | git credential fill
  if($LASTEXITCODE -ne 0){throw 'GitHub credential lookup failed.'}
  $credentialParts=@{}
  foreach($entry in $credentialLines){
    $separator=$entry.IndexOf('=')
    if($separator -gt 0){$credentialParts[$entry.Substring(0,$separator)]=$entry.Substring($separator+1)}
  }
  if(-not $credentialParts.password){throw 'No existing GitHub credential is available.'}
  $githubHeaders=@{Authorization='Bearer '+$credentialParts.password;Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28'}
  $inventory=@(Get-ReleaseInventory)
  $kept=@($inventory | Select-Object -First 4)
  Assert-KeptAssets $kept
  $obsolete=@($inventory | Select-Object -Skip 4)
  if($Mode -eq 'Plan'){
    [PSCustomObject]@{repository='hikling/shendu-v1';currentTree=$CurrentTree;createdAt=[DateTime]::UtcNow.ToString('o');keep=$kept;delete=$obsolete} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $planPath -Encoding utf8
    [PSCustomObject]@{mode=$Mode;total=$inventory.Count;keep=@($kept.tag);deleteCount=$obsolete.Count} | ConvertTo-Json -Depth 3
  }else{
    $plan=Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
    if($plan.repository -ne 'hikling/shendu-v1' -or $plan.currentTree -ne $CurrentTree){throw 'Plan identity mismatch.'}
    if((@($plan.keep.id) -join ',') -ne (@($kept.id) -join ',') -or (@($plan.delete.id) -join ',') -ne (@($obsolete.id) -join ',')){throw 'Inventory changed after planning; create and review a fresh plan.'}
    $deleted=[System.Collections.Generic.List[object]]::new()
    foreach($release in $obsolete){
      $latest=@(Get-ReleaseInventory)
      if((@($latest | Select-Object -First 4).id -join ',') -ne (@($kept.id) -join ',')){throw 'Newest releases changed during cleanup; stopped.'}
      $fresh=Invoke-RestMethod -Uri "$repoApi/releases/$($release.id)" -Headers $githubHeaders -TimeoutSec 25
      if($fresh.draft -or $fresh.tag_name -ne $release.tag -or $fresh.published_at -ne $release.published_at -or $fresh.id -in @($kept.id)){throw 'Release identity changed; stopped.'}
      $null=Invoke-RestMethod -Method Delete -Uri "$repoApi/releases/$($release.id)" -Headers $githubHeaders -TimeoutSec 25
      $deleted.Add($release)
      [PSCustomObject]@{repository='hikling/shendu-v1';deleted=@($deleted);retained=$kept;verified=$false} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $resultPath -Encoding utf8
      Write-Output "Deleted old release: $($release.tag)"
    }
    $final=@(Get-ReleaseInventory)
    Assert-KeptAssets $final
    if((@($final.id) -join ',') -ne (@($kept.id) -join ',')){throw 'Final release inventory differs from the protected set.'}
    [PSCustomObject]@{repository='hikling/shendu-v1';completedAt=[DateTime]::UtcNow.ToString('o');deleted=@($deleted);retained=$final;verified=$true;gitTagsDeleted=$false} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $resultPath -Encoding utf8
    [PSCustomObject]@{mode=$Mode;deleted=$deleted.Count;remaining=$final.Count;verified=$true} | ConvertTo-Json
  }
}finally{
  $credentialLines=$null
  $credentialParts=$null
  $githubHeaders=$null
}
