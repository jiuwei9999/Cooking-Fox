#!/usr/bin/env bash
# 狐闹厨房 · Cooking-Fox 部署脚本（宝塔 / 自建反代友好）
#
# 默认：只装 Python 依赖 + 生成 server/start.sh，不装 systemd、不装 Nginx。
# 你在宝塔里用「Python 项目」或「Supervisor」指向 start.sh 即可，反代自己配。
#
#   cd /opt/cookingsim
#   chmod +x scripts/deploy-server.sh
#   ./scripts/deploy-server.sh
#
# 指定监听（写入 start.sh）：
#   HOST=127.0.0.1 PORT=8787 ./scripts/deploy-server.sh
#
# 可选（一般不需要）：
#   sudo ./scripts/deploy-server.sh --install-apt    # 顺带 apt 装 python3-venv
#   sudo ./scripts/deploy-server.sh --with-systemd   # 仍想用 systemd 时
#   sudo ./scripts/deploy-server.sh --with-nginx     # 脚本帮你写 Nginx（宝塔用户通常不用）
#
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${APP_ROOT}/server"
START_SCRIPT="${SERVER_DIR}/start.sh"
# 宝塔若装了多个 Python，可指定：PYTHON3=/www/server/pyproject_evn/versions/3.11.9/bin/python3 ./scripts/deploy-server.sh
PYTHON3="${PYTHON3:-python3}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8787}"
DOMAIN="${DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
INSTALL_APT=0
WITH_SYSTEMD=0
WITH_NGINX=0
NO_SSL=0
SKIP_APT=0
SERVICE_NAME="cookingsim"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --install-apt) INSTALL_APT=1; shift ;;
    --with-systemd) WITH_SYSTEMD=1; shift ;;
    --with-nginx) WITH_NGINX=1; shift ;;
    --no-ssl) NO_SSL=1; shift ;;
    --skip-apt) SKIP_APT=1; shift ;;
    *) echo "未知参数: $1（用 --help 查看）" >&2; exit 1 ;;
  esac
done

if [[ ! -f "${SERVER_DIR}/requirements.txt" ]]; then
  echo "找不到 ${SERVER_DIR}/requirements.txt" >&2
  echo "请在项目根目录执行（含 server/ 与 web/）。" >&2
  exit 1
fi

if [[ ! -f "${SERVER_DIR}/.env" ]]; then
  echo ">>> 未找到 server/.env（脚本不会自动创建，避免覆盖你的密钥）"
  echo "    请自行复制: cp server/.env.example server/.env  然后编辑 AI_API_KEY"
fi

need_root=0
[[ "$INSTALL_APT" -eq 1 && "$SKIP_APT" -eq 0 ]] && need_root=1
[[ "$WITH_SYSTEMD" -eq 1 ]] && need_root=1
[[ "$WITH_NGINX" -eq 1 ]] && need_root=1

if [[ "$need_root" -eq 1 ]] && [[ "$(id -u)" -ne 0 ]]; then
  echo "当前选项需要 root，请: sudo $0 $*" >&2
  exit 1
fi

echo "==> 狐闹厨房 · Cooking-Fox 部署（宝塔 / 手动反代模式）"
echo "    项目目录: ${APP_ROOT}"
echo "    监听:     ${HOST}:${PORT}"
echo "    systemd:  $([[ "$WITH_SYSTEMD" -eq 1 ]] && echo 启用 || echo 跳过)"
echo "    Nginx:    $([[ "$WITH_NGINX" -eq 1 ]] && echo 启用 || echo 跳过)"

if [[ "$INSTALL_APT" -eq 1 && "$SKIP_APT" -eq 0 && "$(id -u)" -eq 0 ]]; then
  echo "==> apt 安装 python3-venv / curl..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq python3 python3-venv python3-pip curl ca-certificates
  if [[ "$WITH_NGINX" -eq 1 ]]; then
    apt-get install -y -qq nginx
    if [[ "$NO_SSL" -eq 0 && -n "$DOMAIN" ]]; then
      apt-get install -y -qq certbot python3-certbot-nginx
    fi
  fi
fi

