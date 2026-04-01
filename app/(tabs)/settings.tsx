import Constants from "expo-constants";
import ContentContainer from "@/components/ContentContainer";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";

export default function SettingsScreen() {
  const { invertColors, setInvertColors } = useInvertColors();
  const version = Constants.expoConfig?.version;
  const headerTitle = version ? `Settings (v${version})` : "Settings";

  return (
    <ContentContainer headerTitle={headerTitle} hideBackButton>
      <ToggleSwitch
        label="Invert Colours"
        onValueChange={setInvertColors}
        value={invertColors}
      />
    </ContentContainer>
  );
}
