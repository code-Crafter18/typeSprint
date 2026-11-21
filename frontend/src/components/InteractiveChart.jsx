import React, { useState } from "react";

export function InteractiveChart({ wpmData = [], errorData = [], avgWpm = 0, totalTime = 0 }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const chartData = wpmData.length ? wpmData : [{ time: totalTime, wpm: avgWpm }];

  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 35, bottom: 40, left: 45 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const minTime = 0;
  const maxTime = Math.max(...chartData.map((d) => d.time), minTime + 1);
  const timeSpan = Math.max(maxTime - minTime, 1);

  const rawMaxWpm = Math.max(...chartData.map((d) => d.wpm), 20);
  const maxWpm = Math.ceil(rawMaxWpm / 10) * 10;

  // Map data to SVG coordinates
  const points = chartData.map((d) => {
    const x = padding.left + ((d.time - minTime) / timeSpan) * innerWidth;
    const y = padding.top + innerHeight - (d.wpm / maxWpm) * innerHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  // Area under line
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
      : "";

  // Group errors by time
  const errorMap = {};
  if (Array.isArray(errorData)) {
    errorData.forEach((err) => {
      const t = err.time;
      if (t !== undefined) {
        errorMap[t] = (errorMap[t] || 0) + (err.count ?? 1);
      }
    });
  }

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "800px", margin: "0 auto" }}>
      <svg
        role="img"
        aria-label="Typing speed and mistakes over time"
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2b714" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#e2b714" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const yVal = padding.top + innerHeight * (1 - pct);
          const wpmLabel = Math.round(maxWpm * pct);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={yVal}
                x2={padding.left + innerWidth}
                y2={yVal}
                stroke="#2a2e39"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={yVal + 4}
                fill="#646b7a"
                fontSize="11"
                fontFamily="'JetBrains Mono', monospace"
                textAnchor="end"
              >
                {wpmLabel}
              </text>
            </g>
          );
        })}

        {/* Shaded Area fill */}
        <path d={areaD} fill="url(#wpmGradient)" />

        {/* WPM Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#e2b714"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glowEffect)"
        />

        {/* Mistake markers */}
        {Object.entries(errorMap).map(([timeStr, count]) => {
          const t = Number(timeStr);
          const pt = points.find((p) => p.time === t) || {
            x: padding.left + ((t - minTime) / timeSpan) * innerWidth,
            y: padding.top + innerHeight - 20,
          };
          return (
            <g key={timeStr} transform={`translate(${pt.x}, ${pt.y})`}>
              <circle r="4" fill="#f87171" />
              <text
                y="-8"
                fill="#f87171"
                fontSize="10"
                fontWeight="bold"
                fontFamily="'JetBrains Mono', monospace"
                textAnchor="middle"
              >
                ✕{count > 1 ? count : ""}
              </text>
            </g>
          );
        })}

        {/* Data points */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={hoverIndex === i ? 6 : 4}
            fill="#181a20"
            stroke="#e2b714"
            strokeWidth={hoverIndex === i ? 3 : 2}
            style={{ cursor: "pointer", transition: "all 0.15s ease" }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}

        {/* Hover Guide line */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padding.top}
            x2={activePoint.x}
            y2={padding.top + innerHeight}
            stroke="#646b7a"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* X Axis Time Labels */}
        {points.map((pt, i) => {
          const step = Math.max(1, Math.floor(points.length / 6));
          if (i % step !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={pt.x}
              y={padding.top + innerHeight + 20}
              fill="#646b7a"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {pt.time}s
            </text>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {activePoint && (
        <div
          style={{
            position: "absolute",
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
            transform: "translate(-50%, -125%)",
            background: "#21242e",
            border: "1px solid #3d4352",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#e2b714",
            pointerEvents: "none",
            boxShadow: "0 8px 16px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
            zIndex: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ fontWeight: "bold" }}>{activePoint.wpm} WPM</div>
          <div style={{ color: "#9ca3af", fontSize: "11px" }}>
            Time: {activePoint.time}s
            {errorMap[activePoint.time] ? ` • ${errorMap[activePoint.time]} error(s)` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveChart;
