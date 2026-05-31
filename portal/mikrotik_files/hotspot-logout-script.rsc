# MikroTik Hotspot Script - fires on logout
/tool fetch \
    url="https://YOUR_BACKEND_URL/api/v1/webhooks/hotspot-event" \
    http-method=post \
    http-data="{\"type\":\"logout\",\"user\":\"$user\",\"mac\":\"$mac\",\"ip\":\"$ip\",\"session_id\":\"$id\",\"bytes_in\":$bytesIn,\"bytes_out\":$bytesOut,\"uptime_seconds\":0}" \
    http-header-field="Content-Type: application/json" \
    mode=https \
    keep-result=no
