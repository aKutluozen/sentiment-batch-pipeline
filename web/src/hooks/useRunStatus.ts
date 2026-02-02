import { useEffect, useState } from "react";

import { fetchRunStatus, RunStatus } from "../api";

export const useRunStatus = () => {
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);

  const refresh = () =>
    fetchRunStatus()
      .then((status) => setRunStatus(status))
      .catch(() => undefined);

  useEffect(() => {
    let active = true;
    const updateStatus = () => {
      fetchRunStatus()
        .then((status) => {
          if (!active) {
            return;
          }
          setRunStatus(status);
        })
        .catch(() => undefined);
    };
    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { runStatus, refresh };
};
