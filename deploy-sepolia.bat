@echo off
REM ═══════════════════════════════════════════════════════════
REM  KAWA·CHAIN — Deploy to Sepolia via Docker (Windows)
REM ═══════════════════════════════════════════════════════════
REM
REM  Before running this:
REM    1. Get free SepoliaETH from:
REM       https://cloud.google.com/application/web3/faucet/ethereum/sepolia
REM    2. Get your MetaMask private key:
REM       MetaMask → ⋮ → Account details → Show private key
REM    3. Paste the key below (between the quotes)
REM

set DEPLOYER_KEY=PASTE_YOUR_PRIVATE_KEY_HERE

if "%DEPLOYER_KEY%"=="PASTE_YOUR_PRIVATE_KEY_HERE" (
    echo.
    echo  ERROR: You need to edit this file first!
    echo.
    echo  Open deploy-sepolia.bat in Notepad and replace
    echo  PASTE_YOUR_PRIVATE_KEY_HERE with your MetaMask private key.
    echo.
    echo  Get your key: MetaMask → three dots → Account details → Show private key
    echo  Get free ETH: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
    echo.
    pause
    exit /b 1
)

echo.
echo  Building deployment container...
docker build -f docker/sepolia-deploy.Dockerfile -t kawa-deploy .

echo.
echo  Deploying to Sepolia (takes 1-3 minutes)...
docker run --rm -e DEPLOYER_KEY=%DEPLOYER_KEY% -v "%cd%\frontend\src\lib:/app/frontend/src/lib" kawa-deploy

echo.
echo  ═══════════════════════════════════════════════
echo  Done! Now start the frontend:
echo    docker compose -f docker-compose-sepolia.yml up --build
echo  Then open http://localhost:5173
echo  ═══════════════════════════════════════════════
pause
