#!/bin/sh
# Git credential helper for private TinyFish product clones / Docker git-context builds.
# Does not write a token into compose files or the TinyBot tree.
set -eu
prompt="${1:-}"
case "$prompt" in
  *Username*|*username*)
    printf '%s\n' "${GIT_ASKPASS_USER:-x-access-token}"
    ;;
  *)
    if command -v gh >/dev/null 2>&1; then
      gh auth token
    else
      printf '%s\n' "${GH_TOKEN:-${GITHUB_TOKEN:-}}"
    fi
    ;;
esac
