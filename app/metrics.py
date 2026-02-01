from __future__ import annotations

from dataclasses import dataclass

from prometheus_client import Counter, start_http_server

processed_counter = Counter("records_processed_total", "Total records processed successfully")
failed_counter = Counter("records_failed_total", "Total records failed")
batches_counter = Counter("batches_total", "Total batches completed")


@dataclass
class Metrics:
    def inc_processed(self, n: int) -> None:
        processed_counter.inc(n)

    def inc_failed(self, n: int) -> None:
        failed_counter.inc(n)

    def inc_batches(self, n: int = 1) -> None:
        batches_counter.inc(n)


def maybe_start_metrics_server(port: int | None) -> Metrics:
    if port is not None:
        start_http_server(port)
    return Metrics()
