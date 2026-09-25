'use client';

import { ListIcon, Table2Icon } from 'lucide-react';
import { Button } from 'src/components/ui/button';
import { ButtonGroup } from 'src/components/ui/button-group';

type TProps<TKey extends string> = {
  options: { key: TKey; label: string }[];
  activeKey: TKey;
  onSelect: (key: TKey) => void;
  showData: boolean;
  onToggleData: () => void;
};

export default function ChartToolbar<TKey extends string>({
  options,
  activeKey,
  onSelect,
  showData,
  onToggleData,
}: TProps<TKey>) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ButtonGroup className="max-w-full flex-wrap justify-center">
        {options.map((opt) => (
          <Button
            key={opt.key}
            size="xs"
            variant={activeKey === opt.key ? 'default' : 'ghost'}
            onClick={() => onSelect(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </ButtonGroup>
      <Button
        size="xs"
        variant="ghost"
        onClick={onToggleData}
        className={showData ? 'text-sky-300' : ''}
      >
        {showData ? <Table2Icon className="size-3.5" /> : <ListIcon className="size-3.5" />}
      </Button>
    </div>
  );
}
