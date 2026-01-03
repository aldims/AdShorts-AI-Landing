#!/bin/bash
set -euo pipefail

# Скрипт обновления сайта на сервере
# Использование: ./update-site.sh

SERVER="158.160.125.225"
USER="aldima"
SITE_DIR="/home/aldima/Landing"
REPO_URL="https://github.com/aldims/AdShorts-AI-Landing.git"

echo "🚀 Обновление сайта на сервере $SERVER..."

# Проверяем подключение к серверу
if ! ssh -o ConnectTimeout=10 -l "$USER" "$SERVER" "echo 'Подключение успешно'" >/dev/null 2>&1; then
    echo "❌ Ошибка: не удается подключиться к серверу $SERVER"
    exit 1
fi

echo "✅ Подключение к серверу установлено"

# Выполняем обновление на сервере
ssh -l "$USER" "$SERVER" << REMOTE_SCRIPT
set -euo pipefail

SITE_DIR="$SITE_DIR"
echo "📁 Переходим в директорию сайта: \$SITE_DIR"
cd "\$SITE_DIR" || {
    echo "❌ Директория \$SITE_DIR не найдена"
    exit 1
}

echo "🔄 Получаем последние изменения из GitHub..."
if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/main
    echo "✅ Код обновлен из GitHub"
else
    echo "❌ Git репозиторий не найден в \$SITE_DIR"
    exit 1
fi

echo "🔄 Перезагружаем конфигурацию Caddy (без прерывания работы)..."
sudo systemctl reload caddy
sleep 1

echo "🔧 Проверяем статус Caddy..."
if sudo systemctl is-active --quiet caddy; then
    echo "✅ Caddy работает"
    
    # Проверяем статус сайта и включаем если нужно
    if sudo /usr/local/bin/sitectl status | grep -q "enabled"; then
        echo "✅ Сайт включен"
    else
        echo "⚠️  Сайт в режиме maintenance - включаем..."
        sudo /usr/local/bin/sitectl enable
        echo "✅ Сайт включен"
    fi
else
    echo "❌ Caddy не работает"
    sudo systemctl status caddy --no-pager || true
    exit 1
fi

echo "🌐 Проверяем доступность сайта..."
if curl -sSI https://adshortsai.com/ | head -n 1 | grep -q "200"; then
    echo "✅ Сайт доступен по HTTPS"
else
    echo "⚠️  Проблемы с доступностью сайта"
    curl -sSI https://adshortsai.com/ | head -n 5 || true
fi

echo "🎉 Обновление завершено успешно!"
REMOTE_SCRIPT

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Обновление сайта завершено успешно!"
    echo "🌐 Сайт доступен по адресу: https://adshortsai.com"
    echo ""
    echo "💡 Для управления сайтом используйте:"
    echo "   ./sitectl-remote.sh status  - проверить статус"
    echo "   ./sitectl-remote.sh disable - отключить сайт"
    echo "   ./sitectl-remote.sh enable  - включить сайт"
else
    echo ""
    echo "❌ Ошибка при обновлении сайта"
    exit 1
fi
