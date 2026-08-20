import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { TinyFishAppFrame } from "@/components/tinyfish/app-frame";
import { Button } from "@/components/ui/button";
import { tinyFishAppBySlug } from "@/lib/tinyfish/apps";

export const Route = createFileRoute("/_authed/_app/apps/$product")({
  component: TinyFishAppPage,
});

function TinyFishAppPage() {
  const { product } = Route.useParams();
  const app = tinyFishAppBySlug(product);

  if (!app) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="font-semibold text-lg">Product not found</h1>
        <p className="max-w-md text-muted-foreground text-sm">
          “{product}” is not one of the TinyFish products TinyBot embeds.
        </p>
        <Button render={<Link to="/" />} size="sm" variant="ghost">
          <IconArrowLeft />
          Back to start
        </Button>
      </div>
    );
  }

  return <TinyFishAppFrame app={app} />;
}
