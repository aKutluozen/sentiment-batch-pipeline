from __future__ import annotations

from typing import Any, List, Dict

from transformers import pipeline


def load_sentiment_pipeline(model_name: str, max_len: int):
    # truncation ensures very long texts do not crash tokenization
    return pipeline(
        task="sentiment-analysis",
        model=model_name,
        truncation=True,
        max_length=max_len,
    )


def predict_batch(nlp, texts: List[str]) -> List[Dict[str, Any]]:
    # HF pipeline supports batching by passing a list
    return nlp(texts)
