// ============================================================
// Telegram 双向私聊机器人 (Cloudflare Worker 版)
// 功能：用户私聊 → 群组话题转发；管理员回复 → 私聊回传
// 特性：验证题防刷、封禁、结案、通知卡片、资料卡片等
// ============================================================

// ------------------------------------------------------------
// 1. 验证题库
// 用户首次使用必须答对一题才能开始咨询，防止机器人/恶意骚扰
// ------------------------------------------------------------
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
  { question: "地球的最大海洋是什么？", options: ["太平洋", "大西洋", "印度洋"], answer: "太平洋" },

  // 科学常识
  { question: "光速大约是多少？", options: ["30万公里/秒", "20万公里/秒", "10万公里/秒"], answer: "30万公里/秒" },
  { question: "声音在空气中的传播速度大约是多少？", options: ["340米/秒", "100米/秒", "1000米/秒"], answer: "340米/秒" },
  { question: "植物通过什么作用制造氧气？", options: ["光合作用", "呼吸作用", "蒸腾作用"], answer: "光合作用" },
  { question: "指南针的 N 极指向哪个方向？", options: ["北方", "南方", "西方"], answer: "北方" },
  { question: "干冰是哪种气体的固体形态？", options: ["二氧化碳", "氧气", "氢气"], answer: "二氧化碳" },
  { question: "电灯泡是谁发明的？", options: ["爱迪生", "贝尔", "特斯拉"], answer: "爱迪生" },
  { question: "钻石的主要成分是什么元素？", options: ["碳", "硅", "硫"], answer: "碳" },
  { question: "人体最大的器官是什么？", options: ["皮肤", "肝脏", "肺"], answer: "皮肤" },
  { question: "哪种金属在常温下是液态的？", options: ["汞（水银）", "铝", "铜"], answer: "汞（水银）" },
  { question: "酸雨主要是由哪种气体引起的？", options: ["二氧化硫", "氧气", "氮气"], answer: "二氧化硫" },

  // 历史文化
  { question: "四大发明不包括哪一项？", options: ["电报", "造纸术", "火药"], answer: "电报" },
  { question: "《西游记》中的唐僧共有几个徒弟？", options: ["3个", "4个", "2个"], answer: "3个" },
  { question: "“床前明月光”的下一句是什么？", options: ["疑是地上霜", "举头望明月", "低头思故乡"], answer: "疑是地上霜" },
  { question: "战国七雄不包括以下哪个国家？", options: ["晋国", "秦国", "齐国"], answer: "晋国" },
  { question: "万里长城的主要功能是什么？", options: ["军事防御", "交通运输", "旅游观光"], answer: "军事防御" },
  { question: "中国历史上第一个皇帝是谁？", options: ["秦始皇", "汉武帝", "唐太宗"], answer: "秦始皇" },
  { question: "奥林匹克发源于哪个国家？", options: ["希腊", "意大利", "美国"], answer: "希腊" },
  { question: "文艺复兴时期的《蒙娜丽莎》是谁的作品？", options: ["达芬奇", "梵高", "毕加索"], answer: "达芬奇" },
  { question: "被称为“乐圣”的音乐家是谁？", options: ["贝多芬", "莫扎特", "肖邦"], answer: "贝多芬" },
  { question: "莎士比亚是哪国的文学家？", options: ["英国", "法国", "德国"], answer: "英国" },

  // 生物与自然
  { question: "企鹅主要生活在地球的哪一端？", options: ["南极", "北极", "赤道"], answer: "南极" },
  { question: "世界上跑得最快的陆地动物是什么？", options: ["猎豹", "狮子", "羚羊"], answer: "猎豹" },
  { question: "哪种动物被称为“沙漠之舟”？", options: ["骆驼", "马", "驴"], answer: "骆驼" },
  { question: "蝴蝶的一生不经历哪个阶段？", options: ["胎生", "幼虫", "蛹"], answer: "胎生" },
  { question: "壁虎在遇到危险时会切断身体的哪个部位？", options: ["尾巴", "脚", "头"], answer: "尾巴" },
  { question: "大熊猫最喜欢的食物是什么？", options: ["竹子", "苹果", "香蕉"], answer: "竹子" },
  { question: "蝙蝠属于哪类动物？", options: ["哺乳动物", "鸟类", "爬行动物"], answer: "哺乳动物" },
  { question: "世界上最高的树是什么？", options: ["红杉", "松树", "杨树"], answer: "红杉" },
  { question: "蝉依靠什么发出声音？", options: ["腹部的鸣肌", "嘴巴", "翅膀摩擦"], answer: "腹部的鸣肌" },
  { question: "哪种花被称为“花中之王”？", options: ["牡丹", "玫瑰", "荷花"], answer: "牡丹" },

  // 逻辑与趣味
  { question: "1斤棉花和1斤铁哪个重？", options: ["一样重", "铁重", "棉花重"], answer: "一样重" },
  { question: "3个苹果，你拿走了2个，你现在有几个苹果？", options: ["2个", "1个", "3个"], answer: "2个" },
  { question: "一个正方形有4个角，切掉1个角还剩几个角？", options: ["5个", "3个", "4个"], answer: "5个" },
  { question: "冰变成水后，体积会发生什么变化？", options: ["变小", "变大", "不变"], answer: "变小" },
  { question: "24小时内，时针绕表盘转几圈？", options: ["2圈", "1圈", "24圈"], answer: "2圈" },
  { question: "如果今天星期五，那么3天后是星期几？", options: ["星期一", "星期日", "星期二"], answer: "星期一" },
  { question: "世界上最小的鸟是什么鸟？", options: ["蜂鸟", "麻雀", "燕子"], answer: "蜂鸟" },
  { question: "哪个月份天数最少？", options: ["2月", "1月", "4月"], answer: "2月" },
  { question: "人的脊椎骨共有多少块？", options: ["26块", "33块", "24块"], answer: "26块" },
  { question: "彩虹从外到内第一种颜色是什么？", options: ["红色", "紫色", "绿色"], answer: "红色" }
];

