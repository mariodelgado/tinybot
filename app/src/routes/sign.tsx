import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { type FormEvent, useState } from "react";
import AgentOrb from "@/components/agents/orb/agent-orb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithGoogle, signInWithTinyFish } from "@/lib/auth/client";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { appConfig } from "@/lib/generated/application-config";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const ENTRANCE_SECONDS = 0.4;
const ENTRANCE_STAGGER_SECONDS = 0.08;
const ENTRANCE_OFFSET = "translateY(12px)";

export const Route = createFileRoute("/sign")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    );
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: SignScreen,
});

function SignScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tinyFishToken, setTinyFishToken] = useState("");
  const showGoogle = appConfig.auth.providers.includes("google");
  const showTinyFish = appConfig.auth.providers.includes("tinyfish");

  async function handleGoogleSignIn() {
    setError(null);
    setIsPending(true);

    try {
      await signInWithGoogle();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not start Google sign-in.",
      );
      setIsPending(false);
    }
  }

  async function handleTinyFishSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await signInWithTinyFish(tinyFishToken);
      await queryClient.invalidateQueries(currentUserQueryOptions());
      await navigate({ to: "/" });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not sign in with TinyFish.",
      );
      setIsPending(false);
    }
  }

  const prefersReducedMotion = useReducedMotion();
  const hidden = {
    opacity: 0,
    ...(prefersReducedMotion ? {} : { transform: ENTRANCE_OFFSET }),
  };
  const shown = {
    opacity: 1,
    ...(prefersReducedMotion ? {} : { transform: "translateY(0px)" }),
  };

  return (
    <div className="flex flex-col h-dvh w-full items-center justify-center -mt-12">
      <motion.div
        animate="shown"
        className="flex-1 flex w-full max-w-82 flex-col items-center justify-center p-4"
        initial="hidden"
        variants={{
          hidden: {},
          shown: { transition: { staggerChildren: ENTRANCE_STAGGER_SECONDS } },
        }}
      >
        <motion.div
          transition={{ duration: ENTRANCE_SECONDS, ease: EASE_OUT }}
          variants={{ hidden, shown }}
          className="flex items-center justify-center"
        >
          <AgentOrb size="56px" />
        </motion.div>
        <motion.h1
          className="text-2xl font-medium tracking-tight text-center mt-8"
          transition={{ duration: ENTRANCE_SECONDS, ease: EASE_OUT }}
          variants={{ hidden, shown }}
        >
          Sign in to {appConfig.brand.productName}
        </motion.h1>
        <motion.div
          className="mt-8 w-full"
          transition={{ duration: ENTRANCE_SECONDS, ease: EASE_OUT }}
          variants={{ hidden, shown }}
        >
          {showTinyFish ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={handleTinyFishSignIn}
            >
              <Input
                aria-label="TinyFish credential"
                autoComplete="off"
                disabled={isPending}
                onChange={(event) => setTinyFishToken(event.target.value)}
                placeholder="tf_… or tfk.alice"
                spellCheck={false}
                value={tinyFishToken}
              />
              <Button
                className="h-10 w-full tracking-tight"
                disabled={isPending || !tinyFishToken.trim()}
                size="lg"
                type="submit"
              >
                {isPending ? "Signing in…" : "Sign in with TinyFish"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Paste a TinyFish API key (<code>tf_…</code> from{" "}
                <a
                  className="underline underline-offset-2"
                  href="https://agent.tinyfish.ai/api-keys"
                  rel="noreferrer"
                  target="_blank"
                >
                  agent.tinyfish.ai/api-keys
                </a>
                ), an MCP token for <code>https://agent.tinyfish.ai/mcp</code>,
                or a local fixture (<code>tfk.alice</code> /{" "}
                <code>tfk.exhausted</code>). Exhausted is a credit gate, not an
                auth gate.
              </p>
            </form>
          ) : null}
          {showGoogle ? (
            <Button
              className={`h-10 w-full tracking-tight ${showTinyFish ? "mt-4" : ""}`}
              disabled={isPending}
              onClick={handleGoogleSignIn}
              size="lg"
              type="button"
              variant={showTinyFish ? "outline" : "default"}
            >
              {isPending ? "Opening Google…" : "Continue with Google"}
            </Button>
          ) : null}
          {!showTinyFish && !showGoogle ? (
            <p className="text-center text-sm text-muted-foreground">
              No auth providers are configured.
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  );
}
