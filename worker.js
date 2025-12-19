// --- 1. 配置与题库 ---
// 验证题库：用户首次使用时需正确回答才能开始咨询，防止机器人骚扰
const QUESTION_BANK = [
  // 数学问题
  { question: "5 + 5 = ?", options: ["10", "15", "8"], answer: "10" },
  { question: "3 * 3 = ?", options: ["6", "9", "12"], answer: "9" },
  { question: "15 - 5 = ?", options: ["10", "5", "12"], answer: "10" },
  { question: "12 / 4 = ?", options: ["3", "4", "6"], answer: "3" },
  { question: "100 - 37 = ?", options: ["63", "72", "75"], answer: "63" },
  { question: "2 * 6 = ?", options: ["12", "15", "14"], answer: "12" },
  { question: "9 + 7 = ?", options: ["16", "15", "17"], answer: "16" },
  { question: "100 / 25 = ?", options: ["4", "3", "2"], answer: "4" },
  { question: "50 + 25 = ?", options: ["75", "80", "70"], answer: "75" },
  { question: "21 * 3 = ?", options: ["63", "72", "60"], answer: "63" },

  // 生活常识
  { question: "雪是什么颜色的？", options: ["白色", "红色", "黑色"], answer: "白色" },
  { question: "一年有几个季节？", options: ["4个", "2个", "12个"], answer: "4个" },
  { question: "红灯停，什么灯行？", options: ["绿灯", "黄灯", "蓝灯"], answer: "绿灯" },
  { question: "人类的平均体温是多少？", options: ["36.5°C", "37°C", "38°C"], answer: "37°C" },
  { question: "地球上最常见的气体是什么？", options: ["氮气", "氧气", "二氧化碳"], answer: "氮气" },
  { question: "水的沸点是多少摄氏度？", options: ["100°C", "90°C", "50°C"], answer: "100°C" },
  { question: "水的冰点是多少摄氏度？", options: ["0°C", "5°C", "10°C"], answer: "0°C" },
  { question: "人体的血液大约由多少水分组成？", options: ["55%", "60%", "50%"], answer: "55%" },
  { question: "牛奶的主要成分是什么？", options: ["水", "糖", "脂肪"], answer: "水" },
  { question: "空气的主要成分是什么？", options: ["氮气", "氧气", "二氧化碳"], answer: "氮气" },

  // 交通规则
  { question: "红灯停，什么灯行？", options: ["绿灯", "黄灯", "蓝灯"], answer: "绿灯" },
  { question: "行驶中，遇到红灯时应该怎么办？", options: ["停车等待", "加速通过", "按喇叭"], answer: "停车等待" },
  { question: "在高速公路上，最大车速是多少？", options: ["120公里/小时", "100公里/小时", "80公里/小时"], answer: "120公里/小时" },
  { question: "在城市道路上，最小车速是多少？", options: ["30公里/小时", "20公里/小时", "40公里/小时"], answer: "30公里/小时" },
  { question: "遇到黄色闪烁灯时，应该怎么做？", options: ["减速慢行", "停车", "继续前进"], answer: "减速慢行" },
  { question: "通过交叉路口时，应该注意什么？", options: ["看左看右", "不看车", "不看行人"], answer: "看左看右" },
  { question: "在交叉路口的停车标志下，应该做什么？", options: ["停车", "加速通过", "慢行通过"], answer: "停车" },
  { question: "遇到交通事故，应该首先做什么？", options: ["报警", "检查伤员", "拍照"], answer: "报警" },
  { question: "如果警察示意停车，应该怎么做？", options: ["停车", "继续行驶", "按喇叭"], answer: "停车" },
  { question: "在没有交通标志的路口，应该怎样行驶？", options: ["优先通行", "等候他车通过", "加速通过"], answer: "等候他车通过" },

  // 地理问题
  { question: "太阳系中最小的行星是什么？", options: ["水星", "火星", "金星"], answer: "水星" },
  { question: "地球上最大的岛屿是哪个？", options: ["格陵兰岛", "新几内亚岛", "马尔代夫"], answer: "格陵兰岛" },
  { question: "世界上最深的海洋是哪个？", options: ["太平洋", "印度洋", "大西洋"], answer: "太平洋" },
  { question: "世界上最长的山脉是什么？", options: ["安第斯山脉", "喜马拉雅山脉", "阿尔卑斯山脉"], answer: "安第斯山脉" },
  { question: "冰岛位于哪个大洋？", options: ["大西洋", "太平洋", "印度洋"], answer: "大西洋" },
  { question: "月亮离地球有多远？", options: ["38万公里", "40万公里", "39万公里"], answer: "38万公里" },
  { question: "地球上最常见的气体是什么？", options: ["氮气", "氧气", "二氧化碳"], answer: "氮气" },
  { question: "地球的直径大约是多少公里？", options: ["12742公里", "12000公里", "14000公里"], answer: "12742公里" },
  { question: "地球上有多少个大洋？", options: ["5个", "4个", "6个"], answer: "5个" },
  { question: "地球的最大海洋是什么？", options: ["太平洋", "大西洋", "印度洋"], answer: "太平洋" }
];

