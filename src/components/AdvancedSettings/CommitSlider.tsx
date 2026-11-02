import { useEffect, useId, useState } from 'react';

type TProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  lowLabel: string;
  highLabel: string;
  /** shown next to the label; defaults to the number */
  format?: (value: number) => string;
  /** bump to drop an uncommitted drag, e.g. after a reset */
  resetKey?: number;
  onCommit: (value: number) => void;
};

/** Regenerating is slow, so the value is only committed when the thumb is released. */
export default function CommitSlider({
  label,
  value,
  min,
  max,
  step,
  lowLabel,
  highLabel,
  format,
  resetKey,
  onCommit,
}: TProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, resetKey]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <label htmlFor={id} className="fantasy-text-muted">
          {label}
        </label>
        <span>{format ? format(draft) : draft}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        className="accent-primary w-full"
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <div className="fantasy-text-muted flex justify-between text-[11px]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
