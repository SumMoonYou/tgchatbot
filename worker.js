// ============================================================
// Telegram 双向私聊机器人 (Cloudflare Worker 优化版)
// 功能：
//   用户私聊 → 群组话题转发
//   管理员回复 → 私聊回传
// 特性：
//   - 验证题防刷
//   - 封禁 / 解封
//   - 结案 (/close)
//   - 彻底删除话题 (/delete)
//   - 通知卡片 + 用户资料卡片
// 优化点：
//   1. 用户状态合并为单个 key (us:{uid})，大幅减少 KV 读写
//   2. 短路读取，按优先级检查
//   3. 减少不必要写入（验证有效期智能刷新、提示限流、通知节流）
//   4. 提供 /cleanup 清理旧版残留 key
//   5. /close 和 /delete 会彻底删除用户状态（用户下次需重新验证）
//   6. /close 和 /delete 时自动删除未处理的通知卡片
//   7. 用户首次消息时，资料卡片会稳定出现在话题最顶部
// ============================================================

// ------------------------------------------------------------
// 1. 验证题库
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
// 2. 消息模板
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
  deleted: "🗑️ <b>话题已彻底删除（含所有消息）</b>",
  deletedUser: "🏁 咨询话题已被管理员删除。",
  adminStart: "🔧 <b>管理模式已激活</b>\n请前往群里面处理用户消息。",
  adminHelp: "tg双向私聊机器人~",
  adminNoMsg: "请勿在此发消息，如需处理请前往群里面。"
};

// ------------------------------------------------------------
// 3. KV Key 设计（优化后仅保留必要 key）
// ------------------------------------------------------------
const KEY = {
  user: (id) => `us:${id}`,   // 用户完整状态（一个用户一条记录）
  thread: (id) => `t:${id}`,  // 话题 ID → 用户 ID（管理员回复时使用）
  todoId: "sys:todo_id"       // “📬 新消息”汇总话题 ID
};

// 时间常量（单位：秒）
const SEVEN_DAYS = 7 * 24 * 3600;   // 验证有效期
const FIVE_MIN = 300;               // 验证题有效期
const THIRTY_MIN = 1800;            // 临时封禁时间
const TIP_TTL = 60;                 // “已发送”提示限流
const NOTIFY_THROTTLE = 8;          // 通知卡片更新最小间隔

// ============================================================
// 4. 用户状态读写工具函数
// ============================================================

/**
 * 读取用户完整状态
 */
async function getState(env, uid) {
  const data = await env.TOPIC_MAP.get(KEY.user(uid), { type: "json" });
  return data || {};
}

/**
 * 保存用户状态（自动清理已过期的临时字段）
 */
async function saveState(env, uid, state) {
  const now = Math.floor(Date.now() / 1000);

  // 清理过期字段，减小存储体积
  if (state.verifiedUntil && state.verifiedUntil < now) delete state.verifiedUntil;
  if (state.tempbanUntil && state.tempbanUntil < now) delete state.tempbanUntil;
  if (state.tipUntil && state.tipUntil < now) delete state.tipUntil;
  if (state.chalUntil && state.chalUntil < now) {
    delete state.chalId;
    delete state.chalAnswer;
    delete state.chalUntil;
  }
  if (state.wrong && (!state.tempbanUntil || state.tempbanUntil < now)) {
    delete state.wrong;
  }

  await env.TOPIC_MAP.put(KEY.user(uid), JSON.stringify(state));
}

/**
 * 获取当前时间戳（秒）
 */
function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ============================================================
// 5. Worker 入口
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 注册 Webhook 和命令菜单
    if (url.pathname === "/registerWebhook") {
      return await handleRegisterWebhook(request, env);
    }

    // 清理旧版残留数据（需带密钥）
    if (url.pathname === "/cleanup") {
      return await handleCleanup(request, env);
    }

    // 基础配置检查
    if (!env.BOT_TOKEN || !env.SUPERGROUP_ID || !env.TOPIC_MAP) {
      return new Response("Config Error");
    }

    // 只处理 Telegram 的 POST 请求
    if (request.method !== "POST") return new Response("OK");

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("OK");
    }

    // 处理按钮回调
    if (update.callback_query) {
      await handleCallback(update.callback_query, env);
      return new Response("OK");
    }

    const msg = update.message;
    if (!msg) return new Response("OK");

    // 私聊消息
    if (msg.chat?.type === "private") {
      ctx.waitUntil(handlePrivate(msg, env, ctx));
    }
    // 超级群话题消息
    else if (String(msg.chat?.id) === String(env.SUPERGROUP_ID)) {
      if (msg.message_thread_id) {
        ctx.waitUntil(handleAdminReply(msg, env, ctx));
      }
    }

    return new Response("OK");
  }
};

