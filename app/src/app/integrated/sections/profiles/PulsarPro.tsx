// Pulsar Pro protocol (flag `pulsarPro`) — the logic of AdvancedCards
// PulsarProCard: onboard profile 1–6, wheel acceleration and angle tuning, all
// staged through applyProSetting. The six profiles are Profile cards; the two
// "Pro" settings are Setting rows under them.
import type { ReactNode } from "react";
import * as control from "../../../../device/controller";
import type { ControlSnapshot } from "../../../../device/types";
import { t, tp } from "../../../../i18n";
import { Dropdown, ProfileCard, ProfileStat, SectionHeader, SettingGroup, SettingRow, Toggle } from "../../kit";
import { CardGrid, Editor, EditorColumns, fmtDpi, fmtHz } from "./shared";

const PROFILES = [1, 2, 3, 4, 5, 6] as const;
const ANGLES = Array.from({ length: 61 }, (_, index) => index - 30).map((angle) => ({ value: angle, label: `${angle}°` }));

export function PulsarPro({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const status = snapshot.status;
  if (!status) return null;
  const locale = snapshot.preferences.locale;
  const active = status.activeProfile ?? 1;
  const wheel = status.wheelAcceleration;
  return (
    <>
      <CardGrid count={PROFILES.length} label={t(locale, "adv.onboardProfile")}>
        {PROFILES.map((value) => {
          const running = value === active;
          return (
            <ProfileCard key={value} name={tp(locale, "adv.profileOpt", { n: value })} slot={`#${value}`}
              state={running ? "active" : "default"}
              onActivate={running ? undefined : () => control.applyProSetting("profile", value)}>
              {running ? (
                <>
                  {status.dpi > 0 ? <ProfileStat label="DPI" value={fmtDpi(status.dpi)} /> : null}
                  {status.pollingRateHz ? <ProfileStat label="Polling rate" value={fmtHz(status.pollingRateHz)} /> : null}
                  {status.motionSync != null ? <ProfileStat label="Motion sync" value={status.motionSync ? "On" : "Off"} /> : null}
                </>
              ) : <ProfileStat label="Status" value="Stored on the mouse" />}
            </ProfileCard>
          );
        })}
      </CardGrid>
      <Editor label="Pro settings">
        <EditorColumns main={(
          <>
            <SectionHeader title="Pro settings" />
            <SettingGroup>
              {/* PulsarProCard's SwitchRow: unreadable (null) shows the row but can't be changed. */}
              <SettingRow title={t(locale, "adv.wheelAccel")} disabled={wheel == null}
                description={wheel == null ? "Not available on this mouse." : "Scrolls further the faster you spin the wheel."}
                control={(
                  <Toggle ariaLabel={t(locale, "adv.wheelAccel")} value={wheel ?? null} disabled={wheel == null}
                    onChange={(next) => control.applyProSetting("wheelAcceleration", next)} />
                )} />
              <SettingRow title={t(locale, "adv.angleTuning")} description="Rotates the sensor to match your grip."
                control={(
                  <Dropdown ariaLabel={t(locale, "adv.angleTuning")} options={ANGLES} value={status.angleTuning ?? 0}
                    onChange={(angle) => control.applyProSetting("angleTuning", angle)} />
                )} />
            </SettingGroup>
          </>
        )} />
      </Editor>
    </>
  );
}
