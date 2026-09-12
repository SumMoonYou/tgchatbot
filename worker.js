// ============================================================
// Telegram 双向私聊机器人
// Cloudflare Worker - 无 Durable Object 版本
//
// 功能概述：
//   1. 用户私聊消息 → 转发到超级群组对应话题
//   2. 管理员在话题中回复 → 回传到用户私聊
//   3. 验证码系统：连续答错 3 次 → 临时禁止 30 分钟
//   4. 新消息汇总话题（📬 新消息）+ 通知卡片
//   5. 管理员指令：/ban /unban /close /delete
//
// 并发控制策略（本版本重点）：
//   1. Worker 内存 Promise 锁（同 isolate 内有效）
//   2. 用户话题创建占位（topicCreatingUntil + token）
//   3. 话题创建后二次确认，防止重复创建
//   4. 📬 新消息汇总话题独立锁
//   5. 通知卡片状态重新读取
//   6. /close /delete 与用户消息共用用户锁
//   7. 删除失败时保留用户状态
//   8. 验证题状态统一使用用户锁
//
// 不需要：
//   BOT_LOCK / Durable Object / 额外 Binding
//
// 环境变量：
//   BOT_TOKEN        - Telegram Bot Token
//   SUPERGROUP_ID    - 超级群组 ID（带话题功能）
//   ADMIN_ID         - 管理员用户 ID（可选，为空则所有人可操作）
//   CLEANUP_SECRET   - 清理旧 KV 的密钥
//   TOPIC_MAP        - KV 命名空间绑定
// ============================================================


// ============================================================
// 1. 验证题库
// 题目类型：数学、生活常识、交通、地理等
// 每题包含 question / options / answer
// ============================================================

const QUESTION_BANK = [
  // 数学
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

  // 交通
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

  // 地理
  { question: "太阳系中最小的行星是什么？", options: ["水星", "火星", "金星"], answer: "水星" },
  { question: "地球上最大的岛屿是哪个？", options: ["格陵兰岛", "新几内亚岛", "马尔代夫"], answer: "格陵兰岛" },
  { question: "世界上最深的海洋是哪个？", options: ["太平洋", "印度洋", "大西洋"], answer: "太平洋" },
  { question: "世界上最长的山脉是什么？", options: ["安第斯山脉", "喜马拉雅山脉", "阿尔卑斯山脉"], answer: "安第斯山脉" },
  { question: "冰岛位于哪个大洋？", options: ["大西洋", "太平洋", "印度洋"], answer: "大西洋" },
  { question: "月亮离地球有多远？", options: ["38万公里", "40万公里", "39万公里"], answer: "38万公里" },
  { question: "地球上最常见的气体是什么？", options: ["氮气", "氧气", "二氧化碳"], answer: "氮气" },
  { question: "地球的直径大约是多少公里？", options: ["12742公里", "12000公里", "14000公里"], answer: "12742公里" },

  // 更多常识
  { question: "太阳从哪个方向升起？", options: ["东方", "西方", "南方"], answer: "东方" },
  { question: "一年通常有多少个月？", options: ["12个月", "10个月", "14个月"], answer: "12个月" },
  { question: "一周有多少天？", options: ["7天", "5天", "10天"], answer: "7天" },
  { question: "一天有多少小时？", options: ["24小时", "12小时", "48小时"], answer: "24小时" },
  { question: "一个小时有多少分钟？", options: ["60分钟", "30分钟", "100分钟"], answer: "60分钟" },
  { question: "一个成年人通常有多少颗牙齿？", options: ["32颗", "28颗", "36颗"], answer: "32颗" },
  { question: "人类通常用什么器官呼吸？", options: ["肺", "胃", "肝脏"], answer: "肺" },
  { question: "人体最大的器官是什么？", options: ["皮肤", "心脏", "肝脏"], answer: "皮肤" },
  { question: "植物进行光合作用主要需要什么？", options: ["阳光", "月光", "火光"], answer: "阳光" },
  { question: "地球围绕什么运行？", options: ["太阳", "月亮", "火星"], answer: "太阳" },

  { question: "中国的首都是哪里？", options: ["北京", "上海", "广州"], answer: "北京" },
  { question: "日本的首都是哪里？", options: ["东京", "大阪", "京都"], answer: "东京" },
  { question: "法国的首都是哪里？", options: ["巴黎", "伦敦", "罗马"], answer: "巴黎" },
  { question: "英国的首都是哪里？", options: ["伦敦", "巴黎", "柏林"], answer: "伦敦" },
  { question: "美国的首都是哪里？", options: ["华盛顿", "纽约", "洛杉矶"], answer: "华盛顿" },

  { question: "苹果通常是什么颜色？", options: ["红色", "蓝色", "紫色"], answer: "红色" },
  { question: "香蕉通常是什么颜色？", options: ["黄色", "黑色", "蓝色"], answer: "黄色" },
  { question: "西瓜通常是什么颜色？", options: ["绿色", "紫色", "蓝色"], answer: "绿色" },
  { question: "胡萝卜通常是什么颜色？", options: ["橙色", "蓝色", "紫色"], answer: "橙色" },
  { question: "草通常是什么颜色？", options: ["绿色", "红色", "黑色"], answer: "绿色" },

  { question: "猫通常有几条腿？", options: ["4条", "2条", "6条"], answer: "4条" },
  { question: "狗通常有几条腿？", options: ["4条", "3条", "6条"], answer: "4条" },
  { question: "蜘蛛通常有几条腿？", options: ["8条", "6条", "10条"], answer: "8条" },
  { question: "昆虫通常有几条腿？", options: ["6条", "8条", "4条"], answer: "6条" },

  { question: "一年中有多少个月份至少有28天？", options: ["12个月", "1个月", "6个月"], answer: "12个月" },
  { question: "1公斤等于多少克？", options: ["1000克", "100克", "500克"], answer: "1000克" },
  { question: "1米等于多少厘米？", options: ["100厘米", "10厘米", "1000厘米"], answer: "100厘米" },
  { question: "1小时等于多少秒？", options: ["3600秒", "600秒", "1800秒"], answer: "3600秒" },
  { question: "三角形有几个角？", options: ["3个", "4个", "2个"], answer: "3个" },
  { question: "正方形有几个边？", options: ["4条", "3条", "5条"], answer: "4条" },
  { question: "圆形有几个角？", options: ["0个", "1个", "4个"], answer: "0个" },
  { question: "10的一半是多少？", options: ["5", "2", "10"], answer: "5" },
  { question: "2的平方是多少？", options: ["4", "2", "6"], answer: "4" },

  { question: "电脑常用的输入设备是什么？", options: ["键盘", "显示器", "音箱"], answer: "键盘" },
  { question: "电脑显示画面的设备是什么？", options: ["显示器", "键盘", "鼠标"], answer: "显示器" },
  { question: "手机通常使用什么网络？", options: ["移动通信网络", "电网", "水网"], answer: "移动通信网络" },
  { question: "Wi-Fi主要用于什么？", options: ["无线网络连接", "充电", "拍照"], answer: "无线网络连接" },

  { question: "水是什么状态时可以结冰？", options: ["低温", "高温", "常温"], answer: "低温" },
  { question: "冰融化后变成什么？", options: ["水", "空气", "石头"], answer: "水" },
  { question: "云主要由什么组成？", options: ["水滴和冰晶", "沙子", "烟雾"], answer: "水滴和冰晶" },
  { question: "彩虹通常有几种颜色？", options: ["7种", "5种", "10种"], answer: "7种" },
  { question: "夜晚天空中最常见的天体是什么？", options: ["星星", "太阳", "彩虹"], answer: "星星" },

  { question: "鱼通常生活在哪里？", options: ["水中", "树上", "沙漠"], answer: "水中" },
  { question: "鸟通常用什么飞行？", options: ["翅膀", "尾巴", "脚"], answer: "翅膀" },
  { question: "马通常吃什么？", options: ["草", "鱼", "肉"], answer: "草" },
  { question: "熊猫最喜欢吃什么？", options: ["竹子", "鱼", "肉"], answer: "竹子" },
  { question: "蜜蜂通常采集什么？", options: ["花蜜", "石头", "沙子"], answer: "花蜜" },

  { question: "火通常是什么颜色？", options: ["红色或橙色", "蓝色", "黑色"], answer: "红色或橙色" },
  { question: "煤炭通常是什么颜色？", options: ["黑色", "白色", "黄色"], answer: "黑色" },
  { question: "雪的主要成分是什么？", options: ["冰", "沙", "盐"], answer: "冰" },
  { question: "海水为什么是咸的？", options: ["含有盐分", "含有糖", "含有油"], answer: "含有盐分" },

  { question: "人体负责思考的主要器官是什么？", options: ["大脑", "心脏", "胃"], answer: "大脑" },
  { question: "心脏的主要作用是什么？", options: ["泵血", "消化食物", "呼吸"], answer: "泵血" },
  { question: "胃主要负责什么？", options: ["消化食物", "呼吸", "听声音"], answer: "消化食物" },
  { question: "耳朵主要用于什么？", options: ["听声音", "看东西", "呼吸"], answer: "听声音" },
  { question: "眼睛主要用于什么？", options: ["视觉", "听觉", "嗅觉"], answer: "视觉" }
];


