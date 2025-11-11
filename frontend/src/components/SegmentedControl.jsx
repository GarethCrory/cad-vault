import React, { useRef } from "react";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  className = "",
  variant = "outline",
}) {
  const tabRefs = useRef([]);

  function getIndex() {
    const idx = options.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  }

  function commitSelection(nextIndex, focus = false) {
    if (nextIndex < 0 || nextIndex >= options.length) return;
    const next = options[nextIndex];
    if (!next) return;
    if (focus) {
      tabRefs.current[nextIndex]?.focus();
    }
    if (next.value !== value) {
      onChange?.(next.value);
    }
  }

  function handleKeyDown(event) {
    const current = getIndex();
    if (event.key === "ArrowRight") {
      event.preventDefault();
      commitSelection(Math.min(current + 1, options.length - 1), true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      commitSelection(Math.max(current - 1, 0), true);
    } else if (event.key === "Home") {
      event.preventDefault();
      commitSelection(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      commitSelection(options.length - 1, true);
    }
  }

  const containerClass = [
    "seg-control",
    variant === "filled" ? "seg-control--filled" : "seg-control--outline",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="tablist" className={containerClass} onKeyDown={handleKeyDown}>
      {options.map((opt, index) => {
        const active = opt.value === value;
        const buttonClass = [
          "seg-control__btn",
          active ? "is-active" : "",
          active && variant === "filled" ? "is-filled" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={buttonClass}
            ref={(el) => (tabRefs.current[index] = el)}
            onClick={() => commitSelection(index)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
