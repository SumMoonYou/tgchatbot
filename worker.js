// --- 1. 人工验证问题库 ---
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 【新增：自动化配置路由】 ---
    // 浏览器访问：https://你的域名.workers.dev/registerWebhook
    if (url.pathname === "/registerWebhook") {
      return await handleRegisterWebhook(request, env);
    }

    // 基础校验
    if (!env.BOT_TOKEN || !env.SUPERGROUP_ID || !env.TOPIC_MAP) {
      return new Response("Config Error: Missing Variables", { status: 500 });
    }

    // 处理来自 Telegram 的 POST Webhook
    if (request.method === "POST") {
      let update;
      try { update = await request.json(); } catch (e) { return new Response("OK"); }

      // 处理按钮点击回调
      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
        return new Response("OK");
      }

      const msg = update.message;
      if (!msg) return new Response("OK");

      const isAdmin = env.ADMIN_ID && String(msg.from.id) === String(env.ADMIN_ID);

      // A. 私聊场景
      if (msg.chat && msg.chat.type === "private") {
        if (isAdmin) {
          if (msg.text?.startsWith('/start')) {
            await tgCall(env, "sendMessage", { chat_id: msg.from.id, text: "🔧 <b>管理模式已激活</b>", parse_mode: "HTML" });
          }
          return new Response("OK");
        }
        ctx.waitUntil(handlePrivate(msg, env, ctx));
      } 
      // B. 群组话题场景
      else if (msg.chat && Number(msg.chat.id) === Number(env.SUPERGROUP_ID)) {
        if (msg.message_thread_id) ctx.waitUntil(handleAdminReply(msg, env, ctx));
      }
      return new Response("OK");
    }

    return new Response("Bot is running. Use /registerWebhook to setup.");
  }
};

/**
 * 自动化配置 Webhook 和 Bot 指令
 */
async function handleRegisterWebhook(request, env) {
  const url = new URL(request.url);
  const domain = `https://${url.hostname}`; // 自动获取当前 Worker 的域名
  
  // 1. 设置 Webhook：告诉 Telegram 把消息发到这个域名
  const setWebhook = await tgCall(env, "setWebhook", { 
    url: domain,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true // 绑定时丢弃之前的过期消息，防止刷屏
  });

  // 2. 设置机器人菜单指令
  const setCommands = await tgCall(env, "setMyCommands", {
    commands: [
      { command: "start", description: "开始咨询 / 完成验证" },
      { command: "ban", description: "管理员指令：封禁此用户" }
    ]
  });

  const responseBody = {
    status: (setWebhook.ok && setCommands.ok) ? "Success" : "Failed",
    webhook: setWebhook,
    commands: setCommands,
    domain_registered: domain,
    time: new Date().toISOString()
  };

  return new Response(JSON.stringify(responseBody, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * 处理私聊消息转发
 */
async function handlePrivate(msg, env, ctx) {
  const userId = msg.chat.id;
  const text = msg.text || "";

  // 拦截黑名单
  if (await env.TOPIC_MAP.get(`ban:${userId}`)) return;

  // 验证码校验
  if (!(await env.TOPIC_MAP.get(`v:${userId}`))) {
    return await sendChallenge(userId, env);
  }

  // 【过滤 /start 不转发】
  if (text.startsWith('/start')) {
    await tgCall(env, "sendMessage", { chat_id: userId, text: "🙏 <b>验证通过。</b>\n请发送您的问题。", parse_mode: "HTML" });
    return;
  }

  // 查找或创建话题
  let rec = await env.TOPIC_MAP.get(`u:${userId}`, { type: "json" });
  if (!rec) {
    const res = await tgCall(env, "createForumTopic", { chat_id: env.SUPERGROUP_ID, name: `${msg.from.first_name || "User"} (${userId})` });
    if (res.ok) {
      rec = { thread_id: res.result.message_thread_id.toString() };
      await env.TOPIC_MAP.put(`u:${userId}`, JSON.stringify(rec));
      await env.TOPIC_MAP.put(`t:${rec.thread_id}`, userId.toString());
    }
  }

  // 转发给管理员
  const fRes = await sendBot(msg, env.SUPERGROUP_ID, rec.thread_id, env);
  
  if (fRes.ok) {
    // 发送 3s 自毁回执
    const tipRes = await tgCall(env, "sendMessage", { chat_id: userId, text: "✅ <b>已发送</b>", parse_mode: "HTML" });
    if (tipRes.ok) {
      ctx.waitUntil((async () => {
        await new Promise(r => setTimeout(r, 3000));
        await tgCall(env, "deleteMessage", { chat_id: userId, message_id: tipRes.result.message_id });
      })());
    }
    // 触发汇总卡片 (防并发)
    ctx.waitUntil(triggerNotification(msg.from, rec.thread_id, env, getPreview(msg), fRes.result.message_id));
  }
}

/**
 * 汇总通知逻辑 (防并发 + HTML 提及)
 */
async function triggerNotification(from, userThreadId, env, preview, lastId) {
  const userId = from.id;
  const cardKey = `c:${userId}`;

  // 随机避让
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1200)));

  let todoId = await env.TOPIC_MAP.get("sys:todo_id");
  if (!todoId) {
    const res = await tgCall(env, "createForumTopic", { chat_id: env.SUPERGROUP_ID, name: "📫️ 新消息" });
    if (res.ok) {
      todoId = res.result.message_thread_id.toString();
      await env.TOPIC_MAP.put("sys:todo_id", todoId);
    }
  }

  const name = (from.first_name || "User").replace(/[<>]/g, ""); 
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const adminMention = env.ADMIN_ID ? `<a href="tg://user?id=${env.ADMIN_ID}">@管理员</a>` : "<b>管理员</b>";

  const text = `🎯 <b>新消息提醒</b>\n\n👤 <b>用户</b>: <code>${name}</code>\n⏰ <b>时间</b>: <code>${time}</code>\n💬 <b>内容</b>: <code>${preview.replace(/[<>]/g, "")}</code>\n\n📢 呼叫 ${adminMention}`;
  
  const cleanId = env.SUPERGROUP_ID.toString().replace("-100", "");
  const jumpUrl = `https://t.me/c/${cleanId}/${lastId}?thread=${userThreadId}`;
  const kb = { inline_keyboard: [[{ text: "🚀 跳转回复", url: jumpUrl }, { text: "🗑️ 忽略", callback_data: `del:${userId}` }]] };

  // 尝试编辑
  const cardId = await env.TOPIC_MAP.get(cardKey);
  if (cardId) {
    const editRes = await tgCall(env, "editMessageText", { chat_id: env.SUPERGROUP_ID, message_id: Number(cardId), text, parse_mode: "HTML", reply_markup: kb });
    if (editRes.ok) return;
  }

  // 二次校验并发送
  const finalCheck = await env.TOPIC_MAP.get(cardKey);
  if (finalCheck && finalCheck !== cardId) return;

  const res = await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(todoId), text, parse_mode: "HTML", reply_markup: kb });
  if (res.ok) await env.TOPIC_MAP.put(cardKey, res.result.message_id.toString());
}

