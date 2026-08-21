import { expect, test } from "bun:test";
import {
  authClient,
  signInWithGoogle,
  signInWithTinyFish,
} from "@/lib/auth/client";

test("starts the Google social sign-in flow through the Better Auth client", () => {
  expect(authClient.signIn.social).toBeFunction();
  expect(signInWithGoogle).toBeFunction();
});

test("exposes TinyFish fixture-desk sign-in", () => {
  expect(signInWithTinyFish).toBeFunction();
});
