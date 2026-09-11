# Telegram 双向私聊机器人（Cloudflare Worker 版）

一个运行在 Cloudflare Workers 上的 Telegram 双向私聊机器人。  
用户通过私聊发送消息，机器人自动在超级群创建独立话题并转发；管理员在话题内回复即可回传到用户私聊。

支持验证题防刷、封禁、结案、彻底删除话题、通知卡片、用户资料卡片等功能。

## 功能特性

- **双向消息同步**
  - 用户私聊 → 超级群对应话题
  - 管理员在话题回复 → 用户私聊

- **身份验证防刷**
  - 首次使用需回答验证题
  - 连续答错 3 次临时封禁 30 分钟
  - 验证状态有效期 7 天

- **管理指令**（在对应话题内使用）
  | 指令 | 说明 |
  |------|------|
  | `/ban` | 永久封禁当前用户 |
  | `/unban` | 解封当前用户 |
  | `/close` | 结案并关闭话题（清除用户状态） |
  | `/delete` | 彻底删除话题及所有消息（清除用户状态） |

- **其他特性**
  - 自动创建用户专属话题
  - 用户资料卡片（含头像）
  - 新消息汇总通知卡片（支持跳转、忽略）
  - 媒体消息完整支持（图片、视频、文件、语音、贴纸等）
  - KV 存储优化（用户状态合并，减少读写）

## 技术栈

- Cloudflare Workers
- Cloudflare KV
- Telegram Bot API

## 环境变量

在 Cloudflare Workers 中配置以下环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `BOT_TOKEN` | Telegram 机器人 Token | ✅ |
| `SUPERGROUP_ID` | 超级群 ID（带 `-100` 前缀） | ✅ |
| `TOPIC_MAP` | KV 命名空间绑定名称 | ✅ |
| `ADMIN_ID` | 管理员用户 ID（可选，用于权限校验） | ❌ |
| `CLEANUP_SECRET` | 清理接口密钥（可选） | ❌ |

## 部署步骤

### 1. 创建机器人

1. 在 Telegram 中找 [@BotFather](https://t.me/BotFather)
2. 使用 `/newbot` 创建机器人，获取 `BOT_TOKEN`
3. 建议关闭隐私模式：`/setprivacy` → Disable

### 2. 准备超级群

1. 创建一个超级群并开启 **话题功能（Topics）**
2. 将机器人添加为管理员，并赋予以下权限：
   - 删除消息
   - 管理话题
   - 邀请用户（建议）
3. 获取超级群 ID（可通过其他机器人或 API 获取，格式如 `-100xxxxxxxxxx`）

### 3. 创建 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → 创建 Worker
3. 将本项目代码粘贴到编辑器中
4. 创建 KV 命名空间，并绑定为 `TOPIC_MAP`
5. 配置环境变量（见上方表格）
6. 部署

### 4. 注册 Webhook

部署完成后，访问以下地址完成初始化：
