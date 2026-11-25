import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  backgroundClassName?: string;
}

export function ScreenHeader({
  title,
  subtitle,
  icon,
  color = "#3b82f6",
  backgroundClassName = "bg-financial-trustLight dark:bg-financial-trustLightDark",
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${backgroundClassName}`}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-2xl font-bold tracking-tight text-cardForeground dark:text-cardForegroundDark">{title}</Text>
        {subtitle && <Text className="mt-0.5 text-sm text-mutedForeground dark:text-mutedForegroundDark">{subtitle}</Text>}
      </View>
    </View>
  );
}