// ------------------------------------------------------------
// 2. 消息模板（集中管理，方便统一修改文案）
// ------------------------------------------------------------
const MSG = {
  ban: "🚫 <b>系统提示</b>\n您的账号已被禁止咨询！！！",
  success: "✅ <b>验证已生效</b>\n您现在可以直接发送消息，管理员看到后会第一时间回复您。",
  fail: "⚠️ <b>您仍有未完成的验证</b>\n请向上滚动回答刚才的问题，或等待 5 分钟失效后再试。",
  tempban: "🚫 您因连续答错已被禁用，请 30 分钟后再试",
  verified: "✨ <b>验证有效</b>\n您可以直接发送消息。",
  noCmd: "💡 <b>提示</b>\n用户端不支持指令操作，请直接描述您的问题。",
  closed: "🏁 咨询已结束，感谢支持。",
  banned: "🚫 <b>用户已封禁</b>",
  unbanned: "✅ <b>用户已解封</b>",
  closedAdmin: "✅ <b>已结案并释放缓存</b>",
  adminStart: "🔧 <b>管理模式已激活</b>\n请前往群里面处理用户消息。",
  adminHelp: "tg双向私聊机器人~",
  adminNoMsg: "请勿在此发消息，如需处理请前往群里面。"
};

// ------------------------------------------------------------
// 3. KV Key 前缀管理（避免写错字符串，便于维护）
// ------------------------------------------------------------
const KEY = {
  ban: (id) => `ban:${id}`,                 // 永久封禁
  verified: (id) => `v:${id}`,              // 已验证（7天有效）
  user: (id) => `u:${id}`,                  // 用户 → 话题映射
  thread: (id) => `t:${id}`,                // 话题 → 用户映射
  card: (id) => `c:${id}`,                  // 通知卡片 message_id
  challenge: (id) => `chal:${id}`,          // 验证题答案（5分钟）
  userChallenge: (id) => `user_chal:${id}`, // 用户当前正在做的题
  wrongCount: (id) => `wrong_count:${id}`,  // 答错次数（30分钟）
  tempban: (id) => `tempban:${id}`,         // 临时封禁（30分钟）
  tipLock: (id) => `tip_lock:${id}`,        // “已发送”提示限流（60秒）
  todoId: "sys:todo_id"                     // 汇总通知话题 ID
};

