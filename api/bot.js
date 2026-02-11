// Vercel API Route - /api/bot.js
// Основна логіка бота

const fs = require('fs');
const path = require('path');

// Константи
const NYASHKA_TYPES = {
  'захисник': { hp: 150, attack: 40, defense: 80, emoji: '🛡' },
  'атакуючий': { hp: 100, attack: 90, defense: 40, emoji: '⚔️' },
  'сапорт': { hp: 120, attack: 50, defense: 60, emoji: '💚' }
};

const MINING_RESOURCES = {
  'wood': {
    name: 'Дерево',
    emoji: '🪵',
    income_percent: 1,
    unlock_cost: 0,
    unlock_resource: null,
    base_reward: 1,
    description: 'Початковий ресурс для заробітку'
  },
  'stone': {
    name: 'Камінь',
    emoji: '🪨',
    income_percent: 5,
    unlock_cost: 150,
    unlock_resource: 'wood',
    base_reward: 5,
    description: 'Міцніший за дерево'
  },
  'andesite': {
    name: 'Андезіт',
    emoji: '⛰️',
    income_percent: 30,
    unlock_cost: 300,
    unlock_resource: 'stone',
    base_reward: 30,
    description: 'Рідкісний вулканічний камінь'
  },
  'gold': {
    name: 'Золото',
    emoji: '🥇',
    income_percent: 70,
    unlock_cost: 350,
    unlock_resource: 'andesite',
    base_reward: 70,
    description: 'Дорогоцінний метал'
  },
  'diamond': {
    name: 'Діаманти',
    emoji: '💎',
    income_percent: 150,
    unlock_cost: 350,
    unlock_resource: 'gold',
    base_reward: 150,
    description: 'Найтвердіший мінерал'
  },
  'nyashium': {
    name: 'Няшний-гідродіоксид',
    emoji: '✨',
    income_percent: 500,
    unlock_cost: 200,
    unlock_resource: 'diamond',
    base_reward: 500,
    description: 'Легендарний ресурс ПОЛЯНєрів!'
  }
};

// Клас для роботи з базою даних
class Database {
  constructor() {
    this.dataPath = '/tmp/nyashka_empire_data.json';
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        this.players = data.players || {};
        this.nyashkas = data.nyashkas || {};
        this.clans = data.clans || {};
        this.wars = data.wars || {};
      } else {
        this.players = {};
        this.nyashkas = {};
        this.clans = {};
        this.wars = {};
      }
    } catch (error) {
      console.error('Помилка завантаження даних:', error);
      this.players = {};
      this.nyashkas = {};
      this.clans = {};
      this.wars = {};
    }
  }

  saveData() {
    try {
      const data = {
        players: this.players,
        nyashkas: this.nyashkas,
        clans: this.clans,
        wars: this.wars
      };
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Помилка збереження даних:', error);
    }
  }

  getPlayer(userId) {
    return this.players[String(userId)];
  }

  createPlayer(userId, username, name, photoId) {
    this.players[String(userId)] = {
      user_id: String(userId),
      username: username,
      name: name,
      photo_id: photoId,
      balance: 100,
      rating: 1000,
      clan_id: null,
      nyashkas: [],
      created_at: new Date().toISOString(),
      last_income: new Date().toISOString(),
      last_daily_reward: null,
      wins: 0,
      losses: 0,
      potions: {},
      mining: {
        wood: { unlocked: true, count: 0, last_mined: null },
        stone: { unlocked: false, count: 0, last_mined: null },
        andesite: { unlocked: false, count: 0, last_mined: null },
        gold: { unlocked: false, count: 0, last_mined: null },
        diamond: { unlocked: false, count: 0, last_mined: null },
        nyashium: { unlocked: false, count: 0, last_mined: null }
      },
      conversation_state: null,
      temp_data: {}
    };
    this.saveData();
  }

  getNyashkasForPlayer(userId) {
    return Object.values(this.nyashkas).filter(n => n.owner_id === String(userId));
  }

  createNyashka(ownerId, name, photoId, nyashkaType, description = '') {
    const nyashkaId = this.generateId();
    const baseStats = NYASHKA_TYPES[nyashkaType];

    this.nyashkas[nyashkaId] = {
      id: nyashkaId,
      owner_id: String(ownerId),
      name: name,
      photo_id: photoId,
      type: nyashkaType,
      description: description,
      level: 1,
      hp: baseStats.hp,
      max_hp: baseStats.hp,
      current_hp: baseStats.hp,
      attack: baseStats.attack,
      defense: baseStats.defense,
      exp: 0,
      wins: 0,
      losses: 0,
      created_at: new Date().toISOString()
    };

    const player = this.getPlayer(ownerId);
    player.nyashkas.push(nyashkaId);
    this.saveData();

    return nyashkaId;
  }

  generateId() {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => 
      Math.floor(Math.random() * 16).toString(16)
    );
  }
}

