from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "securexpro",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.scan_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Ack only after task finishes — prevents job loss if worker crashes mid-scan
    task_acks_late=True,
    # One task at a time per worker slot; fair distribution across long-running scans
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.scan_tasks.run_scan_task": {"queue": "scans"},
    },
    # Windows requires solo pool: start worker with --pool=solo on Windows
    worker_pool="prefork",
    broker_connection_retry_on_startup=True,
)
