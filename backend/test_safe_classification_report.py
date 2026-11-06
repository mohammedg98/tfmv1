"""Unit tests for safe_classification_report (train classes ⊃ test classes)."""

import numpy as np

from backend.data_managment import safe_classification_report


def test_report_when_test_misses_train_classes():
    # Train had 4 classes 0..3; test fold only sees 0 and 1
    y_true = np.array([0, 0, 1, 1, 0, 1])
    y_pred = np.array([0, 1, 1, 1, 0, 0])
    class_names = [0, 1, 2, 3]
    rep = safe_classification_report(y_true, y_pred, class_names=class_names)
    assert isinstance(rep, dict)
    assert "accuracy" in rep
    # Present classes are reported; missing train classes are omitted (no crash)
    assert "0" in rep or 0 in rep or "0.0" in rep


def test_report_label_encoder_style_names():
    y_true = np.array([0, 1, 0, 1])
    y_pred = np.array([0, 0, 1, 1])
    class_names = ["benign", "phishing", "other", "junk"]
    rep = safe_classification_report(y_true, y_pred, class_names=class_names)
    assert "benign" in rep
    assert "phishing" in rep
    assert "accuracy" in rep


def test_report_without_class_names():
    y_true = np.array([0, 1, 0])
    y_pred = np.array([0, 1, 1])
    rep = safe_classification_report(y_true, y_pred, class_names=None)
    assert "accuracy" in rep