// ============================================================
// 2. 消息文本常量
// 所有对外提示语集中管理，便于统一修改
// ============================================================

const MSG = {
  ban: "🚫 <b>您已被管理员禁止咨询。</b>",

  success: "✅ <b>验证通过</b>\n\n您可以开始发送消息了。",

  fail: "⚠️ <b>您还有验证题未完成。</b>\n\n请点击上方按钮选择答案。",

  tempban: "🚫 <b>验证失败次数过多</b>\n\n您已被禁止操作 <b>30 分钟</b>，请稍后再试。",

  verified: "✅ <b>您已经验证过了。</b>\n\n验证有效期内可以直接发送消息。",

  noCmd: "ℹ️ 暂不支持该指令。",

  closed: "✅ <b>本次咨询已结束。</b>\n\n如需再次咨询，请发送 /start。",

  banned: "🚫 <b>已封禁该用户。</b>",

  unbanned: "✅ <b>已解除该用户封禁。</b>",

  closedAdmin: "✅ <b>该咨询已结案。</b>",

  deleted: "🗑️ <b>正在彻底删除该咨询话题及相关记录。</b>",

  deletedUser: "🗑️ <b>本次咨询记录正在删除。</b>",

  adminStart: "🤖 <b>客服机器人运行正常。</b>",

  adminHelp:
    "📖 <b>管理员指令</b>\n\n" +
    "/ban - 封禁当前用户\n" +
    "/unban - 解除封禁\n" +
    "/close - 关闭当前咨询\n" +
    "/delete - 删除当前咨询话题",

  adminNoMsg: "⚠️ 当前话题没有绑定用户。"
};


// ============================================================
// 3. KV Key 生成函数
// 统一管理所有 KV 键名，避免硬编码
// ============================================================

const KEY = {
  /** 用户状态键：us:{userId} */
  user: id => `us:${id}`,

  /** 话题 → 用户反向映射：t:{threadId} */
  thread: id => `t:${id}`,

  /** 📬 新消息汇总话题 ID */
  todoId: "sys:todo_id",

  /** 汇总话题创建中标记 */
  todoCreating: "sys:todo_creating"
};


// ============================================================
// 4. 时间常量（单位：秒）
// ============================================================

