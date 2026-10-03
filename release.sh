#!/bin/bash
# Stage a release tarball of the R9-SI repo content (index.html + sources)
set -e
cd /home/claude/vr
node build.js
ST=/tmp/claude-0/-home-claude/faf7c5c5-3403-55c6-865b-eb66c7edd5f9/scratchpad/stage
rm -rf $ST && mkdir -p $ST
cp dist/index.html $ST/index.html
cp dist/studio.html $ST/studio.html
cp -r src $ST/src
cp build.js README.md ROADMAP.md TRAILER.md $ST/
mkdir -p $ST/tools
cp test/browser.mjs test/load_shared.js test/tex_check.js test/realm_test.js $ST/tools/ 2>/dev/null || true
cat > $ST/.gitignore <<'G'
node_modules
.next
dist
*.log
.DS_Store
.release
G
cat > $ST/PUBLISH-TO-GITHUB.md <<'G'
# Publish R9-SI to GitHub

This folder is a git repository. History:
- `v0-voxel-realm` — the old voxel-realm version (also kept in `legacy/voxel-realm/`)
- later commits — the new R9-SI game (`index.html` at the root)

## Easiest: GitHub Desktop
1. GitHub Desktop → **File → Add local repository…** → choose `Downloads\R9-SI` → **Add repository**
2. Click **Publish repository**, keep the name **R9-SI** → **Publish**
3. Optional: on github.com open the repo → Settings → Pages → Branch `main` / root → Save.
   Your game is then playable at `https://<your-user>.github.io/R9-SI/`.

## Command line
```
git remote add origin https://github.com/<your-user>/R9-SI.git
git push -u origin main --tags
```
G
mkdir -p /mnt/user-data/outputs
rm -f /mnt/user-data/outputs/r9si-release.tgz
tar czf /mnt/user-data/outputs/r9si-release.tgz -C $ST .
ls -la /mnt/user-data/outputs/r9si-release.tgz
