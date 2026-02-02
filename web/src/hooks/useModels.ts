import { useEffect, useState } from "react";

import { fetchModels, ModelInfo } from "../api";

export const useModels = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    let active = true;
    fetchModels()
      .then((data) => {
        if (!active) {
          return;
        }
        setModels(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return models;
};