const SEVEN_DAYS = 7 * 24 * 3600;   // 验证有效期 7 天
const FIVE_MIN = 300;               // 验证题有效期 5 分钟
const THIRTY_MIN = 1800;            // 连续答错 3 次后临时封禁 30 分钟
const TIP_TTL = 60;                 // “已发送”提示有效期
const NOTIFY_THROTTLE = 8;          // 通知卡片节流间隔（秒）
const TOPIC_CREATING_TTL = 15;      // 话题创建占位有效期


// ============================================================
// 5. 工具函数
// ============================================================

/** Worker 内存锁（仅保证同一 isolate 内串行） */
const LOCAL_LOCKS = new Map();

/**
 * 休眠指定毫秒
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取当前 Unix 时间戳（秒）
 */
function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/**
 * HTML 转义，防止注入
 * @param {string} str
 */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ============================================================
// 6. Worker 内存锁实现
//
// 注意：
//   - 只保证同一个 Worker isolate 内的并发安全
//   - Cloudflare 不同 isolate 之间仍可能同时执行
//   - 通过 Promise 链实现排队
// ============================================================

/**
 * 带本地锁的执行函数
 * @param {string} key  锁的唯一键
 * @param {Function} fn  需要串行执行的异步函数
 */
async function withLocalLock(key, fn) {
  const previous = LOCAL_LOCKS.get(key) || Promise.resolve();

  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });

  // 形成 Promise 链，保证顺序执行
  const chain = previous.catch(() => {}).then(() => current);
  LOCAL_LOCKS.set(key, chain);

  // 等待前一个任务完成
  await previous.catch(() => {});

  try {
    return await fn();
  } finally {
    release();
    // 只有当前 chain 还是最新时才删除，避免误删后续任务
    if (LOCAL_LOCKS.get(key) === chain) {
      LOCAL_LOCKS.delete(key);
    }
  }
}


// ============================================================
// 7. 用户状态读写（KV）
// ============================================================

/**
 * 读取用户状态
 * @param {object} env
 * @param {number|string} uid
 */
async function getState(env, uid) {
  return (await env.TOPIC_MAP.get(KEY.user(uid), { type: "json" })) || {};
}

/**
 * 保存用户状态（自动清理过期字段）
 * @param {object} env
 * @param {number|string} uid
 * @param {object} state
 */
async function saveState(env, uid, state) {
  const copy = { ...state };
  const now = nowSec();

  // 清理已过期的验证状态
  if (copy.verifiedUntil && copy.verifiedUntil <= now) {
    delete copy.verifiedUntil;
  }

  // 清理已过期的临时封禁
  if (copy.tempbanUntil && copy.tempbanUntil <= now) {
    delete copy.tempbanUntil;
  }

  // 清理已过期的挑战题
  if (copy.chalUntil && copy.chalUntil <= now) {
    delete copy.chalId;
    delete copy.chalAnswer;
    delete copy.chalUntil;
  }

  // 错误次数异常时清除
  if (copy.wrong && copy.wrong < 0) {
    delete copy.wrong;
  }

  await env.TOPIC_MAP.put(KEY.user(uid), JSON.stringify(copy));
  return copy;
}


// ============================================================
// 8. 主入口
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 注册 Webhook
    if (url.pathname === "/registerWebhook") {
      return handleRegisterWebhook(request, env);
    }

    // 清理旧版 KV 数据
    if (url.pathname === "/cleanup") {
      return handleCleanup(request, env);
    }

    // 只处理 POST 请求（Telegram Webhook）
    if (request.method !== "POST") {
      return new Response("OK");
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // 处理回调查询（验证题按钮 / 忽略卡片）
    if (update.callback_query) {
      ctx.waitUntil(handleCallback(update.callback_query, env));
      return new Response("OK");
    }

    const msg = update.message;
    if (!msg) {
      return new Response("OK");
    }

    // 私聊消息
    if (msg.chat?.type === "private") {
      ctx.waitUntil(handlePrivate(msg, env, ctx));
      return new Response("OK");
    }

    // 超级群组话题消息（管理员回复）
    if (
      msg.chat?.id != null &&
      String(msg.chat.id) === String(env.SUPERGROUP_ID) &&
      msg.message_thread_id
    ) {
      ctx.waitUntil(handleAdminReply(msg, env, ctx));
      return new Response("OK");
    }

    return new Response("OK");
  }
};


// ============================================================
// 9. 处理用户私聊消息
// ============================================================

