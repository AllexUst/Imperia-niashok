// Google Apps Script - Telegram Bot Webhook Receiver
// Цей файл розміщується в Google Apps Script

const VERCEL_API_URL = 'YOUR_VERCEL_URL'; // Замініть на URL вашого Vercel API
const BOT_TOKEN = '8351192191:AAGEU6HO3q8pjaKSE2BDi5mUihSbKMHuoZc';

/**
 * Головна функція для обробки POST запитів від Telegram
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    
    // Логування для дебагу
    Logger.log('Отримано update: ' + JSON.stringify(update));
    
    // Відправка запиту на Vercel для обробки
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({
        update: update,
        bot_token: BOT_TOKEN
      }),
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(VERCEL_API_URL + '/api/bot', options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log('Відповідь від Vercel: ' + JSON.stringify(result));
    
    // Повертаємо успішну відповідь Telegram
    return ContentService.createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Помилка: ' + error.toString());
    
    // Навіть при помилці повертаємо OK, щоб Telegram не повторював запит
    return ContentService.createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Функція для тестування GET запитів
 */
function doGet(e) {
  return ContentService.createTextOutput('Telegram Bot Webhook is running! ✅')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Налаштування webhook (запустіть цю функцію один раз після розгортання)
 */
function setWebhook() {
  const webAppUrl = 'YOUR_APPS_SCRIPT_URL'; // Замініть на URL вашого Apps Script
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webAppUrl}`;
  
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook встановлено: ' + response.getContentText());
}

/**
 * Видалення webhook (для відладки)
 */
function deleteWebhook() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook видалено: ' + response.getContentText());
}

/**
 * Перевірка статусу webhook
 */
function getWebhookInfo() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Інформація про webhook: ' + response.getContentText());
}
