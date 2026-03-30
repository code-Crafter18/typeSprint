import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib.ticker import MaxNLocator
import io

def create_graph(wpm_data, error_data):
    if not wpm_data:
        return None

    df_wpm = pd.DataFrame(wpm_data)
    if 'time' not in df_wpm or 'wpm' not in df_wpm:
        return None

    fig = Figure(figsize=(10, 6), facecolor='#3b3e4c')
    ax1 = fig.add_subplot(111)
    
    ax1.set_facecolor('#3b3e4c')

    color_wpm = '#a7ff83'
    ax1.set_xlabel('Time (Seconds)', color='white') 
    ax1.set_ylabel('WPM (Words Per Minute)', color=color_wpm)
    
    ax1.plot(df_wpm['time'], df_wpm['wpm'], color=color_wpm, marker='o') 
    
    ax1.tick_params(axis='y', labelcolor=color_wpm)
    ax1.tick_params(axis='x', colors='white')
    
    for spine in ax1.spines.values():
        spine.set_edgecolor('#555555')
    
    ax1.xaxis.set_major_locator(MaxNLocator(integer=True))
    
    if error_data:
        df_errors = pd.DataFrame(error_data)
        
        if 'time' in df_errors.columns:
            error_counts = df_errors.groupby('time').size().reset_index(name='count')

            if not error_counts.empty:
                ax2 = ax1.twinx()
                color_errors = '#ff6b6b'
                ax2.set_ylabel('Mistakes', color=color_errors)
                
                ax2.plot(error_counts['time'], error_counts['count'], color=color_errors, marker='x', linestyle='None')
                
                ax2.tick_params(axis='y', labelcolor=color_errors)

                ax2.set_ylim(bottom=0) 
                ax2.yaxis.set_major_locator(MaxNLocator(integer=True))
                
                for spine in ax2.spines.values():
                    spine.set_edgecolor('#555555')

    ax1.set_title('Current Test WPM', color='white')
    fig.tight_layout()
    
    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    buf.seek(0)
    plt.close(fig)

    return buf