async function handlePrivate(msg, env, ctx) {
  const user = msg.from;
  if (!user) return;

  const userId = user.id;
  let state = await getState(env, userId);
  const now = nowSec();

  // ---------- 管理员私聊特殊处理 ----------
  if (env.ADMIN_ID && String(userId) === String(env.ADMIN_ID)) {
    if (msg.text === "/start") {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.adminStart,
        parse_mode: "HTML"
      });
    }
    return;
  }

  // ---------- 永久封禁 ----------
  if (state.ban) {
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.ban,
      parse_mode: "HTML"
    });
  }

  // ---------- 临时封禁（30 分钟） ----------
  if (state.tempbanUntil && state.tempbanUntil > now) {
    return tgCall(env, "sendMessage", {
      chat_id: userId,
      text: MSG.tempban,
      parse_mode: "HTML"
    });
  }

  // ---------- /start 指令 ----------
  if (msg.text === "/start") {
    // 已验证且在有效期内
    if (state.verifiedUntil && state.verifiedUntil > now) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.verified,
        parse_mode: "HTML"
      });
    }

    // 已有有效挑战题
    if (state.chalId && state.chalUntil && state.chalUntil > now) {
      return tgCall(env, "sendMessage", {
        chat_id: userId,
        text: MSG.fail,
        parse_mode: "HTML"
      });
    }

    return sendChallenge(userId, env);
  }

  // ---------- 未验证用户强制验证 ----------
  if (!state.verifiedUntil || state.verifiedUntil <= now) {
    return sendChallenge(userId, env);
  }

  // ---------- 确保用户话题存在 ----------
  const topic = await ensureUserTopic(msg, env);
  if (!topic) return;

  state = topic.state;
  const threadId = topic.threadId;
  const sessionId = state.sessionId; // 记录当前会话版本

  // 媒体组消息稍微延迟，避免顺序错乱
  if (msg.media_group_id) {
    await sleep(300 + Math.floor(Math.random() * 700));
  }

  // 再次读取最新状态，防止 /close /delete 期间状态已变
  const latest = await getState(env, userId);

  // 话题已被删除或更换
  if (!latest.thread_id || String(latest.thread_id) !== String(threadId)) {
    return;
  }

  // 会话版本变化（说明旧请求已失效）
  if (sessionId && latest.sessionId && sessionId !== latest.sessionId) {
    return;
  }

  // 已被封禁
  if (latest.ban) return;
  if (latest.tempbanUntil && latest.tempbanUntil > nowSec()) return;

  // ---------- 转发用户消息到话题 ----------
  const sent = await sendBot(msg, env.SUPERGROUP_ID, threadId, env);
  if (!sent?.ok) return;

  // 异步触发新消息通知
  ctx.waitUntil(
    triggerNotification(user, threadId, env, getPreview(msg), sent.result?.message_id)
  );

  // ---------- 发送“已发送”提示（带用户锁） ----------
  await withLocalLock(`user-state:${userId}`, async () => {
    const current = await getState(env, userId);

    // 再次确认状态未变
    if (!current.thread_id || String(current.thread_id) !== String(threadId)) {
      return;
    }

    current.tipUntil = nowSec() + TIP_TTL;
    await saveState(env, userId, current);

    const tipRes = await tgCall(env, "sendMessage", {
      chat_id: userId,
      text: "✅ <b>已发送</b>",
      parse_mode: "HTML"
    });

    // 2 秒后自动删除提示
    if (tipRes.ok) {
      ctx.waitUntil((async () => {
        await sleep(2000);
        await tgCall(env, "deleteMessage", {
          chat_id: userId,
          message_id: tipRes.result.message_id
        });
      })());
    }
  });
}


// ============================================================
// 10. 确保用户话题存在（带创建占位与二次确认）
// ============================================================

async function ensureUserTopic(msg, env) {
  const user = msg.from;
  const userId = user.id;

  return withLocalLock(`user-topic:${userId}`, async () => {
    let state = await getState(env, userId);

    // 已存在话题，直接返回
    if (state.thread_id) {
      return {
        threadId: String(state.thread_id),
        state
      };
    }

    // ---------- 创建中的占位等待 ----------
    if (state.topicCreatingUntil && state.topicCreatingUntil > nowSec()) {
      const deadline = Date.now() + 8000;

      while (Date.now() < deadline) {
        await sleep(300);
        state = await getState(env, userId);

        if (state.thread_id) {
          return {
            threadId: String(state.thread_id),
            state
          };
        }

        // 占位已过期
        if (!state.topicCreatingUntil || state.topicCreatingUntil <= nowSec()) {
          break;
        }
      }
    }

    // 再次读取最新状态
    state = await getState(env, userId);
    if (state.thread_id) {
      return {
        threadId: String(state.thread_id),
        state
      };
    }

    // ---------- 写入创建占位 ----------
    const creatingToken = crypto.randomUUID();
    state.topicCreatingUntil = nowSec() + 15;
    state.topicCreatingToken = creatingToken;
    await saveState(env, userId, state);

    // ---------- 创建 Forum Topic ----------
    const displayName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "用户";

    const topicName = displayName.substring(0, 120);

    const res = await tgCall(env, "createForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      name: topicName
    });

    // ---------- 创建失败 ----------
    if (!res.ok || !res.result?.message_thread_id) {
      const latest = await getState(env, userId);
      // 只有自己创建的占位才清理
      if (latest.topicCreatingToken === creatingToken) {
        delete latest.topicCreatingUntil;
        delete latest.topicCreatingToken;
        await saveState(env, userId, latest);
      }
      return null;
    }

    const newThreadId = String(res.result.message_thread_id);

    // ---------- 创建成功后二次确认 ----------
    state = await getState(env, userId);

    // 已经存在其他话题（并发创建导致），删除本次创建的话题
    if (state.thread_id && String(state.thread_id) !== newThreadId) {
      await tgCall(env, "deleteForumTopic", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(newThreadId)
      });

      return {
        threadId: String(state.thread_id),
        state
      };
    }

    // ---------- 建立新会话 ----------
    const sessionId = crypto.randomUUID();
    state.thread_id = newThreadId;
    state.sessionId = sessionId;
    state.original_name = topicName;
    delete state.topicCreatingUntil;
    delete state.topicCreatingToken;

    await saveState(env, userId, state);

    // 反向映射：话题 → 用户
    await env.TOPIC_MAP.put(KEY.thread(newThreadId), String(userId));

    // 发送用户资料卡片
    await sendUserProfileCard(user, newThreadId, env, topicName);

    return {
      threadId: newThreadId,
      state
    };
  });
}


// ============================================================
// 11. 发送用户资料卡片到话题
// ============================================================

