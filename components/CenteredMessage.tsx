import { StyleSheet, View } from "react-native";
import { StyledText } from "@/components/StyledText";
import { n } from "@/utils/scaling";

interface CenteredMessageProps {
  hint?: string;
  message: string;
}

export function CenteredMessage({ message, hint }: CenteredMessageProps) {
  return (
    <View style={styles.container}>
      <StyledText style={styles.message}>{message}</StyledText>
      {hint && <StyledText style={styles.hint}>{hint}</StyledText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    gap: n(8),
  },
  message: {
    fontSize: n(18),
    textAlign: "center",
  },
  hint: {
    fontSize: n(14),
    textAlign: "center",
  },
});
