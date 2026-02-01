from __future__ import annotations

from dataclasses import dataclass

from prometheus_client import Counter, Histogram, start_http_server

processed_counter = Counter("records_processed_total", "Total records processed successfully")
failed_counter = Counter("records_failed_total", "Total records failed")
batches_counter = Counter("batches_total", "Total batches completed")
batch_duration_hist = Histogram("batch_duration_seconds", "Batch processing duration in seconds")
job_duration_hist = Histogram("job_duration_seconds", "Job duration in seconds")


@dataclass
class Metrics:
    def inc_processed(self, n: int) -> None:
        processed_counter.inc(n)

    def inc_failed(self, n: int) -> None:
        failed_counter.inc(n)

    def inc_batches(self, n: int = 1) -> None:
        batches_counter.inc(n)

    def observe_batch_duration(self, seconds: float) -> None:
        batch_duration_hist.observe(seconds)

    def observe_job_duration(self, seconds: float) -> None:
        job_duration_hist.observe(seconds)


def maybe_start_metrics_server(port: int | None) -> Metrics:
    if port is not None:
        start_http_server(port)
    return Metrics()