// 常用时间常量（单位：秒）
const SEVEN_DAYS = 7 * 24 * 3600;   // 验证有效期 7 天
const FIVE_MIN = 300;               // 验证题有效期 5 分钟
const THIRTY_MIN = 1800;            // 临时封禁 / 答错计数 30 分钟

// ============================================================
// 4. Worker 入口函数
// 负责分发 Webhook 请求到不同处理逻辑
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 特殊路径：注册 Webhook 和菜单指令
    if (url.pathname === "/registerWebhook") {
      return await handleRegisterWebhook(request, env);
    }

    // 基础环境变量检查
    if (!env.BOT_TOKEN || !env.SUPERGROUP_ID || !env.TOPIC_MAP) {
      return new Response("Config Error");
    }

    // 只处理 POST 请求（Telegram Webhook）
    if (request.method !== "POST") return new Response("OK");

    // 解析 Update
    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("OK");
    }

    // 处理按钮回调（验证题点击 / 删除卡片）
    if (update.callback_query) {
      await handleCallback(update.callback_query, env);
      return new Response("OK");
    }

    const msg = update.message;
    if (!msg) return new Response("OK");

    // 私聊消息 → 转发给群组话题
    if (msg.chat?.type === "private") {
      ctx.waitUntil(handlePrivate(msg, env, ctx));
    }
    // 群组话题消息 → 转发给对应用户
    else if (String(msg.chat?.id) === String(env.SUPERGROUP_ID)) {
      if (msg.message_thread_id) {
        ctx.waitUntil(handleAdminReply(msg, env, ctx));
      }
    }

    return new Response("OK");
  }
};

