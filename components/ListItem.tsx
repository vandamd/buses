import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { n } from "@/utils/scaling";

interface ListItemProps {
  onPress: () => void;
  primaryText: string | ReactNode;
  secondaryText: string;
}

export const ListItem = memo(function ListItem({
  primaryText,
  secondaryText,
  onPress,
}: ListItemProps) {
  return (
    <HapticPressable onPress={onPress} style={styles.container}>
      <View style={styles.textContainer}>
        {typeof primaryText === "string" ? (
          <StyledText numberOfLines={1} style={styles.primaryText}>
            {primaryText}
          </StyledText>
        ) : (
          <View style={styles.primaryRow}>{primaryText}</View>
        )}
        <StyledText numberOfLines={1} style={styles.secondaryText}>
          {secondaryText}
        </StyledText>
      </View>
    </HapticPressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minHeight: n(50),
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    paddingRight: n(10),
  },
  primaryText: {
    fontSize: n(26),
  },
  primaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  secondaryText: {
    fontSize: n(16),
    lineHeight: n(18),
    paddingBottom: n(6),
  },
});
