@echo off
echo Starting Sheet Expander...
cd /d "C:\Users\cabre\Documents\trae_projects\FORMAT USERNAME GENERATOR\sheet-expander"

:: Open the browser (give server a moment to start)
start "" "http://localhost:5173"

:: Start the server
echo Starting Vite Server...
npm run dev

pause