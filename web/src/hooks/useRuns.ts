import { useEffect, useState } from "react";

import { fetchRuns, LiveSnapshot } from "../api";

export const useRuns = (query: string) => {
  const [runs, setRuns] = useState<LiveSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    fetchRuns(query)
      .then((data) => setRuns(data))
      .catch(() => undefined);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRuns(query)
      .then((data) => {
        if (!active) {
          return;
        }
        setRuns(data);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch runs");
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  return { runs, loading, error, refresh };
};
