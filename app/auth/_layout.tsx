import { Slot } from "expo-router";
import { View } from "@gluestack-ui/themed";
import { ScrollView } from "@/components/ui/scroll-view";
import { Center } from "@/components/ui/center";

export default function AuthLayout() {
  return (
    <View className="h-screen w-screen bg-white" nativeID="auth-root">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Center className="min-h-screen w-screen items-center justify-center p-4">
          <Slot />
        </Center>
      </ScrollView>
    </View>
  );
}