async function sendUserProfileCard(user, threadId, env, originalName = "") {
  const chatId = env.SUPERGROUP_ID;

  const displayName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "用户";

  const username = user.username ? `@${user.username}` : "无";
  const userId = user.id;

  let text = "📇 <b>用户资料卡片</b>\n\n";
  text += `👤 <b>昵称</b>: ${escapeHtml(displayName)}\n`;
  text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
  text += `🔗 <b>账号</b>: ${escapeHtml(username)}\n`;
  text += `💬 <b>话题名</b>: ${escapeHtml(originalName)}\n`;

  // 尝试获取用户头像
  let photoId = null;
  try {
    const res = await tgCall(env, "getUserProfilePhotos", {
      user_id: userId,
      limit: 1
    });

    if (res.ok && res.result?.total_count > 0) {
      const sizes = res.result.photos[0];
      photoId = sizes[sizes.length - 1].file_id;
    }
  } catch {}

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
// 12. 确保 📬 新消息汇总话题存在
// ============================================================

async function ensureTodoTopic(env) {
  return withLocalLock(`todo-topic:${env.SUPERGROUP_ID}`, async () => {
    let todoId = await env.TOPIC_MAP.get(KEY.todoId);
    if (todoId) return String(todoId);

    // 创建中等待
    let creating = await env.TOPIC_MAP.get(KEY.todoCreating, { type: "json" });
    if (creating && creating.until && creating.until > nowSec()) {
      const deadline = Date.now() + 8000;

      while (Date.now() < deadline) {
        await sleep(300);
        todoId = await env.TOPIC_MAP.get(KEY.todoId);
        if (todoId) return String(todoId);

        creating = await env.TOPIC_MAP.get(KEY.todoCreating, { type: "json" });
        if (!creating || !creating.until || creating.until <= nowSec()) {
          break;
        }
      }
    }

    // 再次确认
    todoId = await env.TOPIC_MAP.get(KEY.todoId);
    if (todoId) return String(todoId);

    // 写入创建占位
    const token = crypto.randomUUID();
    await env.TOPIC_MAP.put(KEY.todoCreating, JSON.stringify({
      until: nowSec() + TOPIC_CREATING_TTL,
      id: token
    }));

    const res = await tgCall(env, "createForumTopic", {
      chat_id: env.SUPERGROUP_ID,
      name: "📬 新消息"
    });

    // 创建失败
    if (!res.ok || !res.result?.message_thread_id) {
      const latest = await env.TOPIC_MAP.get(KEY.todoCreating, { type: "json" });
      if (latest?.id === token) {
        await env.TOPIC_MAP.delete(KEY.todoCreating);
      }
      return null;
    }

    const newTodoId = String(res.result.message_thread_id);

    // 二次确认
    todoId = await env.TOPIC_MAP.get(KEY.todoId);
    if (todoId && String(todoId) !== newTodoId) {
      // 已有其他话题，删除本次创建
      await tgCall(env, "deleteForumTopic", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(newTodoId)
      });
      return String(todoId);
    }

    // 写入正式 ID
    await env.TOPIC_MAP.put(KEY.todoId, newTodoId);

    // 清理占位
    const latest = await env.TOPIC_MAP.get(KEY.todoCreating, { type: "json" });
    if (latest?.id === token) {
      await env.TOPIC_MAP.delete(KEY.todoCreating);
    }

    return newTodoId;
  });
}


// ============================================================
// 13. 触发新消息通知卡片
// ============================================================

async function triggerNotification(from, userThreadId, env, preview, lastId) {
  const userId = from.id;

  return withLocalLock(`notify:${env.SUPERGROUP_ID}`, async () => {
    let state = await getState(env, userId);

    // 状态已失效
    if (!state.thread_id || String(state.thread_id) !== String(userThreadId)) {
      return;
    }

    const sessionId = state.sessionId;
    const now = nowSec();

    // 节流：短时间内不重复通知
    if (state.lastNotify && now - state.lastNotify < NOTIFY_THROTTLE) {
      return;
    }

    let todoId = await ensureTodoTopic(env);
    if (!todoId) return;

    const name = [from.first_name, from.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "用户";

    const safeName = escapeHtml(name);
    const safePreview = escapeHtml(preview);

    let text = "🎯 <b>新消息提醒</b>\n\n";
    text += `👤 <b>用户</b>: ${safeName}\n`;

    if (from.username) {
      text += `🆔 <b>账号</b>: @${escapeHtml(from.username)}\n`;
    } else {
      text += `🆔 <b>ID</b>: <code>${userId}</code>\n`;
    }

    text += `💬 <b>内容</b>: ${safePreview}\n\n`;

    const cardId = state.card_id;

    if (cardId) {
      text += "🔔 状态: [追加消息]";
    } else {
      const adminMention = env.ADMIN_ID
        ? `<a href="tg://user?id=${env.ADMIN_ID}">@管理员</a>`
        : "<b>管理员</b>";
      text += `📢 呼叫 ${adminMention} [待处理]`;
    }

    // 生成跳转链接
    const cleanId = String(env.SUPERGROUP_ID).replace("-100", "");
    const jumpUrl = `https://t.me/c/${cleanId}/${lastId}?thread=${userThreadId}`;

    const kb = {
      inline_keyboard: [
        [
          { text: "🚀 跳转话题", url: jumpUrl },
          ...(from.username
            ? [{ text: "👤 资料", url: `https://t.me/${from.username}` }]
            : [])
        ],
        [
          { text: "🗑️ 忽略卡片", callback_data: `del:${userId}` }
        ]
      ]
    };

    // ---------- 尝试编辑旧卡片 ----------
    if (cardId) {
      const edit = await tgCall(env, "editMessageText", {
        chat_id: env.SUPERGROUP_ID,
        message_id: Number(cardId),
        text,
        parse_mode: "HTML",
        reply_markup: kb
      });

      if (edit.ok) {
        // 更新最后通知时间
        await withLocalLock(`user-state:${userId}`, async () => {
          const latest = await getState(env, userId);
          if (!latest.thread_id || String(latest.thread_id) !== String(userThreadId)) return;
          if (sessionId && latest.sessionId && sessionId !== latest.sessionId) return;

          latest.lastNotify = now;
          await saveState(env, userId, latest);
        });
        return;
      }

      // 编辑失败（卡片可能已被删除），清理状态
      await withLocalLock(`user-state:${userId}`, async () => {
        const latest = await getState(env, userId);
        if (String(latest.thread_id) !== String(userThreadId)) return;

        delete latest.card_id;
        delete latest.lastNotify;
        await saveState(env, userId, latest);
      });
    }

    // ---------- 创建新通知卡片 ----------
    let res = await tgCall(env, "sendMessage", {
      chat_id: env.SUPERGROUP_ID,
      message_thread_id: Number(todoId),
      text,
      parse_mode: "HTML",
      reply_markup: kb
    });

    // 汇总话题可能被删除，尝试重建
    if (!res.ok) {
      const currentTodo = await env.TOPIC_MAP.get(KEY.todoId);
      if (currentTodo && String(currentTodo) === String(todoId)) {
        await env.TOPIC_MAP.delete(KEY.todoId);
      }

      todoId = await ensureTodoTopic(env);
      if (!todoId) return;

      res = await tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(todoId),
        text,
        parse_mode: "HTML",
        reply_markup: kb
      });
    }

    if (!res.ok) return;

    // 保存新卡片 ID
    await withLocalLock(`user-state:${userId}`, async () => {
      const latest = await getState(env, userId);
      if (!latest.thread_id || String(latest.thread_id) !== String(userThreadId)) return;
      if (sessionId && latest.sessionId && sessionId !== latest.sessionId) return;

      latest.card_id = String(res.result.message_id);
      latest.lastNotify = now;
      await saveState(env, userId, latest);
    });
  });
}


