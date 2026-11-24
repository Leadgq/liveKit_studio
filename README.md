# LiveKit Learning

Vue 3 + TypeScript + Vite 前端，NestJS 后端，npm workspaces 单仓库。

## 当前功能

- 后端签发 1 小时有效的房间 Token。
- 访客填写称呼和房间名称，自动获取 Token 并加入。
- 同一房间多人订阅音视频，支持麦克风、摄像头和离开操作。
- 房间内实时文字聊天，支持中英文和表情，每条最多 1000 个字符。
- 显示连接状态、参与者及具体错误，支持自动播放受限时手动开启声音。
- 默认关闭麦克风和摄像头，视频默认采集 360p。

初版使用访客模式，无数据库。房间运行状态由 LiveKit 维护，每次加入生成独立身份，便于多个标签页测试。需要账号、房间归属、会议历史时再接数据库和登录鉴权。

## 环境

Node.js 22.12 或以上版本。本机负责运行前后端，云服务器运行已经部署的 LiveKit。

## 启动

依赖首次安装。

```powershell
cd D:\project\livekit-learning
npm install --legacy-peer-deps
```

后端环境文件为 `apps/api/.env`。已按当前学习服务器填好开发模式参数。

```dotenv
PORT=3001
LIVEKIT_URL=/livekit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

新机器使用 `Copy-Item apps/api/.env.example apps/api/.env` 创建环境文件。密钥只由后端读取。

先在独立 PowerShell 中保持 SSH 隧道运行。

```powershell
ssh -i "$env:USERPROFILE\.ssh\livekit_learning" -N -L 127.0.0.1:7880:127.0.0.1:7880 root@8.153.182.126
```

在工程目录启动前后端。

```powershell
npm run dev
```

打开 <http://localhost:5173>。后端监听 `127.0.0.1:3001`，Vite 将 `/api` 请求代理到后端。

用两个标签页填写相同房间名称、不同称呼，即可测试。建议佩戴耳机，先只打开一个标签页的麦克风，避免回声。本次 Clash TUN 会影响 WebRTC，测试时关闭 TUN。音视频直接走服务器 TCP 7881 / UDP 7882。

## 工程结构

```text
apps/
  api/
    src/rooms.controller.ts  HTTP 接口
    src/rooms.service.ts     校验请求并签发 Token
    .env                    本地环境参数（Git 忽略）
  web/
    src/App.vue             加入房间与设备控制
    src/components/ParticipantTile.vue
    src/style.css
```

## 接口

- `GET /api/health` 检查后端状态。
- `POST /api/rooms/token` 接收 `roomName` 和 `displayName`，返回 `serverUrl`、`token`、`identity`、`roomName`。

当前 Token 接口允许本机访客选择房间。正式业务应在 `RoomsService.createToken` 中校验登录身份和房间权限。上线使用独立强密钥、HTTPS/WSS，并配置前后端访问方式。

## 检查与构建

```powershell
npm run typecheck
npm run build
```

前端产物在 `apps/web/dist`，后端产物在 `apps/api/dist`。当前开发代理配置用于本机学习。

## iPhone 局域网测试

手机需要能访问电脑所在网络，当前电脑地址为 `10.100.99.229`。

1. 首次运行 `npm run certificate:generate`，生成当前局域网 IP 对应的开发证书。
2. 保持 SSH 隧道和 `npm run dev` 运行，再运行 `npm run dev:mobile`。
3. iPhone Safari 打开 <http://10.100.99.229:5173/dev-ca.cer> 下载本工程的 CA 公钥证书。
4. 在 iPhone 设置 → 通用 → VPN 与设备管理中安装下载的描述文件。
5. 设置 → 通用 → 关于本机 → 证书信任设置，对 `LiveKit Learning Local CA` 开启完全信任。
6. Safari 打开 <https://10.100.99.229:5174>，输入与电脑相同的房间名称加入。

开发证书和私钥保存在被 Git 忽略的 `.certs/` 下，下载接口仅提供 CA 公钥证书。手机端的安装与信任操作由使用者完成。

后端现在返回相对地址 `/livekit`，前端根据页面协议生成 WS/WSS 地址，再由 Vite 转发到电脑 SSH 隧道的 `127.0.0.1:7880`。因此手机可以通过电脑连接现有 LiveKit。

电脑默认页面继续使用 <http://localhost:5173>。Windows 防火墙需要允许手机访问 TCP 5173 和 5174。如果证书下载页面无法打开，先检查局域网互通、Windows 防火墙和 Wi-Fi 客户端隔离。

电脑 IP 变化后，重新运行证书生成命令，再重启手机 HTTPS 服务。CA 保持相同，因此手机已信任的 CA 可继续使用。

[Apple 手动信任证书说明](https://support.apple.com/zh-cn/102390)

## 房间聊天

加入后，通话区域下方会出现聊天区。同一房间内的在线参与者可以互相发送文字，使用 LiveKit 可靠数据通道传输。消息按收到的顺序追加，Vue 按纯文本展示。

聊天记录只保存在当前页面会话中，退出或刷新后清空，后来加入的用户仅接收加入后的新消息。需要历史记录或离线消息时，再接入后端存储。组件位于 `apps/web/src/components/RoomChat.vue`。

## 文件分享与预览

聊天室的回形针按钮支持选择并分享单个文件，上限为 20MB。文件上传至 NestJS，LiveKit 广播文件信息，同房间在线参与者会看到文件卡片。点击卡片在新标签页打开预览，页面提供下载按钮。

支持预览 PDF、DOCX、XLSX、XLS、PPTX、PNG/JPEG/GIF/WebP/AVIF 及 UTF-8 TXT/MD/JSON/CSV/LOG。旧版 DOC、PPT 和其他类型提供下载入口。预览按参考组件使用 Vue Office 的 Vue 3 构建，并按需加载。

文件保存在 `apps/api/.uploads/`，重启后可通过原链接访问，目前需手动管理磁盘占用。此学习版为访客分享，持有文件链接即可访问。正式业务可按需补充登录和文件访问权限。

接口包括 `POST /api/files`（multipart 字段 `file`）、`GET /api/files/:id`（文件信息）和 `GET /api/files/:id/content`（下载）。独立预览地址为 `/files/:id`。

Vue Office 的包同时包含 Vue 2/3 构建，但部分 peerDependencies 保留旧版声明，因此安装使用 `npm install --legacy-peer-deps`。工程明确引用 `lib/v3` 目录。
