import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MenuRowProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  backgroundClassName?: string;
}

export function MenuRow({
  title,
  description,
  icon,
  onPress,
  color = "#3b82f6",
  backgroundClassName = "bg-financial-trustLight dark:bg-financial-trustLightDark",
}: MenuRowProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-xl p-3 active:bg-slate-50 dark:active:bg-slate-800">
      <View className={`h-11 w-11 items-center justify-center rounded-xl ${backgroundClassName}`}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">{title}</Text>
        <Text className="mt-0.5 text-xs text-mutedForeground dark:text-mutedForegroundDark">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}
