import os
import json
import base64
import math
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

from graph_generator import create_graph, create_history_graph
from text_generator import generate_words, get_quote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEXTS_DIR = os.path.join(BASE_DIR, 'texts') 
HISTORY_FILE = os.path.join(BASE_DIR, 'typing_history.json')

app = Flask(__name__)
CORS(app)


def load_history():
    """Loads past session records from JSON history file safely."""
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def save_history(records):
    """Saves session records to JSON history file safely."""
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=4)
    except IOError:
        pass


@app.route('/api/text')
def get_text():
    has_punctuation = request.args.get('punctuation') == 'true'
    has_numbers = request.args.get('numbers') == 'true'
    mode = request.args.get('testMode', 'words')

    try:
        word_count = int(request.args.get('wordCount', 25))
    except (TypeError, ValueError):
        word_count = 25

    try:
        duration = int(request.args.get('testDuration', 15))
    except (TypeError, ValueError):
        duration = 15

    if mode == 'quote':
        text = get_quote()
    elif mode == 'time':
        # Allocate enough words so that typists (even up to 150+ WPM) don't run out of text
        # 15s -> 60 words, 30s -> 110 words, 60s -> 220 words, 120s -> 400 words
        estimated_words = max(50, int(duration * 3.5))
        text = generate_words(count=estimated_words, with_punctuation=has_punctuation, with_numbers=has_numbers)
    else:
        # Default 'words' mode
        count = max(5, min(word_count, 150))
        text = generate_words(count=count, with_punctuation=has_punctuation, with_numbers=has_numbers)

    return jsonify({'text': text, 'mode': mode})


@app.route('/api/calculate', methods=['POST'])
def calculate_results():
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    final_user_input = data.get('finalUserInput', '')
    time_elapsed = data.get('timeElapsed')
    final_error_count = data.get('finalErrorCount', 0)
    wpm_data = data.get('wpmData', [])
    error_data = data.get('errorData', [])
    keystrokes = data.get('keystrokes', {})
    test_mode = data.get('testMode', 'words')
    test_config = data.get('testConfig', '')

    if time_elapsed is None:
        return jsonify({'error': 'Missing timeElapsed'}), 400

    try:
        time_elapsed = max(0.5, float(time_elapsed))
        final_error_count = max(0, int(final_error_count))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid data types'}), 400

    # Calculate Keystrokes & Accuracy
    correct_chars = keystrokes.get('correct')
    incorrect_chars = keystrokes.get('incorrect', final_error_count)
    extra_chars = keystrokes.get('extra', 0)
    missed_chars = keystrokes.get('missed', 0)

    # If detailed keystrokes provided by client
    if correct_chars is not None:
        total_attempts = correct_chars + incorrect_chars + extra_chars
        accuracy = round((correct_chars / max(1, total_attempts)) * 100, 1)
        raw_wpm = round(((total_attempts / 5) / (time_elapsed / 60)))
        net_wpm = round(((correct_chars / 5) / (time_elapsed / 60)))
    else:
        # Fallback using standard input length calculation
        input_len = len(final_user_input)
        effective_correct = max(0, input_len - final_error_count)
        accuracy = round((effective_correct / max(1, input_len)) * 100, 1)
        raw_wpm = round(((input_len / 5) / (time_elapsed / 60)))
        net_wpm = max(0, round(((effective_correct / 5) / (time_elapsed / 60))))
        correct_chars = effective_correct
        incorrect_chars = final_error_count

    # Calculate Consistency score (%) based on WPM series standard deviation
    consistency = 100
    if len(wpm_data) >= 2:
        speeds = [item.get('wpm', 0) for item in wpm_data if 'wpm' in item]
        if speeds:
            mean_wpm = sum(speeds) / len(speeds)
            if mean_wpm > 0:
                variance = sum((x - mean_wpm) ** 2 for x in speeds) / len(speeds)
                std_dev = math.sqrt(variance)
                cov = (std_dev / mean_wpm) * 100
                consistency = max(0, min(100, round(100 - cov)))

    results = {
        "id": datetime.utcnow().strftime("%Y%m%d%H%M%S%f"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "wpm": max(0, net_wpm),
        "raw_wpm": max(0, raw_wpm),
        "accuracy": max(0, min(100, accuracy)),
        "errors": incorrect_chars,
        "time": round(time_elapsed, 2),
        "consistency": consistency,
        "mode": test_mode,
        "config": test_config,
        "keystrokes": {
            "correct": correct_chars,
            "incorrect": incorrect_chars,
            "extra": extra_chars,
            "missed": missed_chars
        }
    }

    # Save to history
    history = load_history()
    history.append(results)
    save_history(history)

    # Generate current session graph
    buf = create_graph(wpm_data, error_data)
    if buf is not None:
        graph_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        results['graph_image'] = f"data:image/png;base64,{graph_base64}"
    else:
        results['graph_image'] = None

    results['wpmData'] = wpm_data
    results['errorData'] = error_data

    return jsonify(results)


@app.route('/api/history', methods=['GET'])
def get_history():
    """Returns past test sessions and multi-session trend graph."""
    history = load_history()

    # Calculate summary stats
    total_tests = len(history)
    if total_tests > 0:
        best_wpm = max(h.get('wpm', 0) for h in history)
        avg_wpm = round(sum(h.get('wpm', 0) for h in history) / total_tests, 1)
        avg_accuracy = round(sum(h.get('accuracy', 0) for h in history) / total_tests, 1)
        total_time = round(sum(h.get('time', 0) for h in history), 1)
    else:
        best_wpm = 0
        avg_wpm = 0
        avg_accuracy = 0
        total_time = 0

    trend_buf = create_history_graph(history)
    trend_graph_image = None
    if trend_buf is not None:
        trend_graph_image = f"data:image/png;base64,{base64.b64encode(trend_buf.getvalue()).decode('utf-8')}"

    # Return last 50 tests in reverse chronological order
    recent_history = list(reversed(history[-50:]))

    return jsonify({
        "stats": {
            "totalTests": total_tests,
            "bestWpm": best_wpm,
            "avgWpm": avg_wpm,
            "avgAccuracy": avg_accuracy,
            "totalTime": total_time
        },
        "history": recent_history,
        "trendGraphImage": trend_graph_image
    })


@app.route('/api/history', methods=['DELETE'])
def clear_history():
    """Clears past test history."""
    save_history([])
    return jsonify({"message": "History cleared successfully"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)