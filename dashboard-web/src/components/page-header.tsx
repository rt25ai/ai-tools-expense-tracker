import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-white/6 pb-7 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] font-medium tracking-[0.18em] text-cyan-300/75">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