export default {
  /**
   * Worker 入口函数：处理所有传入的 HTTP 请求
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 路径：/registerWebhook -> 用于一键绑定 Bot Token 和 Worker 地址
    if (url.pathname === "/registerWebhook") return await handleRegisterWebhook(request, env);
    
    // 环境校验：确保必要的环境变量已在 Cloudflare 控制台配置
    if (!env.BOT_TOKEN || !env.SUPERGROUP_ID || !env.TOPIC_MAP) return new Response("Config Error");
    if (request.method !== "POST") return new Response("OK");

    // 解析 Telegram 发来的 JSON 数据包
    let update;
    try { update = await request.json(); } catch (e) { return new Response("OK"); }

    // 处理按钮点击回调 (Callback Query)
    if (update.callback_query) {
      await handleCallback(update.callback_query, env);
      return new Response("OK");
    }

    const msg = update.message;
    if (!msg) return new Response("OK");

    // 判断消息来源：私聊(private) 或 客服群内回复
    if (msg.chat && msg.chat.type === "private") {
      ctx.waitUntil(handlePrivate(msg, env, ctx)); // 异步处理私聊消息
    } 
    else if (msg.chat && String(msg.chat.id) === String(env.SUPERGROUP_ID)) {
      if (msg.message_thread_id) ctx.waitUntil(handleAdminReply(msg, env, ctx)); // 处理管理员在话题内的回复
    }
    return new Response("OK");
  }
};

/**
 * 逻辑 A：处理用户私聊
 * 包含：管理员拦截、黑名单校验、验证码判断、消息转发
 */
async function handlePrivate(msg, env, ctx) {
  const userId = msg.chat.id;
  const isAdmin = env.ADMIN_ID && String(userId) === String(env.ADMIN_ID);

  // 1. 管理员拦截：禁止管理员在机器人私聊里发咨询消息
  if (isAdmin) {
    if (msg.text === "/start") {
      return await tgCall(env, "sendMessage", { chat_id: userId, text: "🔧 <b>管理模式已激活</b>\n请在客服群处理消息。", parse_mode: "HTML" });
    }
    // 非命令则提示并 2 秒自删
    const adminTip = await tgCall(env, "sendMessage", { chat_id: userId, text: "⚠️ <b>提示</b>：管理员请勿在此发送咨询消息。", parse_mode: "HTML" });
    if (adminTip.ok) ctx.waitUntil((async () => { await new Promise(r => setTimeout(r, 2000)); await tgCall(env, "deleteMessage", { chat_id: userId, message_id: adminTip.result.message_id }); })());
    return;
  }

  // 2. 黑名单与验证校验
  if (await env.TOPIC_MAP.get(`ban:${userId}`)) return; // 被封禁用户直接无视
  if (!(await env.TOPIC_MAP.get(`v:${userId}`))) return await sendChallenge(userId, env); // 未通过验证发送题目

  if (msg.text?.startsWith('/start')) {
    return await tgCall(env, "sendMessage", { chat_id: userId, text: "🙏 <b>验证通过。</b>\n请发送您的问题。", parse_mode: "HTML" });
  }

  // 3. 获取/创建用户专属话题 (Thread)
  let rec = await env.TOPIC_MAP.get(`u:${userId}`, { type: "json" });
  if (!rec) {
    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || `用户_${userId}`;
    const res = await tgCall(env, "createForumTopic", { chat_id: env.SUPERGROUP_ID, name: `${name.substring(0, 15)} (${userId})` });
    if (res.ok) {
      rec = { thread_id: res.result.message_thread_id.toString() };
      await env.TOPIC_MAP.put(`u:${userId}`, JSON.stringify(rec)); // 存储 用户ID -> 话题ID 映射
      await env.TOPIC_MAP.put(`t:${rec.thread_id}`, userId.toString()); // 存储 话题ID -> 用户ID 映射
    }
  }

  // 4. 执行转发
  const fRes = await sendBot(msg, env.SUPERGROUP_ID, rec.thread_id, env);
  
  if (fRes.ok) {
    // 5. 发送“已发送”提示并 2 秒删除
    const tipRes = await tgCall(env, "sendMessage", { chat_id: userId, text: "✅ <b>已发送</b>", parse_mode: "HTML" });
    if (tipRes.ok) ctx.waitUntil((async () => { await new Promise(r => setTimeout(r, 2000)); await tgCall(env, "deleteMessage", { chat_id: userId, message_id: tipRes.result.message_id }); })());
    
    // 6. 更新或发送汇总话题中的卡片
    ctx.waitUntil(triggerNotification(msg.from, rec.thread_id, env, getPreview(msg), fRes.result.message_id));
  }
}

/**
 * 逻辑 B：更新汇总卡片
 * 在指定汇总话题中显示最新消息详情，并动态展示按钮
 */
async function triggerNotification(from, userThreadId, env, preview, lastId) {
  const userId = from.id;
  const cardKey = `c:${userId}`; // 卡片消息 ID 的存储键
  
  // 检查是否存在汇总话题，不存在则创建
  let todoId = await env.TOPIC_MAP.get("sys:todo_id");
  if (!todoId) {
    const res = await tgCall(env, "createForumTopic", { chat_id: env.SUPERGROUP_ID, name: "📬 新消息" });
    if (res.ok) { 
        todoId = res.result.message_thread_id.toString(); 
        await env.TOPIC_MAP.put("sys:todo_id", todoId); 
    }
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "用户";
  const safeName = name.replace(/[<>]/g, ""); // 转义 HTML 标签
  const adminMention = env.ADMIN_ID ? `<a href="tg://user?id=${env.ADMIN_ID}">@管理员</a>` : "<b>管理员</b>";

  // 构建卡片文字内容
  let text = `🎯 <b>新消息提醒</b>\n\n👤 <b>用户</b>: ${safeName}\n`;
  if (from.username) text += `🆔 <b>账号</b>: @${from.username}\n`;
  else text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
  text += `💬 <b>内容</b>: ${preview.replace(/[<>]/g, "")}\n\n📢 呼叫 ${adminMention} [待处理]`;

  // 构建跳转链接
  const cleanId = env.SUPERGROUP_ID.toString().replace("-100", "");
  const jumpUrl = `https://t.me/c/${cleanId}/${lastId}?thread=${userThreadId}`;
  
  // 动态按钮组：没有 username 的用户不显示资料按钮
  const row1 = [{ text: "🚀 跳转话题", url: jumpUrl }];
  if (from.username) row1.push({ text: "👤 资料/私聊", url: `https://t.me/${from.username}` });
  const kb = { inline_keyboard: [ row1, [{ text: "🗑️ 忽略卡片", callback_data: `del:${userId}` }] ] };

  // 尝试编辑旧卡片消息，实现内容覆盖，避免刷屏
  const cardId = await env.TOPIC_MAP.get(cardKey);
  if (cardId) {
    const edit = await tgCall(env, "editMessageText", { chat_id: env.SUPERGROUP_ID, message_id: Number(cardId), text, parse_mode: "HTML", reply_markup: kb });
    if (edit.ok) return;
  }

  // 发送新卡片并存入 KV
  const res = await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: todoId ? Number(todoId) : undefined, text, parse_mode: "HTML", reply_markup: kb });
  if (res.ok) await env.TOPIC_MAP.put(cardKey, res.result.message_id.toString());
}

