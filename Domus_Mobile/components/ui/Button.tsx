import { Pressable, Text, type PressableProps } from "react-native";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "default" | "outline" | "destructive" | "ghost";
type Size = "default" | "sm" | "lg";

const variantClasses: Record<Variant, string> = {
  default: "bg-financial-trust shadow-sm shadow-financial-trust/30 dark:bg-financial-trustDark",
  outline: "bg-card border border-border dark:bg-cardDark dark:border-borderDark",
  destructive: "bg-financial-danger dark:bg-financial-dangerDark",
  ghost: "bg-transparent",
};

const variantTextClasses: Record<Variant, string> = {
  default: "text-white",
  outline: "text-cardForeground dark:text-cardForegroundDark",
  destructive: "text-white",
  ghost: "text-cardForeground dark:text-cardForegroundDark",
};

const sizeClasses: Record<Size, string> = {
  default: "h-12 px-4",
  sm: "h-10 px-3",
  lg: "h-14 px-6",
};

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: Variant;
  size?: Size;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "default",
  size = "default",
  className,
  textClassName,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-xl active:opacity-80",
        variantClasses[variant],
        sizeClasses[size],
        Boolean(disabled) && "opacity-50",
        className,
      )}
      {...props}
      android_ripple={{ color: "#ffffff22" }}
    >
      {typeof children === "string" ? (
        <Text className={cn("text-base font-semibold", variantTextClasses[variant], textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
