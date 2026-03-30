from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import json
import os
import base64

from graph_generator import create_graph

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TEXTS_DIR = os.path.join(BASE_DIR, 'texts') 

TEXT_DEFAULT = os.path.join(BASE_DIR, 'typingTexts.txt') 

TEXT_PUNCT = os.path.join(TEXTS_DIR, 'textsWithPunctuations.txt')
TEXT_NUM = os.path.join(TEXTS_DIR, 'textsWithNumbers.txt')
TEXT_BOTH = os.path.join(TEXTS_DIR, 'textsWithBothNumAndPunct.txt')
TEXT_PARA = os.path.join(TEXTS_DIR, 'para.txt')

HISTORY_FILE = os.path.join(BASE_DIR, 'typing_history.json')

app = Flask(__name__)
CORS(app)


def get_random_line(file_path):
    if not os.path.exists(file_path):
        return ""

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]

    return random.choice(lines) if lines else ""

@app.route('/api/text')
def get_text():
    has_punctuation = request.args.get('punctuation') == 'true'
    has_numbers = request.args.get('numbers') == 'true'
    mode = request.args.get('testMode')
    
    selected_file = TEXT_DEFAULT 
    
    if mode == 'time':
        selected_file = TEXT_PARA
    elif has_punctuation and has_numbers:
        selected_file = TEXT_BOTH
    elif has_punctuation:
        selected_file = TEXT_PUNCT
    elif has_numbers:
        selected_file = TEXT_NUM
    
    random_text = get_random_line(selected_file)
    return jsonify({'text': random_text})

@app.route('/api/calculate', methods=['POST'])
def calculate_results():
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    final_user_input = data.get('finalUserInput')
    time_elapsed = data.get('timeElapsed')
    final_error_count = data.get('finalErrorCount')
    
    wpm_data = data.get('wpmData', [])
    error_data = data.get('errorData', [])

    if not all([final_user_input, time_elapsed is not None, final_error_count is not None]):
        return jsonify({}), 400

    try:
        time_elapsed = max(1, float(time_elapsed))
        final_error_count = int(final_error_count)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid data types'}), 400

    wpm = round((len(final_user_input) / 5) / (time_elapsed / 60))
    accuracy = max(0, round((1 - final_error_count / max(1, len(final_user_input))) * 100))

    results = {
        "wpm": wpm,
        "accuracy": accuracy,
        "errors": final_error_count,
        "time": time_elapsed 
    }
    
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except json.JSONDecodeError:
            history = []

    history.append(results)

    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=4)
    except IOError:
        pass
    
    buf = create_graph(wpm_data, error_data)
    
    if buf is not None:
        graph_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        results['graph_image'] = f"data:image/png;base64,{graph_base64}"
    else:
        results['graph_image'] = None
    
    return jsonify(results) 

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)