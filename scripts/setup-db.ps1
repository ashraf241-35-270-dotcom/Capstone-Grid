# Creates the MySQL database and dedicated application user, then applies the schema.
# Usage (from the project root):  npm run db:setup
# You will be prompted once for the MySQL root password. It is never written to disk.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing .env. Copy .env.example to .env and fill in the values first."
}

$config = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $config[$matches[1]] = $matches[2].Trim('"').Trim("'")
  }
}

$dbName = $config['DB_NAME']
$dbUser = $config['DB_USER']
$dbPass = $config['DB_PASSWORD']
$dbHost = if ($config['DB_HOST']) { $config['DB_HOST'] } else { '127.0.0.1' }
$dbPort = if ($config['DB_PORT']) { $config['DB_PORT'] } else { '3306' }

if (-not $dbName -or -not $dbUser -or -not $dbPass) {
  throw ".env must define DB_NAME, DB_USER and DB_PASSWORD."
}
if ($dbName -notmatch '^[A-Za-z0-9_]+$') {
  throw "DB_NAME may only contain letters, digits and underscores."
}
if ($dbUser -notmatch '^[A-Za-z0-9_]+$') {
  throw "DB_USER may only contain letters, digits and underscores."
}
if ($dbPass -match "['\\\r\n]") {
  throw "DB_PASSWORD must not contain quotes, backslashes or newlines."
}

$mysql = $null
$cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
if ($cmd) { $mysql = $cmd.Source }
if (-not $mysql) {
  $found = Get-ChildItem 'C:\Program Files\MySQL' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\mysql.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  $mysql = $found
}
if (-not $mysql) {
  throw "mysql.exe was not found. Install MySQL 8 or add its bin folder to PATH."
}

$bt = [char]96
$sql = @(
  "CREATE DATABASE IF NOT EXISTS $bt$dbName$bt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
  "CREATE USER IF NOT EXISTS '$dbUser'@'localhost' IDENTIFIED BY '$dbPass';",
  "ALTER USER '$dbUser'@'localhost' IDENTIFIED BY '$dbPass';",
  "CREATE USER IF NOT EXISTS '$dbUser'@'127.0.0.1' IDENTIFIED BY '$dbPass';",
  "ALTER USER '$dbUser'@'127.0.0.1' IDENTIFIED BY '$dbPass';",
  "GRANT ALL PRIVILEGES ON $bt$dbName$bt.* TO '$dbUser'@'localhost';",
  "GRANT ALL PRIVILEGES ON $bt$dbName$bt.* TO '$dbUser'@'127.0.0.1';",
  "FLUSH PRIVILEGES;"
) -join [Environment]::NewLine

$secure = Read-Host "Enter MySQL root password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plainRoot = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
$oldOutputEncoding = $OutputEncoding
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try {
  Write-Host "Creating database '$dbName' and user '$dbUser'..."
  $env:MYSQL_PWD = $plainRoot
  $sql | & $mysql -u root -h localhost -P $dbPort --default-character-set=utf8mb4
  if ($LASTEXITCODE -ne 0) { throw "Creating the database failed (mysql exit code $LASTEXITCODE)." }

  Write-Host "Applying database/schema.sql..."
  $env:MYSQL_PWD = $dbPass
  Get-Content -Raw -LiteralPath (Join-Path $root 'database\schema.sql') |
    & $mysql -u $dbUser -h $dbHost -P $dbPort --default-character-set=utf8mb4 $dbName
  if ($LASTEXITCODE -ne 0) { throw "Applying the schema failed (mysql exit code $LASTEXITCODE)." }

  Write-Host ""
  Write-Host "Done. Database and schema are ready." -ForegroundColor Green
  Write-Host "Next: npm run db:verify   (then npm run dev)"
}
finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  $OutputEncoding = $oldOutputEncoding
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