// ============================================================
// 6. 处理用户私聊消息
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
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.adminNoMsg,
      parse_mode: "HTML"
    });
  }

  // ---------- 一次读取完整用户状态（核心优化） ----------
  let state = await getState(env, userId);
  const now = nowSec();

  // 1. 永久封禁检查（最高优先级）
  if (state.ban) {
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.ban,
      parse_mode: "HTML"
    });
  }

  // 2. 临时封禁检查
  if (state.tempbanUntil && state.tempbanUntil > now) {
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.tempban,
      parse_mode: "HTML"
    });
  }

  // ---------- /start 指令 ----------
  if (msg.text === "/start") {
    if (state.verifiedUntil && state.verifiedUntil > now) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.success,
        parse_mode: "HTML"
      });
    }
    if (state.chalId && state.chalUntil > now) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.fail,
        parse_mode: "HTML"
      });
    }
    return sendChallenge(userId, env, state);
  }

  // 3. 未验证用户强制验证
  if (!state.verifiedUntil || state.verifiedUntil <= now) {
    return sendChallenge(userId, env, state);
  }

  // ---------- 确保用户已有对应话题 ----------
  if (!state.thread_id) {
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

    if (!res.ok) return; // 创建失败直接退出

    state.thread_id = res.result.message_thread_id.toString();
    state.original_name = topicName;

    // 写入用户状态 + 反向映射
    await Promise.all([
      saveState(env, userId, state),
      env.TOPIC_MAP.put(KEY.thread(state.thread_id), userId.toString())
    ]);

    // 等待资料卡片发送完成，确保它排在话题最顶部
    await sendUserProfileCard(msg.from, state.thread_id, env, topicName);
  }

  // 媒体组消息轻微延迟，防止顺序错乱
  if (msg.media_group_id) {
    await new Promise(r => setTimeout(r, 300 + Math.floor(Math.random() * 1200)));
  }

  // 转发用户消息到对应话题
  const fRes = await sendBot(msg, env.SUPERGROUP_ID, state.thread_id, env);

  if (fRes.ok) {
    // 更新通知卡片（带节流）
    ctx.waitUntil(
      triggerNotification(msg.from, state.thread_id, env, getPreview(msg), fRes.result.message_id, state)
    );

    // “已发送”提示限流（60秒内只提示一次）
    if (!state.tipUntil || state.tipUntil <= now) {
      state.tipUntil = now + TIP_TTL;
      await saveState(env, userId, state);

      const tipRes = await tgCall(env, "sendMessage", {
        chat_id: userId,
        text: "✅ <b>已发送</b>",
        parse_mode: "HTML"
      });

      if (tipRes.ok) {
        // 2秒后自动删除提示
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
// 7. 发送用户资料卡片（创建话题时）
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
      photoId = sizes[sizes.length - 1].file_id;
    }
  } catch (e) {}

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
// 8. 汇总通知卡片（带节流）
// ============================================================
async function triggerNotification(from, userThreadId, env, preview, lastId, state) {
  const userId = from.id;
  const now = nowSec();

  // 通知卡片更新节流
  if (state.lastNotify && (now - state.lastNotify) < NOTIFY_THROTTLE) return;

  // 轻微随机延迟，降低并发冲突
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300)));

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

  let text = `🎯 <b>新消息提醒</b>\n\n👤 <b>用户</b>: ${safeName}\n`;
  if (from.username) text += `🆔 <b>账号</b>: @${from.username}\n`;
  else text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
  text += `💬 <b>内容</b>: ${preview.replace(/[<>]/g, "")}\n\n`;

  const cardId = state.card_id;
  if (cardId) {
    text += `🔔 状态: [追加消息]`;
  } else {
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
    if (edit.ok) {
      state.lastNotify = now;
      await saveState(env, userId, state);
      return;
    }
  }

  // 新建卡片
  const res = await tgCall(env, "sendMessage", {
    chat_id: env.SUPERGROUP_ID,
    message_thread_id: todoId ? Number(todoId) : undefined,
    text,
    parse_mode: "HTML",
    reply_markup: kb
  });

  if (res.ok) {
    state.card_id = res.result.message_id.toString();
    state.lastNotify = now;
    await saveState(env, userId, state);
  }
}