// ============================================================
// 5. 处理用户私聊消息
// 核心流程：验证拦截 → 创建/获取话题 → 转发消息 → 发送通知卡片
// ============================================================
async function handlePrivate(msg, env, ctx) {
  const userId = msg.chat.id;
  const isAdmin = env.ADMIN_ID && String(userId) === String(env.ADMIN_ID);

  // ---------- 管理员私聊特殊处理 ----------
  if (isAdmin) {
    if (msg.text === "/start") {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.adminStart,
        parse_mode: "HTML"
      });
    }
    if (msg.text === "/help") {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.adminHelp,
        parse_mode: "HTML"
      });
    }
    // 管理员在私聊发其他内容直接提示去群里处理
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.adminNoMsg,
      parse_mode: "HTML"
    });
  }

  // ---------- 并行读取用户状态（性能优化） ----------
  const [isBanned, isVerified, activeChallengeId, rec] = await Promise.all([
    env.TOPIC_MAP.get(KEY.ban(userId)),
    env.TOPIC_MAP.get(KEY.verified(userId)),
    env.TOPIC_MAP.get(KEY.userChallenge(userId)),
    env.TOPIC_MAP.get(KEY.user(userId), { type: "json" })
  ]);

  // ---------- /start 指令处理 ----------
  if (msg.text === "/start") {
    if (isBanned) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.ban,
        parse_mode: "HTML"
      });
    }
    if (isVerified) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.success,
        parse_mode: "HTML"
      });
    }
    // 已有未完成的验证题
    if (activeChallengeId) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.fail,
        parse_mode: "HTML"
      });
    }
    // 新用户 → 发送验证题
    return sendChallenge(userId, env);
  }

  // ---------- 普通消息拦截 ----------
  if (isBanned) {
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.ban,
      parse_mode: "HTML"
    });
  }
  // 未验证用户强制验证
  if (!isVerified) {
    return sendChallenge(userId, env);
  }

  // ---------- 确保用户在群组中有对应话题 ----------
  let userRec = rec;
  if (!userRec) {
    // 构建话题名称：昵称 + @username + 用户ID
    const displayName = [msg.from.first_name, msg.from.last_name]
      .filter(Boolean)
      .join(" ")
      .replace(/[<>]/g, "") || "用户";
    const uname = msg.from.username ? ` @${msg.from.username}` : "";
    const topicName = `${displayName}${uname} | ${userId}`.substring(0, 60);

    // 创建论坛话题
    const res = await tgCall(env, "createForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      name: topicName
    });

    if (res.ok) {
      userRec = {
        thread_id: res.result.message_thread_id.toString(),
        original_name: topicName          // 保存原名，方便 /close 时使用
      };
      // 双向映射写入 KV
      await Promise.all([
        env.TOPIC_MAP.put(KEY.user(userId), JSON.stringify(userRec)),
        env.TOPIC_MAP.put(KEY.thread(userRec.thread_id), userId.toString())
      ]);
      // 异步发送用户资料卡片（不阻塞主流程）
      ctx.waitUntil(sendUserProfileCard(msg.from, userRec.thread_id, env, topicName));
    } else {
      // 创建话题失败，直接返回，避免后续报错
      return;
    }
  }

  // ---------- 媒体组延迟（防止多图连发顺序错乱） ----------
  // 普通文字消息立即转发，只有 media_group 才延迟
  if (msg.media_group_id) {
    await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 1600)));
  }

  // ---------- 转发用户消息到对应话题 ----------
  const fRes = await sendBot(msg, env.SUPERGROUP_ID, userRec.thread_id, env);

  if (fRes.ok) {
    // 更新/创建汇总通知卡片（异步）
    ctx.waitUntil(
      triggerNotification(msg.from, userRec.thread_id, env, getPreview(msg), fRes.result.message_id)
    );

    // “已发送”提示限流：60秒内只发一次，并自动删除
    const tipKey = KEY.tipLock(userId);
    if (!(await env.TOPIC_MAP.get(tipKey))) {
      await env.TOPIC_MAP.put(tipKey, "1", { expirationTtl: 60 });
      const tipRes = await tgCall(env, "sendMessage", {
        chat_id: userId,
        text: "✅ <b>已发送</b>",
        parse_mode: "HTML"
      });
      if (tipRes.ok) {
        // 2秒后自动删除提示消息
        ctx.waitUntil((async () => {
          await new Promise(r => setTimeout(r, 2000));
          await tgCall(env, "deleteMessage", {
            chat_id: userId,
            message_id: tipRes.result.message_id
          });
        })());
      }
    }
  }
}

// ============================================================
// 6. 发送用户资料卡片（首次创建话题时）
// ============================================================
async function sendUserProfileCard(user, threadId, env, originalName = "") {
  const chatId = env.SUPERGROUP_ID;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "用户";
  const username = user.username ? `@${user.username}` : "无";
  const userId = user.id;

  let text = `📇 <b>用户资料卡片</b>\n\n`;
  text += `👤 <b>昵称</b>: ${displayName}\n`;
  text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
  text += `🔗 <b>账号</b>: ${username}\n`;
  text += `💬 <b>话题名</b>: ${originalName}\n`;

  // 尝试获取用户头像
  let photoId = null;
  try {
    const res = await tgCall(env, "getUserProfilePhotos", { user_id: userId, limit: 1 });
    if (res.ok && res.result.total_count > 0) {
      const sizes = res.result.photos[0];
      photoId = sizes[sizes.length - 1].file_id; // 取最大尺寸
    }
  } catch (e) {
    console.log("获取头像失败", e);
  }

  // 有头像发图片，没有则发纯文字
  if (photoId) {
    await tgCall(env, "sendPhoto", {
      chat_id: chatId,
      message_thread_id: Number(threadId),
      photo: photoId,
      caption: text,
      parse_mode: "HTML"
    });
  } else {
    await tgCall(env, "sendMessage", {
      chat_id: chatId,
      message_thread_id: Number(threadId),
      text,
      parse_mode: "HTML"
    });
  }
}

