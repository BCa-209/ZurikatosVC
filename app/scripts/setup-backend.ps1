$ErrorActionPreference = 'Stop'
$backendDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../backend'))
Push-Location -LiteralPath $backendDirectory
try {
    if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
        py -3 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear .venv. Instala Python 3.11 o superior.' }
    }
    & ./.venv/Scripts/python.exe -m pip install -r requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
    if (-not (Test-Path -LiteralPath '.env')) {
        $tokenBytes = New-Object byte[] 32
        $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $generator.GetBytes($tokenBytes)
        $generator.Dispose()
        $operatorKey = [Convert]::ToBase64String($tokenBytes)
        [System.IO.File]::WriteAllText((Join-Path $backendDirectory '.env'), "OPERATOR_TOKEN=$operatorKey`nCORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`n", [System.Text.UTF8Encoding]::new($false))
        Write-Output 'Clave operativa creada en backend/.env. Este archivo no se sube a Git.'
    }
    Write-Output 'Backend listo. Desde app ejecuta: npm run dev:backend'
} finally { Pop-Location }
