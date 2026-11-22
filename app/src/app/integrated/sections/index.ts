// Registry: integrated tab id → its section component.
import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
import type { SectionId } from "./flags";
import { OverviewSection } from "./OverviewSection";
import { PerformanceSection } from "./PerformanceSection";
import { LightingSection } from "./LightingSection";
import { ButtonsSection } from "./ButtonsSection";
import { ProfilesSection } from "./ProfilesSection";
import { AdvancedSection } from "./AdvancedSection";
import { MouseTestSection } from "./MouseTestSection";

export interface SectionProps { snapshot: ControlSnapshot; onShareProfile?: () => void }

export const SECTIONS: Record<SectionId, (props: SectionProps) => ReactNode> = {
  overview: OverviewSection,
  performance: PerformanceSection,
  lighting: LightingSection,
  buttons: ButtonsSection,
  profiles: ProfilesSection,
  advanced: AdvancedSection,
  test: MouseTestSection,
};
export { SECTION_ORDER, SECTION_FLAGS, sectionVisible, type SectionId } from "./flags";
