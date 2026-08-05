import { Eye as EyeOutlined, EyeOff as EyeInvisibleOutlined } from 'lucide-react';
import { Input } from 'antd';
import type { ComponentProps } from 'react';

type PasswordInputProps = ComponentProps<typeof Input.Password>;

export function PasswordInput(props: PasswordInputProps) {
  return (
    <Input.Password
      {...props}
      iconRender={(visible) =>
        visible ? (
          <span title="Parolni yashirish">
            <EyeOutlined aria-hidden />
          </span>
        ) : (
          <span title="Parolni ko‘rsatish">
            <EyeInvisibleOutlined aria-hidden />
          </span>
        )
      }
    />
  );
}