if ! command -v "$PYTHON3" >/dev/null 2>&1; then
  echo "未找到: $PYTHON3" >&2
  echo "宝塔：软件商店安装 Python 3.10+，或设置 PYTHON3=完整路径 $0" >&2
  exit 1
fi

echo "==> 使用 Python: $($PYTHON3 --version 2>&1) ($(
  command -v "$PYTHON3" 2>/dev/null || echo "$PYTHON3"
))"

if ! "$PYTHON3" -c "import venv" 2>/dev/null; then
  echo "缺少 venv 模块。请执行其一：" >&2
  echo "  sudo apt install -y python3-venv" >&2
  echo "  或在宝塔软件商店安装 Python 3.10/3.11 后再运行本脚本" >&2
  exit 1
fi

echo "==> Python 虚拟环境与依赖..."
cd "${SERVER_DIR}"

# 半拉子 .venv（尤其从别机拷过、或上次 venv 失败）会导致找不到 bin/python3
if [[ -d .venv ]]; then
  if [[ ! -x .venv/bin/python ]]; then
    echo ">>> 删除不完整的 .venv ..."
    rm -rf .venv
  fi
fi

"$PYTHON3" -m venv --clear .venv 2>/dev/null || "$PYTHON3" -m venv .venv

VENV_PY="${SERVER_DIR}/.venv/bin/python"
if [[ ! -x "$VENV_PY" ]]; then
  echo "虚拟环境创建失败（无 .venv/bin/python）。" >&2
  echo "请确认已安装 python3-venv，或换 PYTHON3= 宝塔里的 python 路径重试。" >&2
  rm -rf .venv
  exit 1
fi

"$VENV_PY" -m pip install -q --upgrade pip
"$VENV_PY" -m pip install -q -r requirements.txt

echo "==> 生成启动脚本 ${START_SCRIPT} ..."
cat > "${START_SCRIPT}" <<EOF
#!/usr/bin/env bash
# 狐闹厨房 · Cooking-Fox 启动（给宝塔 Supervisor / Python 项目用）
cd "$(dirname "\$0")"
exec "\$(pwd)/.venv/bin/python" -m uvicorn app.main:app --host ${HOST} --port ${PORT}
EOF
chmod +x "${START_SCRIPT}"

if [[ "$WITH_SYSTEMD" -eq 1 ]]; then
  echo "==> systemd 服务（可选）..."
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=狐闹厨房 · Cooking-Fox
After=network.target

[Service]
Type=simple
WorkingDirectory=${SERVER_DIR}
Environment=PATH=${SERVER_DIR}/.venv/bin
ExecStart=${SERVER_DIR}/.venv/bin/uvicorn app.main:app --host ${HOST} --port ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
  echo "    systemctl status ${SERVICE_NAME}"
fi

if [[ "$WITH_NGINX" -eq 1 ]]; then
  NGINX_SITE="/etc/nginx/sites-available/${SERVICE_NAME}"
  SERVER_NAMES="${DOMAIN:-_}"
  [[ -n "$DOMAIN" ]] && SERVER_NAMES="${DOMAIN} www.${DOMAIN}"
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAMES};
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
EOF
  ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  nginx -t && systemctl reload nginx
  if [[ -n "$DOMAIN" && -n "$CERTBOT_EMAIL" && "$NO_SSL" -eq 0 ]]; then
    certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
      --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || true
  fi
fi

echo ""
echo "=============================================="
echo " 完成"
echo "=============================================="
echo ""
echo "【宝塔里怎么填】"
echo "  项目路径 / 运行目录:  ${SERVER_DIR}"
echo "  启动命令:            ${START_SCRIPT}"
echo "  或命令行:            ${SERVER_DIR}/.venv/bin/python -m uvicorn app.main:app --host ${HOST} --port ${PORT}"
echo "  监听地址:            ${HOST}:${PORT}"
echo ""
echo "【网站反代】"
echo "  目标 URL: http://127.0.0.1:${PORT}"
echo "  建议超时 ≥ 600 秒（AI 食谱较慢）"
echo ""
echo "【自测】"
echo "  cd ${SERVER_DIR} && ./start.sh"
echo "  另开终端: curl http://127.0.0.1:${PORT}/api/health"
echo ""
echo "【环境变量】"
echo "  nano ${SERVER_DIR}/.env"
echo "=============================================="
