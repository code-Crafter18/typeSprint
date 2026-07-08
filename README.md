# TypeSprint

A typing test platform that measures typing speed (WPM), accuracy, and errors, with detailed performance feedback and progress visualization over time.

## Features
- Real-time typing test with WPM, accuracy, and error tracking
- Detailed post-test performance feedback
- Typing history tracking
- Visualized progress over time using Pandas and Matplotlib

## Tech Stack
- **Frontend:** React.js, CSS, HTML
- **Backend:** Python, Flask
- **Data & Visualization:** Pandas, Matplotlib

Project Structure
-backend/ – Flask server, typing test logic, history tracking, Pandas/Matplotlib visualizations
-frontend/ – React application (typing test UI)

## How It Works
1. The user starts a typing test on the React frontend, typing out a given passage.
2. As they type, WPM, accuracy, and errors are calculated in real time.
3. Results are sent to the Flask backend, which logs the session using Pandas.
4. Matplotlib is used to generate visualizations of typing progress across past sessions.
