'use client';

type TTagItem = {
  label: string;
  color: string;
  value?: number;
};

type TProps = {
  items: TTagItem[];
  formatValue?: (value: number) => string;
};

export default function ChartTagList({ items, formatValue }: TProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-900/45 px-2 py-0.5 text-[11px] text-slate-200"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
          {formatValue && item.value !== undefined && (
            <span className="ml-1 font-medium text-slate-100 tabular-nums">
              {formatValue(item.value)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