/**
 * 逻辑 C：管理员在群内回复
 * 支持：/ban 封禁、/unban 解封、正常消息转发
 */
async function handleAdminReply(msg, env, ctx) {
  const tid = msg.message_thread_id.toString();
  if (tid === await env.TOPIC_MAP.get("sys:todo_id")) return; // 汇总话题内的普通讨论不处理
  
  const uid = await env.TOPIC_MAP.get(`t:${tid}`);
  if (!uid) return;

  const cmd = msg.text?.trim();
  if (cmd === "/ban") {
    await env.TOPIC_MAP.put(`ban:${uid}`, "1");
    await tgCall(env, "editForumTopic", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(tid), name: `🚫 已封禁-${uid}` });
    return await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(tid), text: "👤 用户已被封禁" });
  }
  if (cmd === "/unban") {
    await env.TOPIC_MAP.delete(`ban:${uid}`);
    await tgCall(env, "editForumTopic", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(tid), name: `访客-${uid}` });
    return await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(tid), text: "✅ 用户已解封" });
  }

  // 回复即视为处理完毕，清理对应的汇总卡片
  const cid = await env.TOPIC_MAP.get(`c:${uid}`);
  if (cid) { 
    await tgCall(env, "deleteMessage", { chat_id: env.SUPERGROUP_ID, message_id: Number(cid) }); 
    await env.TOPIC_MAP.delete(`c:${uid}`); 
  }

  // 转发管理员的消息给用户
  await sendBot(msg, uid, null, env);
}

