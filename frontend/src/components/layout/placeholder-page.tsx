export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
      <p className="text-xs text-slate-500">Connected backend integration will be wired in upcoming slices.</p>
    </section>
  );
}
