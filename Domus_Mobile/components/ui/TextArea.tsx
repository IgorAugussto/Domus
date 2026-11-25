import { TextInput, type TextInputProps } from "react-native";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextInputProps & { className?: string; rows?: number }) {
  return (
    <TextInput
      multiline
      numberOfLines={rows}
      textAlignVertical="top"
      placeholderTextColor="#94a3b8"
      className={cn(
        "w-full rounded-xl border border-border bg-card px-3.5 py-3 text-base text-cardForeground focus:border-financial-trust dark:border-borderDark dark:bg-cardDark dark:text-cardForegroundDark",
        className,
      )}
      style={{ minHeight: rows * 20 + 16 }}
      {...props}
    />
  );
}
