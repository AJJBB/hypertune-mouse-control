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
import { isIntegratedMode } from "../app-mode";
import { DeviceGrid } from "./integrated/DeviceGrid";
import { DeviceDetail } from "./integrated/DeviceDetail";
import { ConnectNoticeDialog } from "./integrated/ConnectNoticeDialog";
import { ToolsHub } from "./integrated/ToolsHub";

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
  // ?hub=1 renders the Tools landing in front of the Mouse Control pane (in the
  // real shell the native app draws this and opens us into Mouse Tools).
  const [showHub, setShowHub] = useState(() => {
    try { return new URLSearchParams(window.location.search).has("hub"); } catch { return false; }
  });
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

  const dialogs = (
    <>
      <ArtworkRequestDialog open={artworkReqOpen} onClose={() => setArtworkReqOpen(false)} locale={locale} deviceName={artworkDeviceName} />
      <ReportProblemDialog open={snapshot.reportProblemOpen} onClose={() => control.closeReportProblem()} deviceName={snapshot.status?.name ?? ""} />
      <ShareProfileDialog open={shareProfileOpen} onClose={() => setShareProfileOpen(false)} snapshot={snapshot} />
      <ToastHost toasts={snapshot.toasts} locale={locale} />
    </>
  );

  // Integrated mode (native HyperTune shell, ?app=1): content pane only — the
  // native app draws the window, sidebar and "Tools / Mouse Control" breadcrumb.
  if (isIntegratedMode()) {
    return (
      <div className="htv2-root" data-interface-theme={interfaceThemeSlug(preferences.theme)}>
        {showHub ? (
          <div className="htv2-content"><ToolsHub snapshot={snapshot} onOpenMouse={() => setShowHub(false)} /></div>
        ) : snapshot.deviceView === "device" && snapshot.status !== null ? (
          <div className="htv2-content"><DeviceDetail snapshot={snapshot} onShareProfile={() => setShareProfileOpen(true)} /></div>
        ) : (
          <div className="htv2-content"><DeviceGrid snapshot={snapshot} /></div>
        )}
        <PendingBar snapshot={snapshot} />
        <ConnectNoticeDialog
          variant="razer-web"
          open={snapshot.razerWebNoticeOpen}
          onClose={() => control.closeRazerWebNotice()}
        />
        <ConnectNoticeDialog
          variant="error"
          open={snapshot.connectErrorOpen}
          onClose={() => control.closeConnectError()}
          onRetry={() => { control.closeConnectError(); void control.connect(); }}
        />
        {dialogs}
      </div>
    );
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

      <RazerWebNoticeDialog open={snapshot.razerWebNoticeOpen} onClose={() => control.closeRazerWebNotice()} />
      {dialogs}
    </div>
  );
}