// ============================================================
// 7. 汇总通知卡片（新消息提醒）
// 首次创建会 @管理员，后续只更新内容
// ============================================================
async function triggerNotification(from, userThreadId, env, preview, lastId) {
  const userId = from.id;
  const cardKey = KEY.card(userId);

  // 轻微随机延迟，降低并发时产生多张卡片的概率
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 400)));

  // 获取或创建“📬 新消息”汇总话题
  let todoId = await env.TOPIC_MAP.get(KEY.todoId);
  if (!todoId) {
    const res = await tgCall(env, "createForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      name: "📬 新消息"
    });
    if (res.ok) {
      todoId = res.result.message_thread_id.toString();
      await env.TOPIC_MAP.put(KEY.todoId, todoId);
    }
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "用户";
  const safeName = name.replace(/[<>]/g, "");

  let cardId = await env.TOPIC_MAP.get(cardKey);

  // 构建卡片文字
  let text = `🎯 <b>新消息提醒</b>\n\n👤 <b>用户</b>: ${safeName}\n`;
  if (from.username) text += `🆔 <b>账号</b>: @${from.username}\n`;
  else text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
  text += `💬 <b>内容</b>: ${preview.replace(/[<>]/g, "")}\n\n`;

  if (cardId) {
    text += `🔔 状态: [追加消息]`;
  } else {
    // 首次创建时 @管理员
    const adminMention = env.ADMIN_ID
      ? `<a href="tg://user?id=${env.ADMIN_ID}">@管理员</a>`
      : "<b>管理员</b>";
    text += `📢 呼叫 ${adminMention} [待处理]`;
  }

  // 跳转链接
  const cleanId = env.SUPERGROUP_ID.toString().replace("-100", "");
  const jumpUrl = `https://t.me/c/${cleanId}/${lastId}?thread=${userThreadId}`;

  const kb = {
    inline_keyboard: [
      [
        { text: "🚀 跳转话题", url: jumpUrl },
        ...(from.username ? [{ text: "👤 资料", url: `https://t.me/${from.username}` }] : [])
      ],
      [{ text: "🗑️ 忽略卡片", callback_data: `del:${userId}` }]
    ]
  };

  // 尝试编辑已有卡片
  if (cardId) {
    const edit = await tgCall(env, "editMessageText", {
      chat_id: env.SUPERGROUP_ID,
      message_id: Number(cardId),
      text,
      parse_mode: "HTML",
      reply_markup: kb,
      disable_notification: true
    });
    if (edit.ok) return; // 编辑成功就结束
  }

  // 卡片不存在或已被删除 → 新建
  const res = await tgCall(env, "sendMessage", {
    chat_id: env.SUPERGROUP_ID,
    message_thread_id: todoId ? Number(todoId) : undefined,
    text,
    parse_mode: "HTML",
    reply_markup: kb
  });
  if (res.ok) {
    await env.TOPIC_MAP.put(cardKey, res.result.message_id.toString());
  }
}

