from __future__ import annotations

from typing import Any, List, Dict

from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline


def load_sentiment_pipeline(model_name: str, max_len: int):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)

    # Protect against very long inputs that exceed model/tokenizer limits
    safe_max_len = max_len
    model_max = getattr(model.config, "max_position_embeddings", None)
    if isinstance(model_max, int) and model_max > 0:
        safe_max_len = min(safe_max_len, model_max)

    tok_max = getattr(tokenizer, "model_max_length", None)
    if isinstance(tok_max, int) and 0 < tok_max < 1_000_000:
        safe_max_len = min(safe_max_len, tok_max)

    return pipeline(
        task="sentiment-analysis",
        model=model,
        tokenizer=tokenizer,
        truncation=True,
        max_length=safe_max_len,
    )


def predict_batch(nlp, texts: List[str]) -> List[Dict[str, Any]]:
    return nlp(texts)
