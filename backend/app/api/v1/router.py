from fastapi import APIRouter

from app.api.v1 import auth, employees, guests, otp, connections, settings, bandwidth, webhooks, audit
from app.api.v1 import assets, agent, browsing, policies, realtime
from app.api.v1 import analytics, vouchers, health, export
from app.api.v1.mikrotik import system, interfaces, dhcp, firewall, hotspot, queues, dns

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(employees.router)
api_router.include_router(guests.router)
api_router.include_router(otp.router)
api_router.include_router(connections.router)
api_router.include_router(settings.router)
api_router.include_router(bandwidth.router)
api_router.include_router(webhooks.router)
api_router.include_router(audit.router)
api_router.include_router(assets.router)
api_router.include_router(agent.router)
api_router.include_router(browsing.router)
api_router.include_router(policies.router)
api_router.include_router(realtime.router)
api_router.include_router(analytics.router)
api_router.include_router(vouchers.router)
api_router.include_router(health.router)
api_router.include_router(export.router)

# MikroTik management routes
api_router.include_router(system.router)
api_router.include_router(interfaces.router)
api_router.include_router(dhcp.router)
api_router.include_router(firewall.router)
api_router.include_router(hotspot.router)
api_router.include_router(queues.router)
api_router.include_router(dns.router)
