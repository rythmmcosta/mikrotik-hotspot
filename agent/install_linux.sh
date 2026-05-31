#!/bin/bash
# Install hotspot agent as a systemd service on Linux

set -e

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/hotspot-agent.service"

if [ ! -f "$AGENT_DIR/agent_config.ini" ]; then
    cp "$AGENT_DIR/agent_config.ini.example" "$AGENT_DIR/agent_config.ini"
    echo "Created agent_config.ini — edit it before starting the service"
fi

pip3 install psutil --quiet

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Hotspot Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $AGENT_DIR/hotspot_agent.py
WorkingDirectory=$AGENT_DIR
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hotspot-agent.service
systemctl start hotspot-agent.service

echo "Service installed and started. Check: systemctl status hotspot-agent"
