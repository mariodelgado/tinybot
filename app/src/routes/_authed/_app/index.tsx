import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AgentCard } from "@/components/agents/agent-card";
import { Composer, toAgentOptions } from "@/components/channels/composer";
import { StaggerItem } from "@/components/layout/stagger";
import { TinyFishAppCard } from "@/components/tinyfish/app-card";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { useStartChannel } from "@/lib/channels/start";
import { appConfig } from "@/lib/generated/application-config";
import {
  composerFallbackAgent,
  exploreTinyFishAgents,
} from "@/lib/tinyfish/agents";
import { TINYFISH_APPS } from "@/lib/tinyfish/apps";

export const Route = createFileRoute("/_authed/_app/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: agents } = useQuery(agentListQueryOptions());
  const { data: currentUser } = useQuery(currentUserQueryOptions());
  const explore = exploreTinyFishAgents(agents);
  const { start, pending } = useStartChannel();
  const [error, setError] = useState<string | null>(null);

  /** TinyPipe first, then the other TinyFish products in start order. */
  const fallback = composerFallbackAgent(agents);

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10">
        <div className="flex flex-col items-center">
          <h2 className="text-sm uppercase text-muted-foreground font-medium tracking-tight text-center">
            {appConfig.brand.productName}
          </h2>
          <h1 className="text-2xl font-bold tracking-tight mt-1.5 text-center">
            TinyFish products
          </h1>
          {currentUser?.sprite ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Sprite {currentUser.sprite.name} · {currentUser.sprite.status}
            </p>
          ) : null}
        </div>
        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TINYFISH_APPS.map((app, index) => (
            <StaggerItem className="h-full" key={app.usageId} index={index}>
              <TinyFishAppCard app={app} sprite={currentUser?.sprite} />
            </StaggerItem>
          ))}
        </div>
        <div className="mt-14 flex w-full flex-col items-center">
          <h2 className="text-2xl font-bold tracking-tight text-center">
            Start a new channel
          </h2>
          <Composer
            agents={toAgentOptions(agents)}
            className="mt-6 w-full max-w-2xl"
            disabled={!fallback}
            onSubmit={async (draft) => {
              // A channel is pinned to one coworker for the life of its thread.
              const agentId = draft.agentId ?? fallback?.id;
              if (!agentId) return;

              setError(null);
              try {
                await start(agentId, draft.text);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not start the conversation.",
                );
                throw caught;
              }
            }}
            pending={pending}
          />
          {fallback ? (
            // Said out loud: a message that silently reaches somebody you did not choose is the
            // kind of surprise that costs trust the first time it happens.
            <p className="mt-2 w-full max-w-2xl text-xs text-muted-foreground text-center">
              Goes to {fallback.name}. Type <code>@</code> to reach somebody
              else.
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-2 w-full max-w-2xl text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-10 w-full max-w-2xl">
          <h2 className="font-bold text-lg">Explore agents</h2>
          <div className="flex flex-row gap-4 mt-4">
            {!!explore?.length &&
              explore.map((agent) => (
                <Link
                  key={agent.id}
                  to="/channel/new"
                  search={{
                    agent: agent.id,
                  }}
                >
                  <AgentCard agent={agent} />
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
