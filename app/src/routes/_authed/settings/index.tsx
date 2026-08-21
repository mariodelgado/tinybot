import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { useTheme } from "@/components/theme-provider";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { appConfig } from "@/lib/generated/application-config";

export const Route = createFileRoute("/_authed/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { dark, setDark } = useTheme();
  const { data: currentUser } = useQuery(currentUserQueryOptions());

  /*
   * The measurements that used to be written out here now live in `PageShell`, which Skills, Admin
   * and this screen all render through. The reason they match is no longer that somebody remembered
   * to copy them.
   */
  return (
    <PageShell
      description={`How ${appConfig.brand.productName} looks and behaves for you. These apply to your account alone, on every deployment you sign in to.`}
      title="Preferences"
    >
      <PageSection title="General">
        <PageRows>
          <Item size="sm">
            <ItemContent>
              <ItemTitle>Dark theme</ItemTitle>
              <ItemDescription>
                Use the dark appearance across {appConfig.brand.productName}.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Dark theme"
                checked={dark}
                onCheckedChange={setDark}
              />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>
      {currentUser?.tinyfishUserId ? (
        <PageSection
          description="The TinyFish identity TinyBot verified against TinyPipe. Credits stay on TinyPipe; this profile is only who you are here."
          title="TinyFish profile"
        >
          <PageRows>
            <Item size="sm">
              <ItemContent>
                <ItemTitle>tinyfish_user_id</ItemTitle>
                <ItemDescription>
                  <code>{currentUser.tinyfishUserId}</code>
                </ItemDescription>
              </ItemContent>
            </Item>
            {currentUser.iss ? (
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>iss</ItemTitle>
                  <ItemDescription>
                    <code>{currentUser.iss}</code>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ) : null}
            {currentUser.clientId ? (
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>client_id</ItemTitle>
                  <ItemDescription>
                    <code>{currentUser.clientId}</code>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ) : null}
            {currentUser.sprite ? (
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>Sprite</ItemTitle>
                  <ItemDescription>
                    <code>
                      {currentUser.sprite.name} · {currentUser.sprite.status}
                    </code>
                  </ItemDescription>
                </ItemContent>
              </Item>
            ) : null}
          </PageRows>
        </PageSection>
      ) : null}
    </PageShell>
  );
}
