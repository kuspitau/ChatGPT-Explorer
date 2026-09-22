@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ============================================================
echo ChatGPT Explorer - test + Git commit + push
echo ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Ce fichier .bat n'est pas place dans un repository Git.
    pause
    exit /b 1
)

where node >nul 2>nul
if not errorlevel 1 (
    echo [INFO] Core smoke tests...
    node tests\core-smoke.js
    if errorlevel 1 (
        echo [FAIL] Tests en echec. Aucun commit effectue.
        pause
        exit /b 1
    )
) else (
    echo [WARN] Node.js absent: tests automatiques ignores.
)

echo.
git status --short
echo.
git status --porcelain | findstr . >nul
if errorlevel 1 (
    echo Aucun changement a commit.
    pause
    exit /b 0
)

set /p "COMMIT_MSG=Nom du commit : "
if "%COMMIT_MSG%"=="" (
    echo [FAIL] Le nom du commit ne peut pas etre vide.
    pause
    exit /b 1
)

git add -A
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 (
    echo Aucun changement a commit apres staging.
    pause
    exit /b 0
)

git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto :error

git push origin HEAD
if errorlevel 1 goto :error

echo.
echo [PASS] Commit et push termines avec succes.
pause
exit /b 0

:error
echo.
echo [FAIL] Une commande Git a echoue. Aucun reset automatique n'a ete effectue.
pause
exit /b 1
