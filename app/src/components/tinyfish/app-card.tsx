import { Link } from "@tanstack/react-router";
import type { SpriteStatus } from "@/lib/auth/queries";
import {
  type TinyFishApp,
  tinyFishAppPath,
  tinyFishAppUrl,
} from "@/lib/tinyfish/apps";
import { useTinyFishReachability } from "@/lib/tinyfish/use-reachability";

export function TinyFishAppCard({
  app,
  sprite,
}: {
  app: TinyFishApp;
  sprite?: SpriteStatus;
}) {
  const url = tinyFishAppUrl(app, sprite);
  const reachability = useTinyFishReachability(url);

  return (
    <Link
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      params={{ product: app.slug }}
      to="/apps/$product"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-base tracking-tight">{app.title}</h3>
        {reachability === "offline" ? (
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
            Unreachable
          </span>
        ) : null}
      </div>
      <p className="mt-2 flex-1 text-pretty text-muted-foreground text-sm leading-relaxed">
        {app.oneLiner}
      </p>
      <span className="mt-4 font-mono text-[11px] text-muted-foreground/70">
        {app.usageId}
      </span>
      <span className="sr-only">
        Opens {app.title} at {tinyFishAppPath(app)}
      </span>
    </Link>
  );
}
