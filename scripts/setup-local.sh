#!/usr/bin/env bash
# 本地工具鏈一鍵安裝（免 sudo，冪等可重跑）。
#
# 備好項目：Node 20、Python 3.13（含 source:verify 依賴)、Chromium（含系統 lib）。
# 用法：
#   source scripts/setup-local.sh   # 直接套用 PATH / LD_LIBRARY_PATH 到目前 shell
#   bash scripts/setup-local.sh     # 只安裝，最後印出需要 export 的兩行
#
# 之後本地跑快 gate：npm run validate && npm run build && npm test
# 重的 browser visual gate 照樣交給 GitHub Actions 跑；列印吃 GitHub Pages 部署站。
set -euo pipefail

TOOL_ROOT="${KSS_TOOL_ROOT:-$HOME/.local/share/kawai-score-studio}"
NODE_VERSION="20.19.0"
NODE_DIR="$TOOL_ROOT/node-v$NODE_VERSION-linux-x64"
DEBS_DIR="$TOOL_ROOT/debs"
SYSLIBS_DIR="$TOOL_ROOT/syslibs"
SYSLIBS_LIB="$SYSLIBS_DIR/usr/lib/x86_64-linux-gnu"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$TOOL_ROOT" "$DEBS_DIR"

# 1. Node（官方 tarball，解到 TOOL_ROOT，免 sudo）
if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "[setup] installing Node $NODE_VERSION ..."
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
    -o "$TOOL_ROOT/node.tar.xz"
  tar -xf "$TOOL_ROOT/node.tar.xz" -C "$TOOL_ROOT"
else
  echo "[setup] Node $NODE_VERSION already installed."
fi
export PATH="$NODE_DIR/bin:$PATH"

# 2. Python 3.13（經 uv 安裝，免 sudo）
UV_BIN="$HOME/.local/bin/uv"
if ! command -v uv >/dev/null 2>&1 && [ ! -x "$UV_BIN" ]; then
  echo "[setup] installing uv ..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
PATH="$HOME/.local/bin:$PATH" uv python install 3.13 >/dev/null
PY313="$HOME/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13"
if [ ! -x "$PY313" ]; then
  echo "[setup] ERROR: Python 3.13 not found at $PY313" >&2
  exit 1
fi
echo "[setup] $($PY313 --version) ready."

# 3. source:verify 的 Python 依賴（裝給 3.13，冪等）
echo "[setup] installing Python deps for source:verify ..."
"$PY313" -m pip install --break-system-packages -q -r "$REPO_ROOT/requirements-source.txt"

# 4. 專案 Node 依賴
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "[setup] npm install ..."
  (cd "$REPO_ROOT" && npm install)
else
  echo "[setup] node_modules already present."
fi

# 5. Chromium（Playwright 釘選版本，取自 package.json）
PW_VERSION="$(node -e "console.log(require('$REPO_ROOT/package.json').devDependencies['@playwright/test'])" 2>/dev/null || echo "1.55.0")"
if [ ! -d "$HOME/.cache/ms-playwright/chromium_headless_shell-1187" ] && \
   [ ! -d "$HOME/.cache/ms-playwright/chromium-1187" ]; then
  echo "[setup] installing Chromium for Playwright $PW_VERSION ..."
  (cd "$REPO_ROOT" && npx --yes "@playwright/test@$PW_VERSION" install chromium)
else
  echo "[setup] Chromium already installed."
fi

# 6. Chromium 系統 lib（無 sudo：apt download + 解包，靠 LD_LIBRARY_PATH）
#    已裝過的 .deb 會跳過下載，冪等。
CHROMIUM_LIBS="libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libxi6 libxrender1"
need_dl=""
for pkg in $CHROMIUM_LIBS; do
  if ! ls "$DEBS_DIR/${pkg}_"*".deb" >/dev/null 2>&1; then
    need_dl="$need_dl $pkg"
  fi
done
if [ -n "$need_dl" ]; then
  echo "[setup] downloading system libs:$need_dl"
  (cd "$DEBS_DIR" && apt-get download $need_dl)
fi
for deb in "$DEBS_DIR"/*.deb; do
  dpkg-deb -x "$deb" "$SYSLIBS_DIR"
done
export LD_LIBRARY_PATH="$SYSLIBS_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# 7. 驗收：headless_shell 的 shared lib 必須全數解析
HEADLESS_SHELL="$(ls "$HOME/.cache/ms-playwright"/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -n 1 || true)"
if [ -n "$HEADLESS_SHELL" ]; then
  MISSING="$(ldd "$HEADLESS_SHELL" 2>/dev/null | grep 'not found' || true)"
  if [ -n "$MISSING" ]; then
    echo "[setup] ERROR: still missing libs:" >&2
    echo "$MISSING" >&2
    exit 1
  fi
  echo "[setup] Chromium headless_shell libs OK."
fi

echo ""
echo "[setup] done. Make sure your shell has:"
echo "  export PATH=\"$NODE_DIR/bin:\$PATH\""
echo "  export LD_LIBRARY_PATH=\"$SYSLIBS_LIB\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}\""
echo "Then run: npm run validate && npm run build && npm test"
