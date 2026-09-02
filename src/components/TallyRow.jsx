import React from 'react'

/**
 * TallyRow — one square per physical garment.
 *
 * The shop is marking real objects on a table, not editing a number.
 * Ten blouses means ten squares. Tap the third and three are done.
 * Tap a filled square to undo back to it.
 *
 * Above 14 pieces the squares stop being tappable targets on a phone,
 * so it falls back to a stepper.
 */
export default function TallyRow({ qty, completed, onChange, disabled }) {
  const done = Math.max(0, Math.min(completed, qty))

  if (qty > 14) {
    return (
      <div className="tally-stepper">
        <button
          type="button"
          className="step-btn"
          onClick={() => onChange(Math.max(0, done - 1))}
          disabled={disabled || done === 0}
          aria-label="One less finished"
        >&minus;</button>
        <span className="step-count">
          <strong>{done}</strong> of {qty} done
        </span>
        <button
          type="button"
          className="step-btn"
          onClick={() => onChange(Math.min(qty, done + 1))}
          disabled={disabled || done === qty}
          aria-label="One more finished"
        >+</button>
      </div>
    )
  }

  return (
    <div
      className="tally"
      role="group"
      aria-label={`${done} of ${qty} finished`}
    >
      {Array.from({ length: qty }).map((_, i) => {
        const filled = i < done
        return (
          <button
            key={i}
            type="button"
            className={`tally-sq ${filled ? 'on' : ''}`}
            disabled={disabled}
            aria-pressed={filled}
            aria-label={`Piece ${i + 1}${filled ? ', finished' : ', not finished'}`}
            onClick={() => onChange(filled && i + 1 === done ? i : i + 1)}
          >
            <span className="tally-mark" aria-hidden="true" />
          </button>
        )
      })}
      <span className="tally-count">
        {done}/{qty}
      </span>
    </div>
  )
}
