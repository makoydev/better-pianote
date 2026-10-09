#!/usr/bin/env bash
# Build the app and publish it to the gh-pages branch, which GitHub Pages serves at
# https://makoydev.github.io/better-pianote/  (use it on an iPad: Safari → Share → Add to Home Screen).
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

remote="$(git remote get-url origin)"
rev="$(git rev-parse --short HEAD)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cp -R dist/. "$tmp/"
# Serve the files as they are (no Jekyll processing on GitHub's side).
touch "$tmp/.nojekyll"

cd "$tmp"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $rev"
# The branch only ever holds the latest build, so replace it outright. Push with the GitHub CLI's
# login, because the macOS keychain may hold a different GitHub account.
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' -c http.postBuffer=157286400 \
  push -q -f "$remote" gh-pages

echo "Deployed $rev to gh-pages. It goes live in a minute or two."
