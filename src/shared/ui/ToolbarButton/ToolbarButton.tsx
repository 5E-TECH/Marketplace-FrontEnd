import { Button } from 'antd';
import type { ComponentProps } from 'react';

type ToolbarButtonProps = ComponentProps<typeof Button>;

export function ToolbarButton({ children, ...props }: ToolbarButtonProps) {
  return <Button {...props}>{children}</Button>;
}
