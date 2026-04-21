import json
import os
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "static" / "content.json"

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

_content_cache = None
_state = {
    "log": [],
    "quiz_answers": {},
    "learn_selections": {},
}


def load_content():
    global _content_cache
    if _content_cache is None:
        with open(DATA_PATH, encoding="utf-8") as f:
            _content_cache = json.load(f)
    return _content_cache


def tile_label(question, tile_id):
    if not tile_id:
        return "—"
    for d in question.get("draggables", []):
        if d.get("id") == tile_id:
            return d.get("short_label", tile_id)
    return tile_id


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def log_event(event_type, route, payload=None):
    entry = {
        "time": utc_now_iso(),
        "type": event_type,
        "route": route,
        "payload": payload or {},
    }
    _state["log"].append(entry)
    return entry


@app.route("/")
def home():
    data = load_content()
    return render_template(
        "home.html",
        app_info=data["app"],
        media=data.get("media", {}),
    )


@app.route("/learn/<int:lesson_id>")
def learn(lesson_id):
    data = load_content()
    lessons = data["lessons"]
    found = next((L for L in lessons if L["id"] == lesson_id), None)
    if not found:
        return ("Lesson not found", 404)
    total = len(lessons)
    return render_template(
        "learn.html",
        lesson=found,
        lesson_index=lesson_id,
        total_lessons=total,
        app_info=data["app"],
    )


@app.route("/quiz/<int:question_id>")
def quiz(question_id):
    data = load_content()
    questions = data["quiz"]
    found = next((Q for Q in questions if Q["id"] == question_id), None)
    if not found:
        return ("Question not found", 404)
    total = len(questions)
    return render_template(
        "quiz.html",
        question=found,
        q_index=question_id,
        total_questions=total,
        app_info=data["app"],
    )


@app.route("/quiz/result")
def quiz_result():
    data = load_content()
    questions = data["quiz"]
    answers = _state["quiz_answers"]
    correct = 0
    details = []
    for q in questions:
        qid = str(q["id"])
        chosen = answers.get(qid)
        ok = chosen is not None and chosen == q["correct"]
        if ok:
            correct += 1
        details.append(
            {
                "id": q["id"],
                "prompt": q["prompt"],
                "chosen": chosen,
                "chosen_label": tile_label(q, chosen),
                "correct": q["correct"],
                "correct_label": tile_label(q, q["correct"]),
                "is_correct": ok,
                "feedback_wrong": q.get("feedback_wrong", ""),
            }
        )
    total = len(questions)
    log_event(
        "quiz_result_view",
        "/quiz/result",
        {"score": correct, "total": total},
    )
    return render_template(
        "quiz_result.html",
        score=correct,
        total=total,
        details=details,
        app_info=data["app"],
    )


@app.route("/api/log", methods=["POST"])
def api_log():
    body = request.get_json(silent=True) or {}
    event_type = body.get("type", "client")
    route = body.get("route", request.referrer or "")
    payload = body.get("payload")
    log_event(event_type, route, payload)
    return jsonify({"ok": True})


@app.route("/api/session/start_learning", methods=["POST"])
def session_start_learning():
    log_event("session_start_learning", "/api/session/start_learning", {})
    _state["learn_selections"] = {}
    return jsonify({"ok": True})


@app.route("/api/learn/selection", methods=["POST"])
def learn_selection():
    body = request.get_json(silent=True) or {}
    key = body.get("key")
    value = body.get("value")
    lesson_id = body.get("lesson_id")
    if key:
        _state["learn_selections"][str(key)] = value
    log_event(
        "learn_selection",
        "/api/learn/selection",
        {"lesson_id": lesson_id, "key": key, "value": value},
    )
    return jsonify({"ok": True})


@app.route("/api/quiz/answer", methods=["POST"])
def quiz_answer():
    body = request.get_json(silent=True) or {}
    qid = str(body.get("question_id", ""))
    value = body.get("answer")
    if qid:
        _state["quiz_answers"][qid] = value
    log_event(
        "quiz_answer",
        "/api/quiz/answer",
        {"question_id": qid, "answer": value},
    )
    return jsonify({"ok": True})


@app.route("/api/quiz/reset", methods=["POST"])
def quiz_reset():
    _state["quiz_answers"] = {}
    log_event("quiz_reset", "/api/quiz/reset", {})
    return jsonify({"ok": True})


@app.route("/api/debug/state", methods=["GET"])
def debug_state():
    """Useful during TA demo; not required by assignment."""
    return jsonify(
        {
            "log_count": len(_state["log"]),
            "recent": _state["log"][-20:],
            "quiz_answers": _state["quiz_answers"],
            "learn_selections": _state["learn_selections"],
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
