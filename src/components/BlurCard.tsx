import { ComponentProps, ReactNode } from 'react';
import { cn } from 'src/lib/utils';

interface TProps extends ComponentProps<'section'> {
  title: string;
  titleComponent?: ReactNode;
  containerProps?: ComponentProps<'div'>;
}

export default function BlurCard({ title, titleComponent, containerProps, ...props }: TProps) {
  return (
    <section {...props} className={cn('fantasy-glass rounded-lg p-3', props.className)}>
      <div className="flex items-center justify-between">
        <h4 className="fantasy-text-muted text-xs font-semibold tracking-wide uppercase">
          {title}
        </h4>
        {titleComponent}
      </div>
      <div {...containerProps} className={cn('mt-2', containerProps?.className)}>
        {props.children}
      </div>
    </section>
  );
}
