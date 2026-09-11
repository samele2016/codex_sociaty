$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

node -e "JSON.parse(require('fs').readFileSync('project.config.json','utf8')); JSON.parse(require('fs').readFileSync('miniprogram/app.json','utf8'));"

Get-ChildItem cloudfunctions -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "云函数语法错误: $($_.FullName)" }
}

Get-ChildItem miniprogram -Recurse -Filter *.json | ForEach-Object {
  Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null
}

Get-ChildItem cloudfunctions -Recurse -Filter config.json | ForEach-Object {
  Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null
}

$securityConfigIssues = @()
Get-ChildItem cloudfunctions -Directory | ForEach-Object {
  $functionDir = $_.FullName
  $entry = Join-Path $functionDir 'index.js'
  if (!(Test-Path $entry)) { return }
  $source = Get-Content -Raw $entry
  $securityMethods = [regex]::Matches($source, 'cloud\.openapi\.security\.([A-Za-z][\w]*)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
  if (!$securityMethods.Count) { return }
  $configPath = Join-Path $functionDir 'config.json'
  if (!(Test-Path $configPath)) {
    $securityConfigIssues += "$(Split-Path $functionDir -Leaf): missing config.json"
    return
  }
  $config = Get-Content -Raw $configPath | ConvertFrom-Json
  $permissions = @($config.permissions.openapi)
  foreach ($method in $securityMethods) {
    if ($permissions -notcontains "security.$method") {
      $securityConfigIssues += "$(Split-Path $functionDir -Leaf): missing security.$method permission"
    }
  }
}
if ($securityConfigIssues.Count) { throw ('内容安全云调用权限配置错误: ' + ($securityConfigIssues -join ', ')) }

$app = Get-Content -Raw miniprogram/app.json | ConvertFrom-Json
foreach ($page in $app.pages) {
  foreach ($extension in @('.js', '.wxml', '.wxss', '.json')) {
    if (!(Test-Path (Join-Path miniprogram ($page + $extension)))) {
      throw "页面文件缺失: $page$extension"
    }
  }
}

$wxmlValidator = @'
const fs = require('fs');
const source = fs.readFileSync(process.argv[1], 'utf8');
const lines = source.split(/\r?\n/);
for (let index = 0; index < lines.length; index += 1) {
  const quotes = [...lines[index]].filter((char) => char === '"').length;
  if (quotes % 2) throw new Error(`unbalanced double quotes at line ${index + 1}`);
}
const voidTags = new Set(['image', 'input', 'checkbox']);
const stack = [];
for (const match of source.matchAll(/<\/?([A-Za-z][\w-]*)\b[^>]*>/g)) {
  const tag = match[1];
  const text = match[0];
  if (text.startsWith('</')) {
    const expected = stack.pop();
    if (expected !== tag) throw new Error(`expected </${expected || 'none'}> but found </${tag}>`);
  } else if (!text.endsWith('/>') && !voidTags.has(tag)) {
    stack.push(tag);
  }
}
if (stack.length) throw new Error(`unclosed tags: ${stack.join(', ')}`);
'@

Get-ChildItem miniprogram -Recurse -Filter *.wxml | ForEach-Object {
  $wxmlValidatorEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($wxmlValidator))
  node -e "const code = process.argv[1]; process.argv.splice(1, 1); eval(Buffer.from(code, 'base64').toString('utf8'));" $wxmlValidatorEncoded $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "WXML structure error: $($_.FullName)" }
}

$missingHandlers = @()
Get-ChildItem miniprogram/pages -Recurse -Filter *.wxml | ForEach-Object {
  $wxml = Get-Content -Raw $_.FullName
  $script = Get-Content -Raw ([IO.Path]::ChangeExtension($_.FullName, '.js'))
  [regex]::Matches($wxml, 'bind(?:tap|change|input|submit)="([A-Za-z_$][\w$]*)"') | ForEach-Object {
    $name = $_.Groups[1].Value
    if ($script -notmatch "(?m)^\s*(async\s+)?$([regex]::Escape($name))\s*\(") {
      $missingHandlers += "$($_.FullName):$name"
    }
  }
}
if ($missingHandlers.Count) { throw ('缺少 WXML 事件处理: ' + ($missingHandlers -join ', ')) }

$source = (Get-ChildItem miniprogram -Recurse -Filter *.js | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
$directDatabaseCalls = [regex]::Matches($source, 'wx\.cloud\.database\s*\(')
if ($directDatabaseCalls.Count) { throw '小程序端不得直接访问云数据库，请通过云函数执行权限校验与数据读写' }
$calledFunctions = @(
  [regex]::Matches($source, "name:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
  [regex]::Matches($source, "call\('([^']+)'") | ForEach-Object { $_.Groups[1].Value }
) | Sort-Object -Unique
$missingFunctions = $calledFunctions | Where-Object { !(Test-Path (Join-Path cloudfunctions $_)) }
if ($missingFunctions) { throw ('缺少云函数目录: ' + ($missingFunctions -join ', ')) }

Write-Output 'PROJECT_VALIDATION_OK'
