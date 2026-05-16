"""
Centralised rate-limiter instance.

Defined here (not in main.py) so endpoint modules can import it without
creating a circular dependency through app.main.

Keying strategy: per remote-IP (X-Forwarded-For aware via slowapi's
get_remote_address). For finer-grained controls (per-email throttling on
auth endpoints) we apply additional manual checks inside the service layer.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