// ============================================================
// 14. 处理管理员在话题中的回复
// ============================================================

async function handleAdminReply(msg, env, ctx) {
  const tid = String(msg.message_thread_id);

  // 忽略 📬 新消息汇总话题本身
  const todoId = await env.TOPIC_MAP.get(KEY.todoId);
  if (todoId && String(tid) === String(todoId)) {
    return;
  }

  // 查找话题绑定的用户
  const uid = await env.TOPIC_MAP.get(KEY.thread(tid));
  if (!uid) return;

  // 权限检查
  const isAdmin = !env.ADMIN_ID || String(msg.from?.id) === String(env.ADMIN_ID);
  if (!isAdmin) return;

  const cmd = msg.text?.trim() || "";

  // ---------- /ban ----------
  if (/^\/ban\b/.test(cmd)) {
    return withLocalLock(`user-state:${uid}`, async () => {
      const state = await getState(env, uid);
      state.ban = true;
      await saveState(env, uid, state);

      return tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        text: MSG.banned,
        parse_mode: "HTML"
      });
    });
  }

  // ---------- /unban ----------
  if (/^\/unban\b/.test(cmd)) {
    return withLocalLock(`user-state:${uid}`, async () => {
      const state = await getState(env, uid);
      delete state.ban;
      await saveState(env, uid, state);

      return tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        text: MSG.unbanned,
        parse_mode: "HTML"
      });
    });
  }

  // ---------- /close（结案） ----------
  if (/^\/close\b/.test(cmd)) {
    return withLocalLock(`user-state:${uid}`, async () => {
      const state = await getState(env, uid);
      const name = state.original_name || uid;

      // 删除通知卡片
      if (state.card_id) {
        await tgCall(env, "deleteMessage", {
          chat_id: env.SUPERGROUP_ID,
          message_id: Number(state.card_id)
        });
      }

      // 修改话题名称
      await tgCall(env, "editForumTopic", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        name: `[已结案] ${name}`.substring(0, 60)
      });

      // 群内确认
      await tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        text: MSG.closedAdmin,
        parse_mode: "HTML"
      });

      // 关闭话题
      const closeRes = await tgCall(env, "closeForumTopic", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid)
      });

      if (!closeRes.ok) {
        await tgCall(env, "sendMessage", {
          chat_id: env.SUPERGROUP_ID,
          message_thread_id: Number(tid),
          text: `⚠️ <b>关闭话题失败</b>\n\n${escapeHtml(closeRes.description || "未知错误")}`,
          parse_mode: "HTML"
        });
        return;
      }

      // 删除 KV 映射
      await Promise.all([
        env.TOPIC_MAP.delete(KEY.user(uid)),
        env.TOPIC_MAP.delete(KEY.thread(tid))
      ]);

      // 通知用户
      await tgCall(env, "sendMessage", {
        chat_id: uid,
        text: MSG.closed
      });
    });
  }

  // ---------- /delete（彻底删除话题） ----------
  if (/^\/delete\b/.test(cmd)) {
    return withLocalLock(`user-state:${uid}`, async () => {
      const state = await getState(env, uid);

      // 删除通知卡片
      if (state.card_id) {
        await tgCall(env, "deleteMessage", {
          chat_id: env.SUPERGROUP_ID,
          message_id: Number(state.card_id)
        });
      }

      // 删除前提示
      await tgCall(env, "sendMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid),
        text: MSG.deleted,
        parse_mode: "HTML"
      });

      // 删除 Telegram 话题
      const delRes = await tgCall(env, "deleteForumTopic", {
        chat_id: env.SUPERGROUP_ID,
        message_thread_id: Number(tid)
      });

      // 删除失败则保留 KV
      if (!delRes.ok) {
        await tgCall(env, "sendMessage", {
          chat_id: env.SUPERGROUP_ID,
          message_thread_id: Number(tid),
          text:
            `⚠️ <b>删除话题失败</b>\n` +
            `原因：${escapeHtml(delRes.description || "未知错误")}\n\n` +
            `请检查机器人是否拥有「删除消息」权限。`,
          parse_mode: "HTML"
        });
        return;
      }

      // 删除成功，清理 KV
      await Promise.all([
        env.TOPIC_MAP.delete(KEY.user(uid)),
        env.TOPIC_MAP.delete(KEY.thread(tid))
      ]);

      // 通知用户
      await tgCall(env, "sendMessage", {
        chat_id: uid,
        text: MSG.deletedUser
      });
    });
  }

  // ---------- 其他以 / 开头的指令 ----------
  if (/^\//.test(cmd)) {
    if (/^\/start\b/.test(cmd)) {
      return sendChallenge(uid, env);
    }

    return tgCall(env, "sendMessage", {
      chat_id: uid,
      text: MSG.noCmd,
      parse_mode: "HTML"
    });
  }

  // ---------- 普通管理员回复 ----------
  await withLocalLock(`user-state:${uid}`, async () => {
    const state = await getState(env, uid);

    // 删除通知卡片
    if (state.card_id) {
      await tgCall(env, "deleteMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_id: Number(state.card_id)
      });
      delete state.card_id;
      delete state.lastNotify;
    }

    // 智能刷新验证有效期（剩余不足 2 天则续期 7 天）
    const now = nowSec();
    if (!state.verifiedUntil || state.verifiedUntil < now + 2 * 24 * 3600) {
      state.verifiedUntil = now + SEVEN_DAYS;
    }

    await saveState(env, uid, state);
  });

  // 转发管理员消息到用户私聊
  await sendBot(msg, uid, null, env);
}


