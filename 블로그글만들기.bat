@echo off
chcp 65001 >nul
rem 이 파일을 더블클릭하면 창이 열립니다. 터미널에 명령어를 칠 필요가 없습니다.
rem 처음 실행할 때만 필요한 준비 작업을 자동으로 합니다.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo 처음 실행이라 준비 작업을 합니다. 1~2분 걸립니다...
    echo.
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo [오류] 파이썬을 찾을 수 없습니다.
        echo        https://www.python.org/downloads/ 에서 설치한 뒤 다시 실행해주세요.
        echo        설치할 때 "Add Python to PATH" 를 꼭 체크하세요.
        echo.
        pause
        exit /b 1
    )
    ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
    ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
    ".venv\Scripts\python.exe" -m pip install --quiet -e .
    echo 준비 완료.
    echo.
)

if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo .env 파일을 만들었습니다. API 키를 넣으면 키워드 검색량을 볼 수 있습니다.
    echo.
)

start "" ".venv\Scripts\pythonw.exe" -m nblog.gui
