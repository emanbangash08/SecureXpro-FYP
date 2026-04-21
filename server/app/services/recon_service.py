"""
Reconnaissance service — wraps Nmap scanning and parses results.
Nmap must be installed on the host system.
"""
import asyncio
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field


@dataclass
class PortInfo:
    port: int
    protocol: str
    state: str
    service: str
    version: str
    extra_info: str


@dataclass
class HostResult:
    ip: str
    hostname: str
    os_guess: str
    ports: list[PortInfo] = field(default_factory=list)


async def run_nmap_scan(target: str, options: dict) -> list[HostResult]:
    """Run an nmap scan and return structured results."""
    flags = _build_nmap_flags(options)
    cmd = ["nmap", "-oX", "-", *flags, target]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"Nmap failed: {stderr.decode()}")

    return _parse_nmap_xml(stdout.decode())


def _build_nmap_flags(options: dict) -> list[str]:
    flags = ["-sV", "--version-intensity", "5"]
    if options.get("os_detection"):
        flags.append("-O")
    if options.get("aggressive"):
        flags.append("-A")
    if options.get("udp"):
        flags += ["-sU", "-sS"]
    port_range = options.get("port_range", "1-1000")
    flags += ["-p", port_range]
    return flags


def _parse_nmap_xml(xml_data: str) -> list[HostResult]:
    results: list[HostResult] = []
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return results

    for host_el in root.findall("host"):
        if host_el.find("status") is None or host_el.find("status").get("state") != "up":
            continue

        ip = ""
        hostname = ""
        for addr in host_el.findall("address"):
            if addr.get("addrtype") == "ipv4":
                ip = addr.get("addr", "")

        hostnames_el = host_el.find("hostnames")
        if hostnames_el is not None:
            hn = hostnames_el.find("hostname")
            if hn is not None:
                hostname = hn.get("name", "")

        os_guess = ""
        os_el = host_el.find("os")
        if os_el is not None:
            osmatch = os_el.find("osmatch")
            if osmatch is not None:
                os_guess = osmatch.get("name", "")

        ports: list[PortInfo] = []
        ports_el = host_el.find("ports")
        if ports_el is not None:
            for port_el in ports_el.findall("port"):
                state_el = port_el.find("state")
                if state_el is None or state_el.get("state") != "open":
                    continue
                svc_el = port_el.find("service")
                ports.append(PortInfo(
                    port=int(port_el.get("portid", 0)),
                    protocol=port_el.get("protocol", "tcp"),
                    state="open",
                    service=svc_el.get("name", "") if svc_el is not None else "",
                    version=svc_el.get("version", "") if svc_el is not None else "",
                    extra_info=svc_el.get("extrainfo", "") if svc_el is not None else "",
                ))

        results.append(HostResult(ip=ip, hostname=hostname, os_guess=os_guess, ports=ports))

    return results
