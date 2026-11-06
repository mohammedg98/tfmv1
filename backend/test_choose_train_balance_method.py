"""Unit tests for auto_clean_split.choose_train_balance_method."""

from backend.auto_clean_split import (
    IMBALANCE_MILD,
    IMBALANCE_STRONG,
    UNDER_KEEP_FRACTION,
    UNDER_MIN_POST_SIZE,
    choose_train_balance_method,
)


def test_balanced_no_resampling():
    # ratio 1.2 < 1.5
    d = choose_train_balance_method({"a": 1200, "b": 1000})
    assert d["method"] == "none"
    assert d["applied"] is False
    assert d["ratio"] < IMBALANCE_MILD


def test_extreme_always_oversample():
    # 20:1 → extreme oversampling
    d = choose_train_balance_method({"a": 20000, "b": 1000})
    assert d["ratio"] >= IMBALANCE_STRONG
    assert d["method"] == "oversampling"
    assert d.get("extreme") is True


def test_binary_under_when_minority_at_least_25_percent():
    # 30/70, N=10000 → minority 30% ≥ 25%, post_under=6000 ≥ 1000 → under
    d = choose_train_balance_method({"a": 7000, "b": 3000})
    assert d["n_classes"] == 2
    assert d["minority_share"] >= UNDER_KEEP_FRACTION / 2
    assert d["method"] == "undersampling"


def test_binary_over_when_minority_below_25_percent():
    # 10/90 → minority 10% < 25% → over (even if large N)
    d = choose_train_balance_method({"a": 90000, "b": 10000})
    assert d["ratio"] < IMBALANCE_STRONG
    assert d["minority_share"] < UNDER_KEEP_FRACTION / 2
    assert d["method"] == "oversampling"
    assert d["reason"] == "under_would_drop_below_keep_fraction"


def test_three_classes_threshold_about_17_percent():
    # equal-ish 3 classes → under
    d = choose_train_balance_method({"a": 4000, "b": 3500, "c": 2500})
    assert d["under_share_threshold"] == UNDER_KEEP_FRACTION / 3
    assert d["method"] == "undersampling"

    # minority ~10% with 3 classes (< 16.7%) → over
    d2 = choose_train_balance_method({"a": 8000, "b": 1000, "c": 1000})
    assert d2["ratio"] < IMBALANCE_STRONG  # 8:1
    assert d2["method"] == "oversampling"


def test_absolute_floor_forces_over_on_tiny_train():
    # minority share OK for binary (40%), but post_under = 2*400 = 800 < 1000
    d = choose_train_balance_method({"a": 600, "b": 400})
    assert d["post_under_size"] < UNDER_MIN_POST_SIZE
    assert d["method"] == "oversampling"
    assert d["reason"] == "post_under_too_small"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("OK", name)
    print("all passed")