// ============================================================
// 9. 处理管理员在话题中的回复
// ============================================================
async function handleAdminReply(msg, env, ctx) {
  const tid = msg.message_thread_id.toString();

  // 汇总话题内的消息不转发
  if (tid === (await env.TOPIC_MAP.get(KEY.todoId))) return;

  // 根据话题找到对应用户
  const uid = await env.TOPIC_MAP.get(KEY.thread(tid));
  if (!uid) return;

  // 管理员权限校验
  const isAdmin = !env.ADMIN_ID || String(msg.from.id) === String(env.ADMIN_ID);
  if (!isAdmin) return;

  const cmd = msg.text?.trim() || "";
  let state = await getState(env, uid);
  const now = nowSec();

  // ---------- /ban 永久封禁 ----------
  if (/^\/ban/.test(cmd)) {
    state.ban = true;
    await saveState(env, uid, state);
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.banned,
      parse_mode: "HTML"
    });
  }

  // ---------- /unban 解封 ----------
  if (/^\/unban/.test(cmd)) {
    delete state.ban;
    await saveState(env, uid, state);
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.unbanned,
      parse_mode: "HTML"
    });
  }

  // ---------- /close 结案（彻底删除用户状态 + 通知卡片） ----------
  if (/^\/close/.test(cmd)) {
    const name = state.original_name || uid;

    // 如果有未处理的通知卡片，先删掉
    if (state.card_id) {
      await tgCall(env, "deleteMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_id: Number(state.card_id)
      }).catch(() => {});
    }

    // 修改话题名称
    await tgCall(env, "editForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      name: `[已结案] ${name}`.substring(0, 60)
    });

    // 关闭话题
    await tgCall(env, "closeForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid)
    }).catch(() => {});

    // 彻底删除用户状态 + 话题映射（B 方案）
    await Promise.all([
      env.TOPIC_MAP.delete(KEY.user(uid)),
      env.TOPIC_MAP.delete(KEY.thread(tid))
    ]);

    // 通知用户 + 群内确认
    await tgCall(env, "sendMessage", { chat_id: uid, text: MSG.closed });
    return tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.closedAdmin,
      parse_mode: "HTML"
    });
  }

  // ---------- /delete 彻底删除话题（同时删除通知卡片） ----------
  if (/^\/delete/.test(cmd)) {
    // 1. 先通知用户
    await tgCall(env, "sendMessage", {
      chat_id: uid,
      text: MSG.deletedUser
    });

    // 2. 如果有未处理的通知卡片，先删掉
    if (state.card_id) {
      await tgCall(env, "deleteMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_id: Number(state.card_id)
      }).catch(() => {});
    }

    // 3. 在话题内发送确认
    await tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid),
      text: MSG.deleted,
      parse_mode: "HTML"
    });

    // 4. 彻底删除用户状态 + 话题映射（B 方案）
    await Promise.all([
      env.TOPIC_MAP.delete(KEY.user(uid)),
      env.TOPIC_MAP.delete(KEY.thread(tid))
    ]);

    // 5. 删除话题
    const delRes = await tgCall(env, "deleteForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(tid)
    });

    // 6. 删除失败时给出提示
    if (!delRes.ok) {
      await tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        text: `⚠️ <b>删除话题失败</b>\n原因：${delRes.description || "未知错误"}\n\n请检查机器人是否拥有「删除消息」权限。`,
        parse_mode: "HTML"
      });
    }

    return;
  }

  // ---------- 屏蔽用户端指令 ----------
  if (/^\//.test(cmd)) {
    if (/^\/start/.test(cmd)) {
      if (state.verifiedUntil && state.verifiedUntil > now) {
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
  if (state.card_id) {
    await tgCall(env, "deleteMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_id: Number(state.card_id)
    });
    delete state.card_id;
    delete state.lastNotify;
  }

  // 智能刷新验证有效期（只在快过期时写入，减少写操作）
  if (!state.verifiedUntil || state.verifiedUntil < now + 2 * 24 * 3600) {
    state.verifiedUntil = now + SEVEN_DAYS;
  }
  await saveState(env, uid, state);

  // 转发管理员消息给用户
  await sendBot(msg, uid, null, env);
}

// ============================================================
// 10. 通用消息转发函数
// ============================================================
async function sendBot(msg, target, thread, env) {
  const base = {
    chat_id: target,
    message_thread_id: thread ? Number(thread) : undefined
  };

  if (msg.text) {
    return tgCall(env, "sendMessage", {
      ...base,
      text: msg.text,
      entities: msg.entities,
      parse_mode: msg.entities ? undefined : "HTML"
    });
  }
  if (msg.photo) {
    return tgCall(env, "sendPhoto", {
      ...base,
      photo: msg.photo[msg.photo.length - 1].file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities,
      parse_mode: msg.caption_entities ? undefined : "HTML"
    });
  }
  if (msg.video) {
    return tgCall(env, "sendVideo", {
      ...base,
      video: msg.video.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities,
      parse_mode: msg.caption_entities ? undefined : "HTML"
    });
  }
  if (msg.animation) {
    return tgCall(env, "sendAnimation", {
      ...base,
      animation: msg.animation.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities
    });
  }
  if (msg.video_note) {
    return tgCall(env, "sendVideoNote", {
      ...base,
      video_note: msg.video_note.file_id
    });
  }
  if (msg.sticker) {
    return tgCall(env, "sendSticker", {
      ...base,
      sticker: msg.sticker.file_id
    });
  }
  if (msg.voice) {
    return tgCall(env, "sendVoice", {
      ...base,
      voice: msg.voice.file_id,
      caption: msg.caption
    });
  }
  if (msg.audio) {
    return tgCall(env, "sendAudio", {
      ...base,
      audio: msg.audio.file_id,
      caption: msg.caption
    });
  }
  if (msg.document) {
    return tgCall(env, "sendDocument", {
      ...base,
      document: msg.document.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities
    });
  }
  if (msg.location) {
    return tgCall(env, "sendLocation", {
      ...base,
      latitude: msg.location.latitude,
      longitude: msg.location.longitude
    });
  }
  if (msg.contact) {
    return tgCall(env, "sendContact", {
      ...base,
      phone_number: msg.contact.phone_number,
      first_name: msg.contact.first_name,
      last_name: msg.contact.last_name
    });
  }

  return { ok: false };
}

// ============================================================
// 11. 处理按钮回调
// ============================================================
async function handleCallback(query, env) {
  const data = query.data;
  const userId = query.from.id;

  // ---------- 删除通知卡片 ----------
  if (data.startsWith("del:")) {
    const targetUid = data.split(":")[1];
    await tgCall(env, "deleteMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_id: query.message.message_id
    });

    const state = await getState(env, targetUid);
    delete state.card_id;
    delete state.lastNotify;
    await saveState(env, targetUid, state);
    return;
  }

  // ---------- 验证题点击 ----------
  if (data.startsWith("v:")) {
    const [, cid, ans] = data.split(":");
    let state = await getState(env, userId);
    const now = nowSec();

    // 取出正确答案并立即销毁本次挑战
    const correct = (state.chalId === cid && state.chalUntil > now) ? state.chalAnswer : null;
    delete state.chalId;
    delete state.chalAnswer;
    delete state.chalUntil;

    // 检查临时封禁
    if (state.tempbanUntil && state.tempbanUntil > now) {
      await tgCall(env, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: MSG.tempban,
        show_alert: true
      });
      await saveState(env, userId, state);
      return;
    }

    if (correct && ans === correct) {
      // 验证成功
      state.verifiedUntil = now + SEVEN_DAYS;
      delete state.wrong;
      await saveState(env, userId, state);

      await tgCall(env, "editMessageText", {
        chat_id: userId,
        message_id: query.message.message_id,
        text: "✅ <b>验证通过！</b>",
        parse_mode: "HTML"
      });
    } else {
      // 验证失败
      state.wrong = (state.wrong || 0) + 1;

      if (state.wrong >= 3) {
        // 连续错误 3 次 → 临时封禁
        state.tempbanUntil = now + THIRTY_MIN;
        delete state.wrong;
        await saveState(env, userId, state);

        await tgCall(env, "editMessageText", {
          chat_id: userId,
          message_id: query.message.message_id,
          text: MSG.tempban,
          parse_mode: "HTML"
        });
      } else {
        await saveState(env, userId, state);
        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: `❌ 验证失败，请重新回答 (错误 ${state.wrong}/3)`,
          show_alert: true
        });
        // 刷新新题
        await sendChallenge(userId, env, state, query.message.message_id);
      }
    }
  }
}

