import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { storedTinyFishCredential } from "@/lib/auth/client";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import {
  type TinyFishApp,
  tinyFishAppHealthUrl,
  tinyFishAppUrl,
} from "@/lib/tinyfish/apps";
import { useTinyFishReachability } from "@/lib/tinyfish/use-reachability";

/**
 * In-app webview for a TinyFish product. With a per-user Sprite the iframe loads
 * TinyBot's authenticated proxy; otherwise a Fly/env URL or the remapped catalog.
 */
export function TinyFishAppFrame({ app }: { app: TinyFishApp }) {
  const { data: currentUser } = useQuery(currentUserQueryOptions());
  const url = tinyFishAppUrl(app, currentUser?.sprite);
  const reachability = useTinyFishReachability(
    tinyFishAppHealthUrl(app, currentUser?.sprite),
  );
  const frameRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Button
          render={<Link to="/" />}
          size="icon-sm"
          variant="ghost"
          aria-label="Back to start"
        >
          <IconArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="font-semibold text-base tracking-tight">
              {app.title}
            </h1>
            <span className="font-mono text-[11px] text-muted-foreground">
              {app.usageId}
            </span>
            {reachability === "offline" ? (
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Unreachable
              </span>
            ) : null}
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {app.oneLiner}
          </p>
        </div>
      </header>
      {reachability === "offline" ? (
        <p
          className="shrink-0 border-b bg-muted/40 px-4 py-2 text-muted-foreground text-sm"
          role="status"
        >
          {app.title} is not answering at {url}. The shell stays open so you can
          retry once the process is up.
        </p>
      ) : null}
      <iframe
        className="min-h-0 w-full flex-1 border-0 bg-background"
        onLoad={() => {
          const token = storedTinyFishCredential();
          const frame = frameRef.current;
          if (!token || !frame?.contentWindow) return;
          try {
            frame.contentWindow.postMessage(
              { type: "tinyfish/credential", token },
              url.startsWith("/")
                ? window.location.origin
                : new URL(url).origin,
            );
          } catch {
            // The product UI keeps its own gates; a refused postMessage does not bypass them.
          }
        }}
        ref={frameRef}
        src={url}
        title={app.title}
      />
    </div>
  );
}
