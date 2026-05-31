import asyncio
import logging
import re
from datetime import datetime

logger = logging.getLogger(__name__)

# Pattern: matches MikroTik DNS query log lines
# Example: "dns,debug DNS query from 192.168.1.10: example.com type A"
_DNS_PATTERN = re.compile(
    r"DNS query from (?P<ip>[\d.]+).*?:\s+(?P<domain>[a-zA-Z0-9._-]+)\s+type\s+(?P<qtype>\w+)",
    re.IGNORECASE,
)
# Alternative pattern for newer RouterOS
_DNS_PATTERN2 = re.compile(
    r"query\s+(?P<domain>[a-zA-Z0-9._-]+)\s+(?P<qtype>A{1,4}|AAAA|CNAME|MX|TXT|PTR)\s+from\s+(?P<ip>[\d.]+)",
    re.IGNORECASE,
)

_port: int = 514
_running: bool = False


class _SyslogProtocol(asyncio.DatagramProtocol):
    def __init__(self, callback):
        self._cb = callback

    def datagram_received(self, data: bytes, addr: tuple) -> None:
        try:
            msg = data.decode("utf-8", errors="replace").strip()
            self._cb(msg, addr[0])
        except Exception:
            pass

    def error_received(self, exc: Exception) -> None:
        logger.debug("Syslog UDP error: %s", exc)

    def connection_lost(self, exc: Exception | None) -> None:
        pass


async def start_syslog_listener(port: int = 514) -> None:
    global _port, _running
    _port = port
    _running = True
    loop = asyncio.get_event_loop()

    def handle_message(msg: str, src_ip: str) -> None:
        asyncio.ensure_future(_process_message(msg, src_ip))

    try:
        transport, _ = await loop.create_datagram_endpoint(
            lambda: _SyslogProtocol(handle_message),
            local_addr=("0.0.0.0", port),
        )
        logger.info("Syslog listener started on UDP :%d", port)
        try:
            while _running:
                await asyncio.sleep(1)
        finally:
            transport.close()
    except PermissionError:
        logger.warning("Cannot bind UDP port %d (need root or cap_net_bind_service). Syslog disabled.", port)
    except Exception as e:
        logger.error("Syslog listener error: %s", e)


async def _process_message(msg: str, src_ip: str) -> None:
    m = _DNS_PATTERN.search(msg) or _DNS_PATTERN2.search(msg)
    if not m:
        return

    domain = m.group("domain").lower().rstrip(".")
    client_ip = m.group("ip")
    qtype = m.group("qtype").upper()

    if _is_noise(domain):
        return

    try:
        from app.db.session import get_session_factory
        from app.db.models.browsing_log import BrowsingLog
        from app.services.browsing_service import resolve_user_for_ip

        factory = get_session_factory()
        async with factory() as db:
            user_info = await resolve_user_for_ip(db, client_ip)
            entry = BrowsingLog(
                hotspot_username=user_info.get("hotspot_username"),
                user_type=user_info.get("user_type"),
                user_id=user_info.get("user_id"),
                domain=domain,
                query_type=qtype,
                ip_address=client_ip,
                mac_address=user_info.get("mac_address"),
                queried_at=datetime.utcnow(),
            )
            db.add(entry)
            await db.commit()
    except Exception as e:
        logger.debug("Failed to store browsing log: %s", e)


def _is_noise(domain: str) -> bool:
    noise = (
        "in-addr.arpa", "ip6.arpa", "local", "localhost",
        "broadcasthost", "_tcp", "_udp", "home",
    )
    return any(domain.endswith(n) for n in noise) or len(domain) < 4


def stop_syslog_listener() -> None:
    global _running
    _running = False