// ============================================================
// 15. 通用消息转发（支持多种媒体类型）
// ============================================================

async function sendBot(msg, target, thread, env) {
  const base = { chat_id: target };

  if (thread) {
    base.message_thread_id = Number(thread);
  }

  // 文本
  if (msg.text) {
    const body = { ...base, text: msg.text };
    if (msg.entities) body.entities = msg.entities;
    return tgCall(env, "sendMessage", body);
  }

  // 图片
  if (msg.photo) {
    const body = {
      ...base,
      photo: msg.photo[msg.photo.length - 1].file_id,
      caption: msg.caption
    };
    if (msg.caption_entities) body.caption_entities = msg.caption_entities;
    return tgCall(env, "sendPhoto", body);
  }

  // 视频
  if (msg.video) {
    const body = {
      ...base,
      video: msg.video.file_id,
      caption: msg.caption
    };
    if (msg.caption_entities) body.caption_entities = msg.caption_entities;
    return tgCall(env, "sendVideo", body);
  }

  // GIF / 动画
  if (msg.animation) {
    const body = {
      ...base,
      animation: msg.animation.file_id,
      caption: msg.caption
    };
    if (msg.caption_entities) body.caption_entities = msg.caption_entities;
    return tgCall(env, "sendAnimation", body);
  }

  // 视频消息（圆形）
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

  // 音频
  if (msg.audio) {
    return tgCall(env, "sendAudio", {
      ...base,
      audio: msg.audio.file_id,
      caption: msg.caption,
      caption_entities: msg.caption_entities
    });
  }

  // 文件
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

  return { ok: false };
}


// ============================================================
// 16. 处理回调查询（验证题 / 忽略卡片）
// ============================================================

async function handleCallback(query, env) {
  const data = query.data || "";
  const userId = query.from.id;

  // ---------- 忽略通知卡片 ----------
  if (data.startsWith("del:")) {
    const targetUid = data.substring(4);

    const isAdmin = !env.ADMIN_ID || String(userId) === String(env.ADMIN_ID);
    if (!isAdmin) {
      await tgCall(env, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: "无权限",
        show_alert: true
      });
      return;
    }

    await withLocalLock(`user-state:${targetUid}`, async () => {
      await tgCall(env, "deleteMessage", {
        chat_id: env.SUPERGROUP_ID,
        message_id: query.message.message_id
      });

      const state = await getState(env, targetUid);
      delete state.card_id;
      delete state.lastNotify;
      await saveState(env, targetUid, state);
    });

    await tgCall(env, "answerCallbackQuery", {
      callback_query_id: query.id,
      text: "已忽略"
    });
    return;
  }

  // ---------- 验证题回调 ----------
  if (data.startsWith("v:")) {
    const parts = data.split(":");
    const cid = parts[1];
    const ans = parts.slice(2).join(":");

    await withLocalLock(`user-state:${userId}`, async () => {
      let state = await getState(env, userId);
      const now = nowSec();

      // 已临时封禁
      if (state.tempbanUntil && state.tempbanUntil > now) {
        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: MSG.tempban,
          show_alert: true
        });
        return;
      }

      // 检查挑战是否有效
      const validChallenge =
        state.chalId === cid &&
        state.chalUntil &&
        state.chalUntil > now;

      const correct = validChallenge ? state.chalAnswer : null;

      // 当前挑战只能使用一次
      delete state.chalId;
      delete state.chalAnswer;
      delete state.chalUntil;

      // ---------- 答对 ----------
      if (correct && ans === correct) {
        state.verifiedUntil = now + SEVEN_DAYS;
        delete state.wrong;

        await saveState(env, userId, state);

        await tgCall(env, "editMessageText", {
          chat_id: userId,
          message_id: query.message.message_id,
          text: "✅ <b>验证通过！</b>",
          parse_mode: "HTML"
        });

        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: "验证通过"
        });
        return;
      }

      // ---------- 挑战已过期（不计入错误次数） ----------
      if (!validChallenge) {
        await saveState(env, userId, state);

        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: "验证已过期，请重新发送 /start",
          show_alert: true
        });
        return;
      }

      // ---------- 答错 ----------
      state.wrong = (state.wrong || 0) + 1;

      // 连续答错 3 次 → 临时封禁 30 分钟
      if (state.wrong >= 3) {
        state.tempbanUntil = now + THIRTY_MIN;
        delete state.wrong;
        delete state.chalId;
        delete state.chalAnswer;
        delete state.chalUntil;

        await saveState(env, userId, state);

        await tgCall(env, "editMessageText", {
          chat_id: userId,
          message_id: query.message.message_id,
          text: MSG.tempban,
          parse_mode: "HTML"
        });

        await tgCall(env, "answerCallbackQuery", {
          callback_query_id: query.id,
          text: "错误次数达到 3 次，已禁止 30 分钟",
          show_alert: true
        });
        return;
      }

      // 第 1 / 2 次错误
      const wrongCount = state.wrong;
      await saveState(env, userId, state);

      await tgCall(env, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: `❌ 验证失败，请重新回答 (错误 ${wrongCount}/3)`,
        show_alert: true
      });

      // 刷新下一道题（已在锁内，使用 Locked 版本）
      await sendChallengeLocked(userId, env, state, query.message.message_id);
    });
  }
}


