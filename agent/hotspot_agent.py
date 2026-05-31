#!/usr/bin/env python3
"""
Hotspot Monitoring Agent
Runs at system startup, sends metrics and DNS activity to the hotspot backend.

Setup:
  1. Copy agent_config.ini.example to agent_config.ini and fill in backend_url, asset_id, token
  2. Run: python hotspot_agent.py
  3. For service install: run install_windows.bat (Windows) or install_linux.sh (Linux)
"""

import configparser
import json
import logging
import os
import platform
import socket
import sys
import threading
import time
import urllib.request
import urllib.error
from collections import deque
from datetime import datetime, timezone

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

logger = logging.getLogger("hotspot_agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "agent_config.ini")
METRICS_INTERVAL = 5       # seconds between metric collections
HEARTBEAT_INTERVAL = 30    # seconds between heartbeats
BATCH_SIZE = 12            # flush metrics every BATCH_SIZE × METRICS_INTERVAL (60s)

_browsing_queue: deque = deque(maxlen=500)
_metrics_batch: list = []
_stop = threading.Event()


def load_config() -> dict:
    cfg = configparser.ConfigParser()
    if not os.path.exists(CONFIG_FILE):
        logger.error("Config file not found: %s", CONFIG_FILE)
        sys.exit(1)
    cfg.read(CONFIG_FILE)
    agent = cfg["agent"]
    return {
        "backend_url": agent.get("backend_url", "http://localhost:8000/api/v1"),
        "asset_id": int(agent.get("asset_id", "0")),
        "token": agent.get("token", ""),
        "verify_ssl": agent.getboolean("verify_ssl", fallback=True),
    }


def post_json(url: str, data: dict, verify_ssl: bool = True) -> dict | None:
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    ctx = None
    if not verify_ssl:
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        logger.debug("HTTP %s for %s", e.code, url)
        return None
    except Exception as e:
        logger.debug("Request failed: %s", e)
        return None


def collect_metrics() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    if not HAS_PSUTIL:
        return {"collected_at": now}

    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_per_core = psutil.cpu_percent(percpu=True)
    mem = psutil.virtual_memory()
    disk_io = psutil.disk_io_counters()
    net_io = psutil.net_io_counters()
    connections = len(psutil.net_connections())

    return {
        "collected_at": now,
        "cpu_percent": cpu_percent,
        "cpu_per_core": cpu_per_core,
        "ram_total": mem.total,
        "ram_used": mem.used,
        "ram_percent": mem.percent,
        "disk_read_bytes": disk_io.read_bytes if disk_io else None,
        "disk_write_bytes": disk_io.write_bytes if disk_io else None,
        "net_bytes_sent": net_io.bytes_sent if net_io else None,
        "net_bytes_recv": net_io.bytes_recv if net_io else None,
        "net_packets_sent": net_io.packets_sent if net_io else None,
        "net_packets_recv": net_io.packets_recv if net_io else None,
        "active_connections": connections,
    }


def metrics_thread(config: dict) -> None:
    global _metrics_batch
    backend = config["backend_url"]
    asset_id = config["asset_id"]
    token = config["token"]
    ssl = config["verify_ssl"]

    if HAS_PSUTIL:
        psutil.cpu_percent(interval=None)  # discard first reading

    while not _stop.is_set():
        m = collect_metrics()
        _metrics_batch.append(m)

        if len(_metrics_batch) >= BATCH_SIZE:
            batch = _metrics_batch[:]
            _metrics_batch = []
            post_json(f"{backend}/agent/metrics", {
                "asset_id": asset_id,
                "token": token,
                "metrics": batch,
            }, verify_ssl=ssl)

        _stop.wait(METRICS_INTERVAL)


def heartbeat_thread(config: dict) -> None:
    backend = config["backend_url"]
    asset_id = config["asset_id"]
    token = config["token"]
    ssl = config["verify_ssl"]

    hostname = socket.gethostname()
    os_type = platform.system().lower()
    if os_type == "darwin":
        os_type = "macos"

    while not _stop.is_set():
        post_json(f"{backend}/agent/heartbeat", {
            "asset_id": asset_id,
            "token": token,
            "hostname": hostname,
            "agent_version": "1.0.0",
            "os_type": os_type,
        }, verify_ssl=ssl)
        _stop.wait(HEARTBEAT_INTERVAL)


def browsing_flush_thread(config: dict) -> None:
    backend = config["backend_url"]
    asset_id = config["asset_id"]
    token = config["token"]
    ssl = config["verify_ssl"]

    while not _stop.is_set():
        _stop.wait(30)
        if _browsing_queue:
            entries = []
            while _browsing_queue:
                entries.append(_browsing_queue.popleft())
            if entries:
                post_json(f"{backend}/agent/browsing", {
                    "asset_id": asset_id,
                    "token": token,
                    "entries": entries,
                }, verify_ssl=ssl)


def dns_capture_thread() -> None:
    """Capture DNS queries via reading /etc/hosts or system resolver logs.
    On Windows: monitors DNS Client event log.
    On Linux: tries to sniff UDP port 53 via raw socket if permitted.
    Falls back to no-op if not privileged.
    """
    if platform.system() == "Windows":
        _dns_windows()
    else:
        _dns_linux()


def _dns_linux() -> None:
    try:
        import socket as sock
        s = sock.socket(sock.AF_INET, sock.SOCK_RAW, sock.IPPROTO_UDP)
        s.setblocking(False)
        logger.info("DNS capture active (raw socket)")
        while not _stop.is_set():
            try:
                data, addr = s.recvfrom(512)
                if len(data) > 20:
                    domain = _parse_dns_question(data[20:])
                    if domain:
                        _browsing_queue.append({
                            "domain": domain,
                            "query_type": "A",
                            "ip_address": addr[0],
                            "queried_at": datetime.now(timezone.utc).isoformat(),
                        })
            except BlockingIOError:
                _stop.wait(0.1)
        s.close()
    except PermissionError:
        logger.info("DNS capture disabled (no raw socket permission)")
    except Exception as e:
        logger.debug("DNS capture error: %s", e)


def _dns_windows() -> None:
    logger.info("DNS capture via Windows ETW not implemented; syslog capture handles this on server.")


def _parse_dns_question(payload: bytes) -> str | None:
    try:
        # Skip 12-byte DNS header
        if len(payload) < 13:
            return None
        pos = 12
        labels = []
        while pos < len(payload):
            length = payload[pos]
            if length == 0:
                break
            pos += 1
            labels.append(payload[pos:pos + length].decode("ascii", errors="ignore"))
            pos += length
        domain = ".".join(labels)
        return domain if len(domain) > 3 else None
    except Exception:
        return None


def run() -> None:
    config = load_config()
    if not config["token"] or not config["asset_id"]:
        logger.error("agent_config.ini: set asset_id and token before running")
        sys.exit(1)

    logger.info("Starting hotspot agent for asset_id=%d", config["asset_id"])

    threads = [
        threading.Thread(target=heartbeat_thread, args=(config,), daemon=True, name="heartbeat"),
        threading.Thread(target=metrics_thread, args=(config,), daemon=True, name="metrics"),
        threading.Thread(target=browsing_flush_thread, args=(config,), daemon=True, name="browsing"),
        threading.Thread(target=dns_capture_thread, daemon=True, name="dns"),
    ]
    for t in threads:
        t.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down")
        _stop.set()


# Windows Service support
if platform.system() == "Windows":
    try:
        import win32serviceutil
        import win32service
        import win32event

        class HotspotAgentService(win32serviceutil.ServiceFramework):
            _svc_name_ = "HotspotAgent"
            _svc_display_name_ = "Hotspot Monitoring Agent"

            def __init__(self, args):
                win32serviceutil.ServiceFramework.__init__(self, args)
                self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)

            def SvcStop(self):
                self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
                _stop.set()
                win32event.SetEvent(self.hWaitStop)

            def SvcDoRun(self):
                run()
    except ImportError:
        pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("install", "remove", "start", "stop"):
        if platform.system() == "Windows":
            win32serviceutil.HandleCommandLine(HotspotAgentService)
    else:
        run()
