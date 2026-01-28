# Настройка 404 для Caddy

Для корректной работы 404-страницы нужно добавить в Caddyfile на сервере:

```caddy
adshortsai.com {
    root * /home/aldima/Landing
    encode gzip
    
    # Handle 404 errors
    handle_errors {
        @404 {
            expression {http.error.status_code} == 404
        }
        rewrite @404 /404.html
        file_server
    }
    
    file_server
}
```

Или упрощённый вариант:

```caddy
adshortsai.com {
    root * /home/aldima/Landing
    encode gzip
    
    handle_errors 404 {
        rewrite * /404.html
        file_server
    }
    
    file_server
}
```

После изменения Caddyfile выполнить:

```bash
sudo systemctl reload caddy
```

Проверить:
```bash
curl -I https://adshortsai.com/nonexistent-page
```

Должен вернуться код `404 Not Found`.