// ============================================================
// 12. 发送 / 刷新验证题
// ============================================================
async function sendChallenge(uid, env, state = null, editId = null) {
  if (!state) state = await getState(env, uid);
  const now = nowSec();

  // 临时封禁检查
  if (state.tempbanUntil && state.tempbanUntil > now) {
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

  // 随机抽题
  const quiz = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  const id = Math.random().toString(36).substring(2, 10);

  // 把挑战数据写入用户状态
  state.chalId = id;
  state.chalAnswer = quiz.answer;
  state.chalUntil = now + FIVE_MIN;
  await saveState(env, uid, state);

  const kb = {
    inline_keyboard: [quiz.options.map(o => ({
      text: o,
      callback_data: `v:${id}:${o}`
    }))]
  };

  const text = `🛡 <b>身份验证</b>\n请选择正确答案以继续：\n\n问题：<b>${quiz.question}</b>`;

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
// 13. 生成消息预览（用于通知卡片）
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
// 14. 注册 Webhook + 设置命令菜单
// ============================================================
async function handleRegisterWebhook(request, env) {
  const domain = `https://${new URL(request.url).hostname}`;

  // 设置 Webhook
  await tgCall(env, "setWebhook", {
    url: domain,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true
  });

  // 私聊菜单
  await tgCall(env, "setMyCommands", {
    scope: { type: "all_private_chats" },
    commands: [
      { command: "start", description: "开始咨询 / 激活机器人" }
    ]
  });

  // 群组管理菜单
  if (env.SUPERGROUP_ID) {
    await tgCall(env, "setMyCommands", {
      scope: { type: "chat", chat_id: env.SUPERGROUP_ID },
      commands: [
        { command: "ban", description: "封禁当前话题用户" },
        { command: "unban", description: "解封当前话题用户" },
        { command: "close", description: "关闭当前话题用户" },
        { command: "delete", description: "彻底删除当前话题（含消息）" }
      ]
    });
  }

  return new Response("Webhook & Commands Updated - Bot is Active");
}

// ============================================================
// 15. 清理旧版残留数据接口
// 访问方式：https://你的域名/cleanup?key=你的密钥
// 需要在环境变量中设置 CLEANUP_SECRET
// ============================================================
async function handleCleanup(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.CLEANUP_SECRET || key !== env.CLEANUP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let deleted = 0;
  let cursor = undefined;

  // 旧版使用的 key 前缀
  const oldPrefixes = [
    "ban:", "v:", "u:", "c:", "chal:",
    "user_chal:", "wrong_count:", "tempban:", "tip_lock:"
  ];

  do {
    const list = await env.TOPIC_MAP.list({ limit: 1000, cursor });
    for (const k of list.keys) {
      if (oldPrefixes.some(p => k.name.startsWith(p))) {
        await env.TOPIC_MAP.delete(k.name);
        deleted++;
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return new Response(`Cleanup done. Deleted ${deleted} old keys.`);
}

// ============================================================
// 16. Telegram API 调用封装
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
