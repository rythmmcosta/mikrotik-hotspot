# MikroTik Hotspot Script - fires on login/logout
# Upload to router and configure in:
#   /ip hotspot -> Server Profiles -> Login by Script

# Determine user type from comment field
:local userComment [/ip hotspot user get [find name=$user] comment]
:local userType "guest"
:local userDbId "0"

# Parse comment like "db_id:123" or "guest_id:456"
:if ([:find $userComment "db_id:"] >= 0) do={
    :set userType "employee"
    :set userDbId [:pick $userComment ([:find $userComment ":"] + 1) [:len $userComment]]
}
:if ([:find $userComment "guest_id:"] >= 0) do={
    :set userType "guest"
    :set userDbId [:pick $userComment ([:find $userComment ":"] + 1) [:len $userComment]]
}

# POST to backend webhook
/tool fetch \
    url="https://YOUR_BACKEND_URL/api/v1/webhooks/hotspot-event" \
    http-method=post \
    http-data="{\"type\":\"login\",\"user\":\"$user\",\"mac\":\"$mac\",\"ip\":\"$ip\",\"session_id\":\"$id\",\"user_type\":\"$userType\",\"user_db_id\":$userDbId}" \
    http-header-field="Content-Type: application/json" \
    mode=https \
    keep-result=no
