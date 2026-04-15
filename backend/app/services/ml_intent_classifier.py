from __future__ import annotations

import json
import math
import pickle
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from app.schemas.note_intelligence import QuestionIntent

DEFAULT_INTENT_MODEL_PATH = Path(__file__).resolve().parents[2] / "data" / "intent_classifier.joblib"
DEFAULT_EVAL_DATASET_PATH = Path(__file__).resolve().parents[2] / "data" / "note_eval_seed.jsonl"

TOKEN_PATTERN = re.compile(r"[a-z0-9']+")


@dataclass
class IntentExample:
    question: str
    label: QuestionIntent


@dataclass
class TfidfIntentClassifier:
    vocabulary: dict[str, int]
    idf: list[float]
    label_centroids: dict[QuestionIntent, list[float]]


def _tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


def load_intent_examples_from_eval_dataset(path: Path = DEFAULT_EVAL_DATASET_PATH) -> list[IntentExample]:
    examples: list[IntentExample] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            record = json.loads(raw)
            questions: list[str] = record.get("sample_questions", [])
            labels: list[str] = record.get("intent_labels", [])
            for question, label in zip(questions, labels):
                if question and label:
                    examples.append(IntentExample(question=question, label=label))
    return examples


def _build_vocabulary_and_idf(tokenized_docs: list[list[str]]) -> tuple[dict[str, int], list[float]]:
    doc_count = len(tokenized_docs)
    df = Counter()
    for doc in tokenized_docs:
        df.update(set(doc))

    vocabulary = {term: idx for idx, term in enumerate(sorted(df.keys()))}
    idf = [0.0] * len(vocabulary)
    for term, idx in vocabulary.items():
        idf[idx] = math.log((1 + doc_count) / (1 + df[term])) + 1.0
    return vocabulary, idf


def _vectorize(tokens: list[str], vocabulary: dict[str, int], idf: list[float]) -> list[float]:
    vec = [0.0] * len(vocabulary)
    if not tokens:
        return vec

    counts = Counter(token for token in tokens if token in vocabulary)
    total = sum(counts.values()) or 1
    for token, count in counts.items():
        idx = vocabulary[token]
        tf = count / total
        vec[idx] = tf * idf[idx]

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def train_intent_classifier(examples: list[IntentExample]) -> TfidfIntentClassifier:
    if not examples:
        raise ValueError("No intent examples provided for training")

    tokenized = [_tokenize(example.question) for example in examples]
    vocabulary, idf = _build_vocabulary_and_idf(tokenized)

    label_vectors: dict[QuestionIntent, list[list[float]]] = defaultdict(list)
    for example in examples:
        vec = _vectorize(_tokenize(example.question), vocabulary, idf)
        label_vectors[example.label].append(vec)

    label_centroids: dict[QuestionIntent, list[float]] = {}
    for label, vectors in label_vectors.items():
        centroid = [sum(values) / len(vectors) for values in zip(*vectors)]
        norm = math.sqrt(sum(v * v for v in centroid)) or 1.0
        label_centroids[label] = [v / norm for v in centroid]

    return TfidfIntentClassifier(vocabulary=vocabulary, idf=idf, label_centroids=label_centroids)


def save_intent_classifier(model: TfidfIntentClassifier, path: Path = DEFAULT_INTENT_MODEL_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        pickle.dump(model, handle)


def load_intent_classifier(path: Path = DEFAULT_INTENT_MODEL_PATH) -> TfidfIntentClassifier:
    with path.open("rb") as handle:
        model = pickle.load(handle)
    if not isinstance(model, TfidfIntentClassifier):
        raise TypeError("Loaded intent classifier artifact is not a TfidfIntentClassifier")
    return model


def predict_with_intent_classifier(question: str, model: TfidfIntentClassifier) -> QuestionIntent:
    vec = _vectorize(_tokenize(question), model.vocabulary, model.idf)
    best_label = "general"
    best_score = float("-inf")
    for label, centroid in model.label_centroids.items():
        score = _cosine_similarity(vec, centroid)
        if score > best_score:
            best_score = score
            best_label = label
    return best_label
