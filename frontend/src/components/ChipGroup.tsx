interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

export default function ChipGroup<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <fieldset className="group">
      <legend className="cap">{label}</legend>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={option === value ? 'chip on' : 'chip'}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
