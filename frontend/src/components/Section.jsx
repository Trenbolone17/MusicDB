// A titled page section, separated from what's above it by a thin divider.
export default function Section({ title, children }) {
  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