// ============================================================
// 8. 处理管理员在群组话题中的回复
// 支持 /ban、/unban、/close 指令，以及普通消息转发
// ============================================================
async function handleAdminReply(msg, env, ctx) {
  const tid = msg.message_thread_id.toString();

  // 汇总话题内的普通交流不转发
  if (tid === (await env.TOPIC_MAP.get(KEY.todoId))) return;

  // 根据话题 ID 找到对应用户
  const uid = await env.TOPIC_MAP.get(KEY.thread(tid));
  if (!uid) return;

  // 管理员权限二次校验（推荐开启）
  const isAdmin = !env.ADMIN_ID || String(msg.from.id) === String(env.ADMIN_ID);
  if (!isAdmin) return;

  const cmd = msg.text?.trim() || "";

  // ---------- /ban 永久封禁 ----------
  if (/^\/ban/.test(cmd)) {
    await env.TOPIC_MAP.put(KEY.ban(uid), "1");
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.banned,
      parse_mode: "HTML"
    });
  }

  // ---------- /unban 解封 ----------
  if (/^\/unban/.test(cmd)) {
    await env.TOPIC_MAP.delete(KEY.ban(uid));
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.unbanned,
      parse_mode: "HTML"
    });
  }

  // ---------- /close 结案 ----------
  if (/^\/close/.test(cmd)) {
    const rec = await env.TOPIC_MAP.get(KEY.user(uid), { type: "json" });
    const name = rec?.original_name || uid;

    // 修改话题名称标记已结案
    await tgCall(env, "editForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      name: `[已结案] ${name}`.substring(0, 60)
    });

    // 尝试真正关闭话题（需要 Bot 有 close 权限）
    await tgCall(env, "closeForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid)
    }).catch(() => {}); // 权限不足时忽略错误

    // 清理所有相关 KV 缓存
    await Promise.all([
      env.TOPIC_MAP.delete(KEY.user(uid)),
      env.TOPIC_MAP.delete(KEY.thread(tid)),
      env.TOPIC_MAP.delete(KEY.card(uid))
    ]);

    // 通知用户 + 群内确认
    await tgCall(env, "sendMessage", {
      chat_id: uid,
      text: MSG.closed
    });
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.closedAdmin,
      parse_mode: "HTML"
    });
  }

  // ---------- 屏蔽用户端指令 ----------
  if (/^\//.test(cmd)) {
    if (/^\/start/.test(cmd)) {
      const isVerified = await env.TOPIC_MAP.get(KEY.verified(uid));
      if (isVerified) {
        return tgCall(env, "sendMessage", {
          chat_id: uid,
          text: MSG.verified,
          parse_mode: "HTML"
        });
      }
    } else {
      return tgCall(env, "sendMessage", {
        chat_id: uid,
        text: MSG.noCmd,
        parse_mode: "HTML"
      });
    }
  }

  // ---------- 管理员开始回复 → 删除通知卡片 ----------
  const cid = await env.TOPIC_MAP.get(KEY.card(uid));
  if (cid) {
    await tgCall(env, "deleteMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_id: Number(cid)
    });
    await env.TOPIC_MAP.delete(KEY.card(uid));
  }

  // 滚动延长用户验证有效期（保持会话活跃）
  await env.TOPIC_MAP.put(KEY.verified(uid), "1", { expirationTtl: SEVEN_DAYS });

  // 转发管理员消息给用户
  await sendBot(msg, uid, null, env);
}

// ============================================================
// 9. 通用消息转发函数
// 支持文字、图片、视频、动画、语音、文件、位置、联系人等
// ============================================================
async function sendBot(msg, target, thread, env) {
  const base = {
    chat_id: target,
    message_thread_id: thread ? Number(thread) : undefined
  };

  // 文字消息（保留 entities 格式）
  if (msg.text) {
    return tgCall(env, "sendMessage", {
      ...base,
      text: msg.text,
      entities: msg.entities,
      parse_mode: msg.entities ? undefined : "HTML"
    });
  }

  // 图片（取最大尺寸）
  if (msg.photo) {
    return tgCall(env, "sendPhoto", {
      ...base,
      photo: msg.photo[msg.photo.length - 1].file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities,
      parse_mode: msg.caption_entities ? undefined : "HTML"
    });
  }

  // 视频
  if (msg.video) {
    return tgCall(env, "sendVideo", {
      ...base,
      video: msg.video.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities,
      parse_mode: msg.caption_entities ? undefined : "HTML"
    });
  }

  // 动画 / GIF
  if (msg.animation) {
    return tgCall(env, "sendAnimation", {
      ...base,
      animation: msg.animation.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities
    });
  }

  // 视频笔记（圆形视频）
  if (msg.video_note) {
    return tgCall(env, "sendVideoNote", {
      ...base,
      video_note: msg.video_note.file_id
    });
  }

  // 贴纸
  if (msg.sticker) {
    return tgCall(env, "sendSticker", {
      ...base,
      sticker: msg.sticker.file_id
    });
  }

  // 语音
  if (msg.voice) {
    return tgCall(env, "sendVoice", {
      ...base,
      voice: msg.voice.file_id,
      caption: msg.caption
    });
  }

  // 音频文件
  if (msg.audio) {
    return tgCall(env, "sendAudio", {
      ...base,
      audio: msg.audio.file_id,
      caption: msg.caption
    });
  }

  // 普通文件
  if (msg.document) {
    return tgCall(env, "sendDocument", {
      ...base,
      document: msg.document.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities
    });
  }

  // 位置
  if (msg.location) {
    return tgCall(env, "sendLocation", {
      ...base,
      latitude: msg.location.latitude,
      longitude: msg.location.longitude
    });
  }

  // 联系人
  if (msg.contact) {
    return tgCall(env, "sendContact", {
      ...base,
      phone_number: msg.contact.phone_number,
      first_name: msg.contact.first_name,
      last_name: msg.contact.last_name
    });
  }

  // 不支持的类型
  return { ok: false };
}

