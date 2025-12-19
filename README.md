# 🤖 Telegram Customer Service Bot (Cloudflare Worker 版)

这是一个轻量级、高性能的 Telegram 客服机器人，运行在 **Cloudflare Workers** 上，使用 **Cloudflare KV** 作为存储方案。它能将用户的私聊消息转发到指定的 Telegram 超级群组话题中，实现“一人对多人”或“团队对多人”的客服支持系统。

## ✨ 功能特性

- **话题化管理**：每个用户对应超级群组中的一个独立话题（Thread），对话井然有序。
- **人工验证系统**：内置随机数学/常识题库，有效拦截自动化垃圾信息机器人。
- **智能消息汇总**：自动生成消息预览卡片，支持一键跳转到对应话题。
- **并发控制优化**：针对 Telegram 媒体组（多图发送）进行了防刷屏去重逻辑优化。
- **自动初始化**：通过访问专属 URL 路径即可自动绑定 Webhook 和配置机器人菜单。
- **HTML 提及渲染**：确保管理员在汇总频道被提及（@提到）时能收到系统强提醒。
- **指令过滤**：自动拦截 `/start` 等基础指令的转发，保持管理界面整洁。

## 🛠️ 环境要求

在部署前，请确保你在 Cloudflare Worker 中配置了以下变量：

| **变量名**      | **类型**     | **说明**                                                    |
| --------------- | ------------ | ----------------------------------------------------------- |
| `BOT_TOKEN`     | Secret       | 从 [@BotFather](https://t.me/BotFather) 获取的机器人 Token  |
| `SUPERGROUP_ID` | Variable     | 接收消息的超级群组 ID (通常以 `-100` 开头)                  |
| `ADMIN_ID`      | Variable     | 管理员的数字 ID (可通过 @userinfobot 获取)，用于接收 @ 提醒 |
| `TOPIC_MAP`     | KV Namespace | 绑定一个 Cloudflare KV 空间，用于存储用户与话题的映射关系   |

## 🚀 快速开始

### 1. 部署代码

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 创建一个新的 Worker，并将项目中的 `index.js` 代码粘贴进去。
3. 在 **Settings -> Variables** 中添加上述环境变量。
4. 在 **Settings -> Bindings** 中添加 KV 命名空间绑定，变量名设为 `TOPIC_MAP`。

### 2. 初始化机器人

部署成功后，在浏览器访问以下地址：

Plaintext

```
https://你的worker名称.子域名.workers.dev/registerWebhook
```

如果返回 `{"status": "Success", ...}`，则说明机器人已成功与 Telegram 服务器建立连接，并自动设置了菜单指令。

## 📖 使用指南

- **用户侧**：点击 `/start` 后需完成验证题目。验证通过后，发送的任何文字、图片、视频、语音都会转发给管理员。
- **管理侧**：
  - 管理员在“汇总话题”中会看到新消息预览。
  - 点击“🚀 跳转回复”可直接进入用户专属话题。
  - 在话题内直接回复消息，机器人会将其回传给用户。
  - 输入 `/ban` 指令可快速封禁骚扰用户。

## 🔒 安全性说明

- `/registerWebhook` 接口是公开的，建议在初始化完成后，在代码中注释掉相关逻辑或添加校验 Key。
- 验证码状态有效期默认为 30 天，题目有效期为 5 分钟，可在代码中搜索 `expirationTtl` 自行修改。

------

### 开源协议

本项目基于 MIT 协议开源
