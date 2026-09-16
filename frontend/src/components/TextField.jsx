// Labelled input with an optional hint, replaced by the error message when there is one.
export default function TextField({ label, name, error, hint, ...inputProps }) {
  const id = `field-${name}`;
  const noteId = `${id}-note`;
  const note = error || hint;

  return (
    <div>
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={note ? noteId : undefined}
        className={`mt-1 block w-full border bg-transparent px-3 py-2 outline-none focus:border-accent ${
          error ? 'border-danger' : 'border-line'
        }`}
        {...inputProps}
      />
      {note && (
        <p id={noteId} className={`mt-1 text-xs ${error ? 'text-danger' : 'text-muted'}`}>
          {note}
        </p>
      )}
    </div>
  );
}
