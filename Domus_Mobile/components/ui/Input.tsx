import { TextInput, type TextInputProps } from "react-native";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-card px-3.5 text-base text-cardForeground focus:border-financial-trust dark:border-borderDark dark:bg-cardDark dark:text-cardForegroundDark",
        className,
      )}
      {...props}
    />
  );
}
