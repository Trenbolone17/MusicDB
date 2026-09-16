// A titled page section. By default a thin divider separates it from what's above; pass
// divider={false} when the element above already draws its own line.
export default function Section({ title, divider = true, children }) {
  return (
    <section className={divider ? 'mt-10 border-t border-line pt-6' : 'mt-8'}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
