@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo ============================================================
echo OctoTweaks - Git commit + push
echo ============================================================
echo.

rem ------------------------------------------------------------
rem Verify Git repository
rem ------------------------------------------------------------

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Ce fichier .bat n'est pas place dans un repository Git.
    echo.
    pause
    exit /b 1
)

rem ------------------------------------------------------------
rem Validate OctoTweaks before touching Git staging
rem ------------------------------------------------------------

echo [INFO] Validation du repository...
echo.

where py >nul 2>nul
if not errorlevel 1 (
    py -3 tools\check.py
) else (
    python tools\check.py
)

if errorlevel 1 (
    echo.
    echo [FAIL] Les checks OctoTweaks ont echoue.
    echo        Aucun commit ni push n'a ete effectue.
    echo.
    pause
    exit /b 1
)

echo.
echo [PASS] Validation terminee
echo.

rem ------------------------------------------------------------
rem Show current changes
rem ------------------------------------------------------------

echo === Modifications locales ===
echo.

git status --short

echo.

rem Detect tracked/untracked changes before asking for a message.
git status --porcelain | findstr . >nul
if errorlevel 1 (
    echo Aucun changement a commit.
    echo.
    pause
    exit /b 0
)

rem ------------------------------------------------------------
rem Commit message
rem ------------------------------------------------------------

set /p "COMMIT_MSG=Nom du commit : "

if "%COMMIT_MSG%"=="" (
    echo.
    echo [FAIL] Le nom du commit ne peut pas etre vide.
    echo.
    pause
    exit /b 1
)

rem ------------------------------------------------------------
rem Stage
rem ------------------------------------------------------------

echo.
echo [1/3] Ajout des modifications...

git add -A
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo Aucun changement a commit apres staging.
    echo.
    pause
    exit /b 0
)

rem ------------------------------------------------------------
rem Commit
rem ------------------------------------------------------------

echo.
echo [2/3] Commit...

git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto :error

rem ------------------------------------------------------------
rem Push
rem ------------------------------------------------------------

echo.
echo [3/3] Push...

git push origin HEAD
if errorlevel 1 goto :error

echo.
echo ============================================================
echo [PASS] Commit et push termines avec succes
echo ============================================================
echo.

pause
exit /b 0


:error

echo.
echo ============================================================
echo [FAIL] Une commande Git a echoue
echo ============================================================
echo.
echo Aucun reset ou nettoyage automatique n'a ete effectue.
echo.

pause
exit /b 1