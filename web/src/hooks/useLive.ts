import { useEffect, useState } from "react";

import { LiveSnapshot, subscribeLive } from "../api";

export const useLive = () => {
  const [live, setLive] = useState<LiveSnapshot | null>(null);

  useEffect(() => {
    const source = subscribeLive((next) => {
      setLive(next);
    });
    return () => {
      source.close();
    };
  }, []);

  return live;
};
