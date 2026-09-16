// The primary action button: the one place the green accent fills a surface.
export default function Button({ className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`cursor-pointer bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
