import { useState, type ReactNode } from "react";
import * as control from "../device/controller";
import type { ControlSnapshot } from "../device/types";
import { t } from "../i18n";

export function ProfileKeyFields({ snapshot }: { snapshot: ControlSnapshot }): ReactNode {
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const locale = snapshot.preferences.locale;
  const key = snapshot.hasActiveDevice ? control.exportProfileKey() : null;

  return (
    <div className="profile-key-fields">
      <label className="profile-key-field">
        <span>{t(locale, "set.yourKey")}</span>
        <textarea
          readOnly
          rows={3}
          value={key ?? t(locale, "set.noKey")}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        className="connect-button"
        disabled={!key}
        onClick={() => {
          if (!key) return;
          void navigator.clipboard.writeText(key).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? t(locale, "set.copied") : t(locale, "set.copyKey")}
      </button>
      <label className="profile-key-field">
        <span>{t(locale, "set.importKey")}</span>
        <textarea
          rows={3}
          placeholder={t(locale, "set.importPlaceholder")}
          value={importText}
          onChange={(event) => setImportText(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        className="connect-button"
        disabled={!importText.trim() || !snapshot.hasActiveDevice}
        onClick={() => {
          control.importProfileKey(importText);
          setImportText("");
        }}
      >
        {t(locale, "set.import")}
      </button>
      <small className="setting-description">
        {t(locale, "set.importNote")}
      </small>
    </div>
  );
}
