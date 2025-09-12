import React from "react";
import { Stack } from "expo-router";

export default function MatchesStackLayout() {
  return (
    <Stack screenOptions={{
      headerShown: true,
      headerTitleStyle: { fontSize: 18, fontWeight: "700" as const },
      headerTintColor: "#333",
      contentStyle: { backgroundColor: "#f5f5f5" },
    }}>
      <Stack.Screen name="index" options={{ title: "Your Matches" }} />
      <Stack.Screen name="[matchId]" options={{ title: "Match Details" }} />
    </Stack>
  );
}
