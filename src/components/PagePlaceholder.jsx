export default function PagePlaceholder({
  icon: Icon,
  title,
  description,
  taskLabel,
}) {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-floral-50 text-floral-600">
        <Icon className="h-7 w-7" />
      </span>

      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>

      <span className="mt-6 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        {taskLabel}
      </span>
    </section>
  );
}