/**
 * 管理员回复逻辑
 */
async function handleAdminReply(msg, env, ctx) {
  const tid = msg.message_thread_id.toString();
  if (tid === await env.TOPIC_MAP.get("sys:todo_id")) return;
  const uid = await env.TOPIC_MAP.get(`t:${tid}`);
  if (!uid) return;

  if (msg.text === "/ban") {
    await env.TOPIC_MAP.put(`ban:${uid}`, "1");
    return await tgCall(env, "editForumTopic", { chat_id: env.SUPERGROUP_ID, message_thread_id: Number(tid), name: `🚫 已封禁-${uid}` });
  }

  const cid = await env.TOPIC_MAP.get(`c:${uid}`);
  if (cid) {
    await tgCall(env, "deleteMessage", { chat_id: env.SUPERGROUP_ID, message_id: Number(cid) });
    await env.TOPIC_MAP.delete(`c:${uid}`);
  }
  await sendBot(msg, uid, null, env);
}

/**
 * 回调处理
 */
async function handleCallback(query, env) {
  const data = query.data;
  if (data.startsWith("del:")) {
    const uid = data.split(":")[1];
    await tgCall(env, "deleteMessage", { chat_id: env.SUPERGROUP_ID, message_id: query.message.message_id });
    await env.TOPIC_MAP.delete(`c:${uid}`);
  } 
  else if (data.startsWith("v:")) {
    const [_, id, ans] = data.split(":");
    const correct = await env.TOPIC_MAP.get(`chal:${id}`);
    if (correct && ans === correct) {
      await env.TOPIC_MAP.put(`v:${query.from.id}`, "1", { expirationTtl: 2592000 });
      await tgCall(env, "editMessageText", { chat_id: query.from.id, message_id: query.message.message_id, text: "✅ <b>验证通过！</b>", parse_mode: "HTML" });
    } else {
      await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "❌ 答案错误", show_alert: true });
    }
  }
}

/**
 * 发送验证题目
 */
async function sendChallenge(uid, env) {
  const quiz = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  const id = Math.random().toString(36).substring(2, 10);
  await env.TOPIC_MAP.put(`chal:${id}`, quiz.answer, { expirationTtl: 300 });
  const buttons = quiz.options.map(opt => ({ text: opt, callback_data: `v:${id}:${opt}` }));
  await tgCall(env, "sendMessage", { chat_id: uid, text: `🛡 验证：<b>${quiz.question}</b>`, parse_mode: "HTML", reply_markup: { inline_keyboard: [buttons] } });
}

/**
 * 发送/转发工具
 */
async function sendBot(msg, target, thread, env) {
  const c = { chat_id: target, message_thread_id: thread };
  if (msg.text) return await tgCall(env, "sendMessage", { ...c, text: msg.text });
  if (msg.photo) return await tgCall(env, "sendPhoto", { ...c, photo: msg.photo.pop().file_id, caption: msg.caption });
  if (msg.video) return await tgCall(env, "sendVideo", { ...c, video: msg.video.file_id, caption: msg.caption });
  if (msg.voice) return await tgCall(env, "sendVoice", { ...c, voice: msg.voice.file_id });
  if (msg.sticker) return await tgCall(env, "sendSticker", { ...c, sticker: msg.sticker.file_id });
  if (msg.document) return await tgCall(env, "sendDocument", { ...c, document: msg.document.file_id, caption: msg.caption });
  return { ok: false };
}

function getPreview(msg) {
  if (msg.text) return msg.text.substring(0, 35);
  if (msg.photo) return "[图片]";
  if (msg.video) return "[视频]";
  return "[媒体]";
}

async function tgCall(env, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { 
      method: "POST", headers: { "content-type": "application/json" }, 
      body: JSON.stringify(body) 
    });
    return await r.json();
  } catch (e) { return { ok: false }; }
}
