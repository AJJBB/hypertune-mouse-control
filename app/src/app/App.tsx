import { useEffect, useState, type ReactNode } from "react";
import * as control from "../device/controller";
import { interfaceThemeSlug } from "../interface-preferences";
import { ArtworkRequestDialog } from "./ArtworkRequestDialog";
import { OverviewPage } from "./OverviewPage";
import { PendingBar } from "./PendingBar";
import { RazerWebNoticeDialog } from "./RazerWebNoticeDialog";
import { ReportProblemDialog } from "./ReportProblemDialog";
import { ShareProfileDialog } from "./ShareProfileDialog";
import { ToastHost } from "./Toasts";
import { useControl } from "./useControl";

/** This renders as a single embeddable panel — a "Mouse" tab's worth of
    content, sections included — not a standalone app shell. It brings no
    outer app nav, chat widget, remote news banner, or interface-preferences
    settings page of its own; whatever hosts it (Hypertune) already has
    those, including its own theme/settings surface. */
export function App(): ReactNode {
  const snapshot = useControl();
  const [shareProfileOpen, setShareProfileOpen] = useState(false);
  const [artworkReqOpen, setArtworkReqOpen] = useState(false);
  const [artworkDeviceName, setArtworkDeviceName] = useState("");
  const { preferences, status } = snapshot;
  const locale = preferences.locale;

  useEffect(() => {
    try {
      if (document.documentElement.lang !== "en") document.documentElement.lang = "en";
    } catch {
      /* non-DOM environment (tests) */
    }
  }, [locale]);

  function openArtworkRequest(): void {
    if (snapshot.status?.name) setArtworkDeviceName(snapshot.status.name);
    setArtworkReqOpen(true);
  }

  return (
    <div
      className={[
        "control-shell",
        "ht-shell",
        status ? "" : "is-empty",
        preferences.reducedMotion ? "reduce-interface-motion" : "",
        snapshot.pending.count > 0 ? "has-pending-changes" : "",
      ].filter(Boolean).join(" ")}
      data-interface-theme={interfaceThemeSlug(preferences.theme)}
    >
      <OverviewPage
        snapshot={snapshot}
        onShareProfile={() => setShareProfileOpen(true)}
        onRequestArtwork={openArtworkRequest}
      />
      <PendingBar snapshot={snapshot} />
      <p className="app-live-region" role="status" aria-live="polite">
        {snapshot.readStatus}
      </p>

      <ArtworkRequestDialog open={artworkReqOpen} onClose={() => setArtworkReqOpen(false)} locale={locale} deviceName={artworkDeviceName} />
      <ReportProblemDialog open={snapshot.reportProblemOpen} onClose={() => control.closeReportProblem()} deviceName={snapshot.status?.name ?? ""} />
      <RazerWebNoticeDialog open={snapshot.razerWebNoticeOpen} onClose={() => control.closeRazerWebNotice()} />
      <ShareProfileDialog open={shareProfileOpen} onClose={() => setShareProfileOpen(false)} snapshot={snapshot} />
      <ToastHost toasts={snapshot.toasts} locale={locale} />
    </div>
  );
}
