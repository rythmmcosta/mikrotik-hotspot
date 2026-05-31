@echo off
REM Install hotspot agent as a Windows Service
REM Run as Administrator

SET AGENT_DIR=%~dp0
SET PYTHON=python

if not exist "%AGENT_DIR%agent_config.ini" (
    copy "%AGENT_DIR%agent_config.ini.example" "%AGENT_DIR%agent_config.ini"
    echo Created agent_config.ini -- edit it before starting the service
)

echo Installing required packages...
%PYTHON% -m pip install psutil pywin32 --quiet

echo Installing Windows Service...
%PYTHON% "%AGENT_DIR%hotspot_agent.py" install

echo Starting service...
%PYTHON% "%AGENT_DIR%hotspot_agent.py" start

echo.
echo Service installed. Check status in Services (services.msc) under "Hotspot Monitoring Agent"
pause
