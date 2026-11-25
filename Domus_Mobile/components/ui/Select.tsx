import { useState } from "react";
import { Text, Pressable, Modal, FlatList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onValueChange, options, placeholder = "Selecionar", className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={cn(
          "h-12 w-full flex-row items-center justify-between rounded-xl border border-border bg-card px-3.5 active:opacity-80 dark:border-borderDark dark:bg-cardDark",
          className,
        )}
      >
        <Text
          className={
            selected
              ? "text-base text-cardForeground dark:text-cardForegroundDark"
              : "text-base text-mutedForeground dark:text-mutedForegroundDark"
          }
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#94a3b8" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setOpen(false)}
        >
          <Pressable className="max-h-[70%] rounded-t-3xl bg-card px-3 pb-8 pt-3 dark:bg-cardDark" onPress={(e) => e.stopPropagation()}>
            <View className="mb-3 items-center"><View className="h-1.5 w-10 rounded-full bg-border dark:bg-borderDark" /></View>
            <Text className="mb-2 px-2 text-base font-semibold text-cardForeground dark:text-cardForegroundDark">{placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex-row items-center justify-between rounded-xl px-4 py-4",
                    item.value === value && "bg-financial-trustLight dark:bg-financial-trustLightDark",
                  )}
                >
                  <Text className="text-base text-cardForeground dark:text-cardForegroundDark">
                    {item.label}
                  </Text>
                  {item.value === value && <Ionicons name="checkmark" size={20} color="#3b82f6" />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
