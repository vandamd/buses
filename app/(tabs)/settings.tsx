import ContentContainer from "@/components/ContentContainer";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";

export default function SettingsScreen() {
  const { invertColors, setInvertColors } = useInvertColors();

  return (
    <ContentContainer headerTitle="Settings" hideBackButton>
      <ToggleSwitch
        label="Invert Colours"
        onValueChange={setInvertColors}
        value={invertColors}
      />
    </ContentContainer>
  );
}
