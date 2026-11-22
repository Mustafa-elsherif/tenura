"""Workforce Atlas analytics modules."""

from importlib import import_module

__version__ = "2.0.0"

_EXPORTS = {
    "load_data": "data_ingestion",
    "preprocess_data": "preprocessing",
    "run_eda": "eda",
    "engineer_features": "feature_engineering",
    "train_models": "models",
    "run_clustering": "clustering",
    "generate_insights": "insights",
}

__all__ = list(_EXPORTS)


def __getattr__(name):
    if name not in _EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(import_module(f".{_EXPORTS[name]}", __name__), name)
    globals()[name] = value
    return value
