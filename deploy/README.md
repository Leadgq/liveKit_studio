# 私人测试部署

先在本机执行 `npm run build`。前端产物由服务器已有 Nginx 提供访问，后端运行在 Docker 中。

服务器目录为 `/opt/livekit-studio`。

- `releases/<版本>/web` 保存该版本前端产物。
- `releases/<版本>/apps/api/dist` 保存后端产物。
- `current` 指向当前版本。
- `api.env` 保存后端运行参数。
- `uploads` 持久保存上传的文件。

Nginx 使用 `nginx.private.conf`，监听服务器本机的 `127.0.0.1:8080`。后端仍监听 `127.0.0.1:3001`。

环境参数为 `PORT=3001`、`LIVEKIT_URL=/livekit`，并配置与当前 LiveKit 一致的 API Key 和 Secret。私人测试沿用当前开发模式密钥。

在电脑建立隧道后访问。

```powershell
ssh -i "$env:USERPROFILE\.ssh\livekit_learning" -N -L 127.0.0.1:18080:127.0.0.1:8080 root@8.153.182.126
```

浏览器打开 <http://localhost:18080>。网页、接口和 LiveKit 信令均通过这个入口访问，音视频继续使用已开放的 7881 / 7882 端口。使用期间保持隧道运行。

更新时在新版本目录运行以下命令，验证后切换 `current` 并平滑重载 Nginx。

```bash
docker compose --project-name livekit-studio --project-directory "$PWD" -f deploy/compose.private.yml up -d --build
nginx -t
systemctl reload nginx
```

这是等待域名实名认证及备案期间的私人测试环境。公网发布还需完成域名、可信 HTTPS、正式密钥和访问权限配置。