// Telegram API функції
async function sendMessage(chatId, text, replyMarkup = null, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error('Помилка відправки повідомлення:', error);
    return null;
  }
}

async function editMessage(chatId, messageId, text, replyMarkup = null, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML'
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error('Помилка редагування повідомлення:', error);
    return null;
  }
}

async function answerCallbackQuery(queryId, text = null, showAlert = false, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const body = {
    callback_query_id: queryId
  };

  if (text) {
    body.text = text;
    body.show_alert = showAlert;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error('Помилка відповіді на callback:', error);
    return null;
  }
}

// Обробники команд
async function handleStart(db, userId, chatId, username, botToken) {
  const player = db.getPlayer(userId);

  if (!player) {
    // Новий гравець - просимо ім'я
    const text = '👋 Привіт! Як тебе звати?';
    await sendMessage(chatId, text, null, botToken);
    
    const tempPlayer = db.getPlayer(userId);
    if (!tempPlayer) {
      db.players[String(userId)] = {
        user_id: String(userId),
        username: username,
        conversation_state: 'AWAITING_NAME',
        temp_data: {}
      };
      db.saveData();
    }
  } else {
    // Показати головне меню
    await showMainMenu(db, userId, chatId, botToken);
  }
}

async function showMainMenu(db, userId, chatId, botToken, messageId = null) {
  const player = db.getPlayer(userId);

  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 Профіль', callback_data: 'profile' }],
      [{ text: '🐾 Мої няшки', callback_data: 'my_nyashkas' }],
      [{ text: '🎰 Казино', callback_data: 'casino' }],
      [{ text: '⚔️ Війни', callback_data: 'wars' }],
      [{ text: '⛏️ Від бомжа до ПОЛЯНєра', callback_data: 'mining' }],
      [{ text: '👥 Клани', callback_data: 'clans' }],
      [{ text: '🏆 Рейтинг', callback_data: 'rating' }],
      [{ text: '🎁 Щоденна винагорода', callback_data: 'daily_reward' }],
      [{ text: '💼 Магазин', callback_data: 'shop' }]
    ]
  };

  const text = `🌟 Вітаємо в Імперії Няшок, ${player.name}!\n\n` +
    `💰 Баланс: ${player.balance} хуторикоїнів\n` +
    `⭐️ Рейтинг: ${player.rating}\n` +
    `🏅 Статистика: ${player.wins}W / ${player.losses}L\n\n` +
    `Оберіть дію:`;

  if (messageId) {
    await editMessage(chatId, messageId, text, keyboard, botToken);
  } else {
    await sendMessage(chatId, text, keyboard, botToken);
  }
}

