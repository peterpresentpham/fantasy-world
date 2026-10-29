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
          className="border-border bg-muted/60 text-foreground inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
          {formatValue && item.value !== undefined && (
            <span className="text-foreground ml-1 font-medium tabular-nums">
              {formatValue(item.value)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