// ============================================================
// 10. 处理按钮回调（验证题点击 / 删除通知卡片）
// ============================================================
async function handleCallback(query, env) {
  const data = query.data;
  const userId = query.from.id;

  // ---------- 删除通知卡片 ----------
  if (data.startsWith("del:")) {
    await tgCall(env, "deleteMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_id: query.message.message_id
    });
    await env.TOPIC_MAP.delete(KEY.card(data.split(":")[1]));
    return;
  }

  // ---------- 验证题点击处理 ----------
  if (data.startsWith("v:")) {
    const [, cid, ans] = data.split(":");
    const correct = await env.TOPIC_MAP.get(KEY.challenge(cid));

    // 无论对错，立即销毁本次挑战（防止重复提交）
    await Promise.all([
      env.TOPIC_MAP.delete(KEY.challenge(cid)),
      env.TOPIC_MAP.delete(KEY.userChallenge(userId))
    ]);

    // 检查是否已被临时封禁
    const isTempBanned = await env.TOPIC_MAP.get(KEY.tempban(userId));
    if (isTempBanned) {
      await tgCall(env, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: MSG.tempban,
        show_alert: true
      });
      return;
    }

    if (correct && ans === correct) {
      // ✅ 验证成功
      await env.TOPIC_MAP.put(KEY.verified(userId), "1", { expirationTtl: SEVEN_DAYS });
      await env.TOPIC_MAP.delete(KEY.wrongCount(userId)); // 清空错误计数
      await tgCall(env, "editMessageText", {
        chat_id: userId,
        message_id: query.message.message_id,
        text: "✅ <b>验证通过！</b>",
        parse_mode: "HTML"
      });
    } else {
      // ❌ 验证失败
      let wrongCount = parseInt(await env.TOPIC_MAP.get(KEY.wrongCount(userId)) || "0", 10);
      wrongCount += 1;
      await env.TOPIC_MAP.put(KEY.wrongCount(userId), wrongCount.toString(), {
        expirationTtl: THIRTY_MIN
      });

      if (wrongCount >= 3) {
        // 连续错 3 次 → 临时封禁 30 分钟
        await env.TOPIC_MAP.put(KEY.tempban(userId), "1", { expirationTtl: THIRTY_MIN });
        await env.TOPIC_MAP.delete(KEY.wrongCount(userId));
        await tgCall(env, "editMessageText", {
          chat_id: userId,
          message_id: query.message.message_id,
          text: MSG.tempban,
          parse_mode: "HTML"
        });
      } else {
        // 提示错误次数并刷新新题
        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: `❌ 验证失败，请重新回答 (错误 ${wrongCount}/3)`,
          show_alert: true
        });
        await sendChallenge(userId, env, query.message.message_id);
      }
    }
  }
}

