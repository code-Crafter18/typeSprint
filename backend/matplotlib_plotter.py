import sys
import json
import base64
import io
import argparse
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib.ticker import MaxNLocator

def plot_current_test(data):
    wpm_data = data.get('wpmData', [])
    error_data = data.get('errorData', [])
    
    if not wpm_data:
        return None

    df_wpm = pd.DataFrame(wpm_data)
    if 'time' not in df_wpm or 'wpm' not in df_wpm or df_wpm.empty:
        return None

    fig = Figure(figsize=(10, 5.5), facecolor='#3b3e4c')
    ax1 = fig.add_subplot(111)
    ax1.set_facecolor('#3b3e4c')

    color_wpm = '#a7ff83'
    ax1.set_xlabel('Time (Seconds)', color='white', fontsize=11, labelpad=8)
    ax1.set_ylabel('WPM (Words Per Minute)', color=color_wpm, fontsize=11, labelpad=8)
    
    ax1.plot(df_wpm['time'], df_wpm['wpm'], color=color_wpm, marker='o', linewidth=2.5, markersize=5)
    ax1.tick_params(axis='y', labelcolor=color_wpm, labelsize=10)
    ax1.tick_params(axis='x', colors='white', labelsize=10)
    
    for spine in ax1.spines.values():
        spine.set_edgecolor('#555555')

    max_time = df_wpm['time'].max() if not df_wpm.empty else 1
    min_time = df_wpm['time'].min() if not df_wpm.empty else 1

    if error_data:
        df_errors = pd.DataFrame(error_data)
        if 'time' in df_errors.columns and not df_errors.empty:
            if 'count' not in df_errors.columns:
                df_errors['count'] = 1
            error_counts = df_errors.groupby('time', as_index=False)['count'].sum()
            if not error_counts.empty:
                max_time = max(max_time, error_counts['time'].max())
                ax2 = ax1.twinx()
                color_errors = '#ff6b6b'
                ax2.set_ylabel('Mistakes', color=color_errors, fontsize=11, labelpad=8)
                
                ax2.plot(
                    error_counts['time'],
                    error_counts['count'],
                    color=color_errors,
                    marker='x',
                    linestyle='None',
                    markersize=11,
                    markeredgewidth=2.8
                )
                
                ax2.tick_params(axis='y', labelcolor=color_errors, labelsize=10)
                ax2.set_ylim(bottom=0, top=max(error_counts['count'].max() + 1, 3))
                ax2.yaxis.set_major_locator(MaxNLocator(integer=True))
                
                for spine in ax2.spines.values():
                    spine.set_edgecolor('#555555')

    ax1.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax1.set_xlim(left=max(0, min_time - 0.5), right=max_time + 0.5)
    ax1.set_ylim(bottom=0)
    ax1.set_title('Current Test WPM', color='white', fontsize=14, fontweight='bold', pad=14)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=fig.get_facecolor(), edgecolor='none')
    buf.seek(0)
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close(fig)
    return f"data:image/png;base64,{img_b64}"

def plot_history(data):
    history_records = data.get('history', [])
    if not history_records or len(history_records) < 2:
        return None

    df = pd.DataFrame(history_records)
    if 'wpm' not in df.columns:
        return None

    df = df.reset_index(drop=True)
    df['test_num'] = df.index + 1

    fig = Figure(figsize=(9, 4), dpi=100, facecolor='#3b3e4c')
    ax = fig.add_subplot(111)
    ax.set_facecolor('#3b3e4c')

    color_wpm = '#a7ff83'
    color_trend = '#ffd166'

    ax.plot(df['test_num'], df['wpm'], color=color_wpm, marker='o', markersize=4, linewidth=2, label='Test WPM')
    
    if len(df) >= 3:
        df['rolling_avg'] = df['wpm'].rolling(window=3, min_periods=1).mean()
        ax.plot(df['test_num'], df['rolling_avg'], color=color_trend, linestyle='--', linewidth=1.5, label='Moving Avg (3)')

    ax.set_xlabel('Recent Tests', color='white', fontsize=10)
    ax.set_ylabel('WPM', color=color_wpm, fontsize=10)
    ax.tick_params(colors='white', labelsize=9)
    ax.grid(True, color='#555555', linestyle='--', linewidth=0.7, alpha=0.6)

    for spine in ax.spines.values():
        spine.set_edgecolor('#555555')

    ax.xaxis.set_major_locator(MaxNLocator(nbins=8, integer=True))
    ax.legend(facecolor='#3b3e4c', edgecolor='#555555', labelcolor='white', fontsize=9)
    ax.set_title('Typing Speed Progression Over Time', color='white', fontsize=12, fontweight='bold', pad=10)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
    buf.seek(0)
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close(fig)
    return f"data:image/png;base64,{img_b64}"

def main():
    parser = argparse.ArgumentParser(description='TypeSprint Matplotlib Plotter')
    parser.add_argument('--type', choices=['current', 'history'], default='current')
    args = parser.parse_args()

    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({'success': False, 'image': None, 'error': 'Empty input'}))
            return
        
        payload = json.loads(raw_input)
        if args.type == 'current':
            img = plot_current_test(payload)
        else:
            img = plot_history(payload)

        print(json.dumps({'success': bool(img), 'image': img}))
    except Exception as e:
        print(json.dumps({'success': False, 'image': None, 'error': str(e)}))

if __name__ == '__main__':
    main()