async function handleProfile(db, userId, chatId, messageId, botToken) {
  const player = db.getPlayer(userId);
  const nyashkas = db.getNyashkasForPlayer(userId);

  const text = `👤 Профіль гравця\n\n` +
    `📝 Ім'я: ${player.name}\n` +
    `💰 Баланс: ${player.balance} хуторикоїнів\n` +
    `⭐️ Рейтинг: ${player.rating}\n` +
    `🏅 Перемоги: ${player.wins}\n` +
    `❌ Поразки: ${player.losses}\n` +
    `🐾 Няшок: ${nyashkas.length}\n` +
    `📅 Зареєстровано: ${new Date(player.created_at).toLocaleDateString('uk-UA')}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
    ]
  };

  await editMessage(chatId, messageId, text, keyboard, botToken);
}

async function handleMining(db, userId, chatId, messageId, botToken) {
  const player = db.getPlayer(userId);

  // Ініціалізація mining якщо немає
  if (!player.mining) {
    player.mining = {
      wood: { unlocked: true, count: 0, last_mined: null },
      stone: { unlocked: false, count: 0, last_mined: null },
      andesite: { unlocked: false, count: 0, last_mined: null },
      gold: { unlocked: false, count: 0, last_mined: null },
      diamond: { unlocked: false, count: 0, last_mined: null },
      nyashium: { unlocked: false, count: 0, last_mined: null }
    };
    db.saveData();
  }

  let text = '⛏️ Від бомжа до ПОЛЯНєра\n\n';
  text += `💰 Баланс: ${player.balance} хуторикоїнів\n\n`;
  text += '📊 Ваші ресурси:\n\n';

  const keyboard = [];

  for (const [resId, resData] of Object.entries(MINING_RESOURCES)) {
    const miningData = player.mining[resId];
    const emoji = resData.emoji;
    const name = resData.name;
    const count = miningData.count;

    if (miningData.unlocked) {
      // Перевірка кулдауну
      let canMine = true;
      let timeLeft = 0;

      if (miningData.last_mined) {
        const lastTime = new Date(miningData.last_mined);
        const timePassed = (Date.now() - lastTime.getTime()) / 1000;
        const cooldown = 30; // 30 секунд

        if (timePassed < cooldown) {
          canMine = false;
          timeLeft = Math.floor(cooldown - timePassed);
        }
      }

      text += `${emoji} ${name}: ${count} шт. (+${resData.income_percent}% дохід)\n`;

      if (canMine) {
        keyboard.push([{
          text: `⛏️ Рубати ${name}`,
          callback_data: `mine_${resId}`
        }]);
      } else {
        keyboard.push([{
          text: `⏰ ${name} (${timeLeft}с)`,
          callback_data: `cooldown_${resId}`
        }]);
      }
    } else {
      // Показати вимоги для розблокування
      const unlockRes = resData.unlock_resource;
      const unlockCount = resData.unlock_cost;

      if (unlockRes) {
        const currentCount = player.mining[unlockRes].count;
        const unlockName = MINING_RESOURCES[unlockRes].name;

        text += `🔒 ${name}: потрібно ${unlockName} x${unlockCount} (є ${currentCount})\n`;

        if (currentCount >= unlockCount) {
          keyboard.push([{
            text: `🔓 Розблокувати ${name}`,
            callback_data: `unlock_${resId}`
          }]);
        }
      }
    }
  }

  keyboard.push([{ text: '◀️ Назад', callback_data: 'back_to_menu' }]);

  await editMessage(chatId, messageId, text, { inline_keyboard: keyboard }, botToken);
}

async function handleMineResource(db, userId, chatId, queryId, messageId, resource, botToken) {
  const player = db.getPlayer(userId);
  const resData = MINING_RESOURCES[resource];
  const miningData = player.mining[resource];

  // Перевірка чи розблоковано
  if (!miningData.unlocked) {
    await answerCallbackQuery(queryId, '❌ Ресурс не розблоковано!', true, botToken);
    return;
  }

  // Перевірка кулдауну
  if (miningData.last_mined) {
    const lastTime = new Date(miningData.last_mined);
    const timePassed = (Date.now() - lastTime.getTime()) / 1000;

    if (timePassed < 30) {
      const timeLeft = Math.floor(30 - timePassed);
      await answerCallbackQuery(queryId, `⏰ Зачекайте ще ${timeLeft} секунд!`, true, botToken);
      return;
    }
  }

  // Видобуток ресурсу
  const baseReward = resData.base_reward;
  const bonus = Math.floor(baseReward * (resData.income_percent / 100));
  const totalReward = baseReward + bonus;

  miningData.count += 1;
  miningData.last_mined = new Date().toISOString();
  player.balance += totalReward;

  db.saveData();

  await answerCallbackQuery(
    queryId,
    `${resData.emoji} Зрубано ${resData.name}!\n+${totalReward} хуторикоїнів (+${resData.income_percent}%)`,
    true,
    botToken
  );

  await handleMining(db, userId, chatId, messageId, botToken);
}

async function handleUnlockResource(db, userId, chatId, queryId, messageId, resource, botToken) {
  const player = db.getPlayer(userId);
  const resData = MINING_RESOURCES[resource];
  const miningData = player.mining[resource];

  // Перевірка чи вже розблоковано
  if (miningData.unlocked) {
    await answerCallbackQuery(queryId, '✅ Вже розблоковано!', true, botToken);
    return;
  }

  // Перевірка вимог
  const unlockRes = resData.unlock_resource;
  const unlockCount = resData.unlock_cost;

  if (unlockRes) {
    const currentCount = player.mining[unlockRes].count;

    if (currentCount < unlockCount) {
      await answerCallbackQuery(
        queryId,
        `❌ Недостатньо ${MINING_RESOURCES[unlockRes].name}!\nПотрібно: ${unlockCount}, є: ${currentCount}`,
        true,
        botToken
      );
      return;
    }

    // Витрачаємо ресурси
    player.mining[unlockRes].count -= unlockCount;
  }

  // Розблокування
  miningData.unlocked = true;
  db.saveData();

  await answerCallbackQuery(
    queryId,
    `🎉 ${resData.name} розблоковано!\nДохід: +${resData.income_percent}%`,
    true,
    botToken
  );

  await handleMining(db, userId, chatId, messageId, botToken);
}

// Головний обробник
async function processUpdate(db, update, botToken) {
  try {
    // Обробка повідомлень
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const username = message.from.username || 'user';

      // Команда /start
      if (message.text && message.text === '/start') {
        await handleStart(db, userId, chatId, username, botToken);
        return;
      }

      // Обробка стану розмови
      const player = db.getPlayer(userId);
      if (player && player.conversation_state) {
        if (player.conversation_state === 'AWAITING_NAME' && message.text) {
          // Зберігаємо ім'я і просимо фото
          player.temp_data.name = message.text;
          player.conversation_state = 'AWAITING_PHOTO';
          db.saveData();

          await sendMessage(chatId, '📸 Тепер надішли своє фото для профілю:', null, botToken);
        } else if (player.conversation_state === 'AWAITING_PHOTO' && message.photo) {
          // Зберігаємо фото і створюємо гравця
          const photoId = message.photo[message.photo.length - 1].file_id;
          const name = player.temp_data.name;

          db.createPlayer(userId, username, name, photoId);
          await sendMessage(chatId, '✅ Профіль створено!', null, botToken);
          await showMainMenu(db, userId, chatId, botToken);
        }
      }
    }

    // Обробка callback queries
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const userId = query.from.id;
      const data = query.data;

      await answerCallbackQuery(query.id, null, false, botToken);

      if (data === 'back_to_menu') {
        await showMainMenu(db, userId, chatId, botToken, messageId);
      } else if (data === 'profile') {
        await handleProfile(db, userId, chatId, messageId, botToken);
      } else if (data === 'mining') {
        await handleMining(db, userId, chatId, messageId, botToken);
      } else if (data.startsWith('mine_')) {
        const resource = data.replace('mine_', '');
        await handleMineResource(db, userId, chatId, query.id, messageId, resource, botToken);
      } else if (data.startsWith('unlock_')) {
        const resource = data.replace('unlock_', '');
        await handleUnlockResource(db, userId, chatId, query.id, messageId, resource, botToken);
      } else if (data.startsWith('cooldown_')) {
        await answerCallbackQuery(query.id, '⏰ Зачекайте, ресурс ще не відновився!', true, botToken);
      }
      // Тут можна додати інші обробники
    }
  } catch (error) {
    console.error('Помилка обробки update:', error);
  }
}

// Експорт для Vercel
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Telegram Bot API is running! ✅' });
  }

  try {
    const { update, bot_token } = req.body;

    if (!update || !bot_token) {
      return res.status(400).json({ error: 'Missing update or bot_token' });
    }

    const db = new Database();
    await processUpdate(db, update, bot_token);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