/**
 * 万能转发工具：支持文字、图片、视频、文件、语音和贴纸
 */
async function sendBot(msg, target, thread, env) {
  const c = { chat_id: target, message_thread_id: thread ? Number(thread) : undefined };
  if (msg.text) return await tgCall(env, "sendMessage", { ...c, text: msg.text });
  if (msg.photo) return await tgCall(env, "sendPhoto", { ...c, photo: msg.photo.pop().file_id, caption: msg.caption });
  if (msg.video) return await tgCall(env, "sendVideo", { ...c, video: msg.video.file_id, caption: msg.caption });
  if (msg.voice) return await tgCall(env, "sendVoice", { ...c, voice: msg.voice.file_id });
  if (msg.document) return await tgCall(env, "sendDocument", { ...c, document: msg.document.file_id, caption: msg.caption });
  if (msg.sticker) return await tgCall(env, "sendSticker", { ...c, sticker: msg.sticker.file_id });
  return { ok: false };
}

/**
 * 辅助：生成简短的消息预览
 */
function getPreview(msg) {
  if (msg.text) return msg.text.substring(0, 30);
  if (msg.sticker) return "发送了贴纸 " + (msg.sticker.emoji || "");
  if (msg.photo) return "[图片消息]";
  return "[媒体消息]";
}

/**
 * 辅助：封装 Telegram API 的 Fetch 请求
 */
async function tgCall(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return await r.json();
}

/**
 * 辅助：处理按钮点击事件（验证、忽略卡片）
 */
async function handleCallback(query, env) {
  const data = query.data;
  // 忽略汇总卡片
  if (data.startsWith("del:")) {
    await tgCall(env, "deleteMessage", { chat_id: env.SUPERGROUP_ID, message_id: query.message.message_id });
    await env.TOPIC_MAP.delete(`c:${data.split(":")[1]}`);
  } 
  // 处理验证码点击
  else if (data.startsWith("v:")) {
    const [_, id, ans] = data.split(":");
    const correct = await env.TOPIC_MAP.get(`chal:${id}`);
    if (correct && ans === correct) {
      await env.TOPIC_MAP.put(`v:${query.from.id}`, "1", { expirationTtl: 2592000 }); // 验证有效期 30 天
      await tgCall(env, "editMessageText", { chat_id: query.from.id, message_id: query.message.message_id, text: "✅ 验证通过！" });
    } else {
      await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "❌ 错误" });
      await sendChallenge(query.from.id, env, query.message.message_id);
    }
  }
}

/**
 * 辅助：发送身份验证挑战题目
 */
async function sendChallenge(uid, env, editId = null) {
  const quiz = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  const id = Math.random().toString(36).substring(2, 10);
  await env.TOPIC_MAP.put(`chal:${id}`, quiz.answer, { expirationTtl: 300 });
  const kb = { inline_keyboard: [quiz.options.map(o => ({ text: o, callback_data: `v:${id}:${o}` }))] };
  const body = { chat_id: uid, text: `🛡 验证：<b>${quiz.question}</b>`, parse_mode: "HTML", reply_markup: kb };
  if (editId) await tgCall(env, "editMessageText", { ...body, message_id: editId });
  else await tgCall(env, "sendMessage", body);
}

/**
 * 辅助：注册 Webhook 与 设置 Bot 指令列表
 */
async function handleRegisterWebhook(request, env) {
  const domain = `https://${new URL(request.url).hostname}`;
  await tgCall(env, "setWebhook", { url: domain, allowed_updates: ["message", "callback_query"] });
  await tgCall(env, "setMyCommands", { commands: [
    { command: "start", description: "开始咨询" },
    { command: "ban", description: "封禁用户" },
    { command: "unban", description: "解封用户" }
  ]});
  return new Response("Webhook OK & Commands Set");
}
