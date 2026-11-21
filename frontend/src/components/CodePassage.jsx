import React, { useLayoutEffect, useRef } from "react";

export function CodePassage({ source, typed }) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const lines = source.split("\n");
  const typedLines = typed.split("\n");
  const activeIndex = typedLines.length - 1;

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    if (active.offsetTop < container.scrollTop ||
        active.offsetTop + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = Math.max(0, active.offsetTop - active.offsetHeight);
    }
  }, [activeIndex, source, typed.length]);

  return (
    <div className="code-scroll" aria-hidden="true" ref={scrollRef}>
      {lines.map((line, index) => {
        const isActive = index === activeIndex;
        const content = line.trimStart().trimEnd();
        const indentation = line.slice(0, line.length - line.trimStart().length);
        const characters = Array.from(content);
        const entered = Array.from(typedLines[index] ?? "");

        return (
          <div key={index} className={isActive ? "code-line active-code-line" : "code-line"}
            ref={isActive ? activeRef : null}>
            <span className="code-line-number">{index + 1}</span>
            <span className="code-line-text">
              {indentation}
              {characters.map((character, column) => {
                const value = entered[column];
                const status = value === undefined ? "untyped" : value === character ? "correct" : "incorrect";
                return (
                  <span key={column} className={"char-span " + status}>
                    {isActive && column === entered.length && <span className="caret-cursor" />}
                    {character}
                  </span>
                );
              })}
              {isActive && entered.length >= characters.length && <span className="caret-cursor end-caret" />}
              {isActive && index < lines.length - 1 &&
                entered.length >= characters.length && <span className="code-return">↵</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
