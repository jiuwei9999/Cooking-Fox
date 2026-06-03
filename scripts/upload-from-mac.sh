#!/usr/bin/env bash
# 在 Mac 上运行：打包项目并上传到服务器，然后在服务器执行 deploy-server.sh
#
# 用法：
#   chmod +x scripts/upload-from-mac.sh
#   ./scripts/upload-from-mac.sh root@123.45.67.89
#
# 上传后在服务器执行 ./scripts/deploy-server.sh（不装 systemd，适合宝塔）
#
set -euo pipefail

REMOTE="${1:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/cookingsim}"

if [[ -z "$REMOTE" ]]; then
  echo "用法: $0 <ssh用户@服务器IP>" >&2
  echo "示例: $0 root@123.45.67.89" >&2
  exit 1
fi

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="/tmp/cookingsim-deploy.tar.gz"

echo "==> 打包（排除虚拟环境、缓存）..."
tar -czf "$ARCHIVE" -C "$APP_ROOT" \
  --exclude='server/.venv' \
  --exclude='**/__pycache__' \
  --exclude='**/.DS_Store' \
  --exclude='server/data.sqlite' \
  .

echo "==> 上传到 ${REMOTE}:${REMOTE_DIR} ..."
ssh "$REMOTE" "mkdir -p '${REMOTE_DIR}'"
scp "$ARCHIVE" "${REMOTE}:/tmp/cookingsim-deploy.tar.gz"
ssh "$REMOTE" "tar -xzf /tmp/cookingsim-deploy.tar.gz -C '${REMOTE_DIR}' && rm /tmp/cookingsim-deploy.tar.gz"

echo "==> 在服务器上执行部署脚本（仅装依赖 + 生成 start.sh）..."
ssh -t "$REMOTE" "cd '${REMOTE_DIR}' && chmod +x scripts/deploy-server.sh scripts/upload-from-mac.sh 2>/dev/null; \
  chmod +x scripts/deploy-server.sh && ./scripts/deploy-server.sh"

rm -f "$ARCHIVE"
echo "==> 完成。"