// ============================================================
// 17. 发送验证题（外部调用入口）
// ============================================================

/**
 * 发送验证题（自动加锁）
 * @param {number|string} uid
 * @param {object} env
 * @param {object|null} state
 * @param {number|null} editId
 */
async function sendChallenge(uid, env, state = null, editId = null) {
  return withLocalLock(`user-state:${uid}`, async () => {
    // 永远重新读取最新状态，避免覆盖并发修改
    const latestState = await getState(env, uid);
    return sendChallengeLocked(uid, env, latestState, editId);
  });
}


// ============================================================
// 18. 发送验证题（锁内部版本）
// ============================================================

/**
 * 发送验证题（必须在 user-state 锁内部调用）
 */
async function sendChallengeLocked(uid, env, state, editId = null) {
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

  // 已验证则不发送
  if (state.verifiedUntil && state.verifiedUntil > now) {
    return;
  }

  // 已有有效挑战题，不重复生成
  if (state.chalId && state.chalUntil && state.chalUntil > now) {
    if (editId) return;

    return tgCall(env, "sendMessage", {
      chat_id: uid,
      text: MSG.fail,
      parse_mode: "HTML"
    });
  }

  // 随机抽题
  const quiz = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  const id = crypto.randomUUID().replace(/-/g, "").substring(0, 12);

  // 保存挑战状态
  state.chalId = id;
  state.chalAnswer = quiz.answer;
  state.chalUntil = now + FIVE_MIN;
  await saveState(env, uid, state);

  // 构建按钮
  const kb = {
    inline_keyboard: [
      quiz.options.map(o => ({
        text: o,
        callback_data: `v:${id}:${o}`
      }))
    ]
  };

  const text =
    "🛡 <b>身份验证</b>\n" +
    "请选择正确答案以继续：\n\n" +
    `问题：<b>${escapeHtml(quiz.question)}</b>`;

  // 发送或编辑
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
// 19. 消息预览生成（用于通知卡片）
// ============================================================

function getPreview(msg) {
  if (!msg) return "[未知消息]";

  if (msg.text) return msg.text.substring(0, 30);
  if (msg.sticker) return "📌 发送了贴纸 " + (msg.sticker.emoji || "");
  if (msg.photo) return "🖼️ [图片消息]";
  if (msg.video) return "🎬 [视频消息]";
  if (msg.video_note) return "🎥 [视频消息]";
  if (msg.animation) return "🎞️ [动画/GIF]";
  if (msg.voice) return "🎤 [语音消息]";
  if (msg.audio) return "🎵 [音频文件]";
  if (msg.document) {
    return "📄 [文件: " + (msg.document.file_name || "未知") + "]";
  }
  if (msg.location) return "📍 [位置消息]";
  if (msg.venue) return "📍 [地点消息]";
  if (msg.contact) return "📇 [联系人消息]";
  if (msg.poll) return "🗳️ [投票消息]";

  return "[媒体消息]";
}


// ============================================================
// 20. 注册 Webhook 与命令菜单
// ============================================================

async function handleRegisterWebhook(request, env) {
  const domain = `https://${new URL(request.url).hostname}`;

  const webhook = await tgCall(env, "setWebhook", {
    url: domain,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true
  });

  // 私聊命令菜单
  await tgCall(env, "setMyCommands", {
    scope: { type: "all_private_chats" },
    commands: [
      {
        command: "start",
        description: "开始咨询 / 激活机器人"
      }
    ]
  });

  // 群组命令菜单
  if (env.SUPERGROUP_ID) {
    await tgCall(env, "setMyCommands", {
      scope: {
        type: "chat",
        chat_id: env.SUPERGROUP_ID
      },
      commands: [
        { command: "ban", description: "封禁当前话题用户" },
        { command: "unban", description: "解封当前话题用户" },
        { command: "close", description: "关闭当前话题用户" },
        { command: "delete", description: "彻底删除当前话题（含消息）" }
      ]
    });
  }

  return new Response(
    webhook.ok
      ? "Webhook & Commands Updated - Bot is Active"
      : "Webhook update failed"
  );
}


// ============================================================
// 21. 清理旧版 KV 数据
// ============================================================

async function handleCleanup(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.CLEANUP_SECRET || key !== env.CLEANUP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let deleted = 0;
  let cursor = undefined;

  // 旧版前缀列表
  const oldPrefixes = [
    "ban:",
    "v:",
    "u:",
    "c:",
    "chal:",
    "user_chal:",
    "wrong_count:",
    "tempban:",
    "tip_lock:"
  ];

  do {
    const list = await env.TOPIC_MAP.list({
      limit: 1000,
      cursor
    });

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
// 22. Telegram API 调用封装
// ============================================================

/**
 * 调用 Telegram Bot API
 * @param {object} env
 * @param {string} method  API 方法名
 * @param {object} body    请求体
 */
async function tgCall(env, method, body) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let r;
    try {
      r = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timer);
    }

    const data = await r.json();

    if (!data.ok) {
      console.error(`[TG Error] ${method}`, JSON.stringify(data));
    }

    return data;
  } catch (e) {
    console.error(`[Network Error] ${method}`, e);
    return {
      ok: false,
      description: String(e)
    };
  }
}
