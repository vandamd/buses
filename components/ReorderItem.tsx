import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface ReorderItemProps {
  isFirst?: boolean;
  isLast?: boolean;
  label: string;
  onMoveDown: () => void;
  onMoveUp: () => void;
}

export function ReorderItem({
  label,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}: ReorderItemProps) {
  const { invertColors } = useInvertColors();
  const iconColor = invertColors ? "black" : "white";
  const disabledColor = invertColors ? "#C1C1C1" : "#6E6E6E";

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <StyledText numberOfLines={1} style={styles.label}>
          {label}
        </StyledText>
      </View>
      <View style={styles.arrowContainer}>
        <HapticPressable
          disabled={isLast}
          onPress={onMoveDown}
          style={styles.arrowButton}
        >
          <MaterialIcons
            color={isLast ? disabledColor : iconColor}
            name="keyboard-arrow-down"
            size={n(32)}
          />
        </HapticPressable>
        <HapticPressable
          disabled={isFirst}
          onPress={onMoveUp}
          style={styles.arrowButton}
        >
          <MaterialIcons
            color={isFirst ? disabledColor : iconColor}
            name="keyboard-arrow-up"
            size={n(32)}
          />
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: n(50),
    width: "100%",
  },
  labelContainer: {
    flex: 1,
    paddingRight: n(10),
  },
  label: {
    fontSize: n(26),
  },
  arrowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: n(4),
  },
  arrowButton: {
    padding: n(4),
  },
});