// ============================================================
// 11. 发送 / 刷新验证题
// ============================================================
async function sendChallenge(uid, env, editId = null) {
  // 临时封禁检查
  const isTempBanned = await env.TOPIC_MAP.get(KEY.tempban(uid));
  if (isTempBanned) {
    const text = MSG.tempban;
    if (editId) {
      await tgCall(env, "editMessageText", {
        chat_id: uid,
        message_id: editId,
        text,
        parse_mode: "HTML"
      });
    } else {
      await tgCall(env, "sendMessage", {
        chat_id: uid,
        text,
        parse_mode: "HTML"
      });
    }
    return;
  }

  // 随机抽取一道题
  const quiz = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  const id = Math.random().toString(36).substring(2, 10); // 随机挑战 ID

  // 写入挑战数据（5分钟过期）
  await Promise.all([
    env.TOPIC_MAP.put(KEY.challenge(id), quiz.answer, { expirationTtl: FIVE_MIN }),
    env.TOPIC_MAP.put(KEY.userChallenge(uid), id, { expirationTtl: FIVE_MIN })
  ]);

  // 构建按钮
  const kb = {
    inline_keyboard: [quiz.options.map(o => ({ text: o, callback_data: `v:${id}:${o}` }))]
  };
  const text = `🛡 <b>身份验证</b>\n请选择正确答案以继续：\n\n问题：<b>${quiz.question}</b>`;

  // 编辑现有消息 or 发送新消息
  if (editId) {
    await tgCall(env, "editMessageText", {
      chat_id: uid,
      message_id: editId,
      text,
      parse_mode: "HTML",
      reply_markup: kb
    });
  } else {
    await tgCall(env, "sendMessage", {
      chat_id: uid,
      text,
      parse_mode: "HTML",
      reply_markup: kb
    });
  }
}

// ============================================================
// 12. 生成消息预览摘要（用于通知卡片）
// ============================================================
function getPreview(msg) {
  if (!msg) return "[未知消息]";
  if (msg.text) return msg.text.substring(0, 30);
  if (msg.sticker) return "📌 发送了贴纸 " + (msg.sticker.emoji || "");
  if (msg.photo) return "🖼️ [图片消息]";
  if (msg.video) return "🎬 [视频消息]";
  if (msg.video_note) return "🎥 [视频通话消息]";
  if (msg.animation) return "🎞️ [动画/GIF]";
  if (msg.voice) return "🎤 [语音消息]";
  if (msg.audio) return "🎵 [音频文件]";
  if (msg.document) return "📄 [文件: " + (msg.document.file_name || "未知") + "]";
  if (msg.location) return "📍 [位置消息]";
  if (msg.venue) return "📍 [地点消息]";
  if (msg.contact) return "📇 [联系人消息]";
  if (msg.poll) return "🗳️ [投票消息]";
  return "[媒体消息]";
}

// ============================================================
// 13. 注册 Webhook + 设置菜单指令
// 访问 /registerWebhook 即可完成初始化
// ============================================================
async function handleRegisterWebhook(request, env) {
  const domain = `https://${new URL(request.url).hostname}`;

  // 1. 设置 Webhook（并清空旧的 pending updates）
  await tgCall(env, "setWebhook", {
    url: domain,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true
  });

  // 2. 用户端私聊菜单（只显示 /start）
  await tgCall(env, "setMyCommands", {
    scope: { type: "all_private_chats" },
    commands: [
      { command: "start", description: "开始咨询 / 激活机器人" }
    ]
  });

  // 3. 群组管理菜单
  if (env.SUPERGROUP_ID) {
    await tgCall(env, "setMyCommands", {
      scope: { type: "chat", chat_id: env.SUPERGROUP_ID },
      commands: [
        { command: "ban", description: "封禁当前话题用户" },
        { command: "unban", description: "解封当前话题用户" },
        { command: "close", description: "关闭当前话题用户" }
      ]
    });
  }

  return new Response("Webhook & Commands Updated - Bot is Active");
}

// ============================================================
// 14. 底层 Telegram API 调用封装
// 统一处理错误日志，方便排查问题
// ============================================================
async function tgCall(env, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!data.ok) {
      console.error(`[TG Error] ${method}`, JSON.stringify(data));
    }
    return data;
  } catch (e) {
    console.error(`[Network Error] ${method}`, e);
    return { ok: false };
  }
}
