const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const CryptoJS = require('crypto-js');

// وضع التوكن الخاص بالبوت
const token = '7201159369:AAFeKi6GT73iDalEH8_e8W9x41weAhb0NmU';

// إنشاء بوت تيليجرام
const bot = new TelegramBot(token, { polling: true });

// دالة لفك تشفير ملف JavaScript
function decryptJS(filePath, secretKey) {
    try {
        const encryptedCode = fs.readFileSync(filePath, 'utf8');
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedCode, secretKey);
        const decryptedCode = decryptedBytes.toString(CryptoJS.enc.Utf8);

        return decryptedCode;
    } catch (error) {
        console.error("An error occurred during decryption:", error);
        return null;
    }
}

// دالة لتشفير ملف JavaScript
function encryptJS(filePath, secretKey) {
    try {
        const jsCode = fs.readFileSync(filePath, 'utf8');
        const encryptedCode = CryptoJS.AES.encrypt(jsCode, secretKey).toString();

        const tempFilePath = `encrypted_${filePath}`;
        fs.writeFileSync(tempFilePath, encryptedCode, 'utf8');

        return tempFilePath;
    } catch (error) {
        console.error("An error occurred during encryption:", error);
        return null;
    }
}

// الرد على الأمر /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'أرسل لي ملف JavaScript لأقوم بتشفيره.');
});

// معالجة المستندات (الملفات) التي يتم إرسالها
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;

    try {
        // تحميل الملف المرسل
        const fileLink = await bot.getFileLink(document.file_id);
        const filePath = `${__dirname}/${document.file_name}`;
        const secretKey = 'your-secret-key'; // استخدم مفتاحًا سريًا قويًا

        const response = await fetch(fileLink);
        const fileBuffer = await response.buffer();
        fs.writeFileSync(filePath, fileBuffer);

        // تشفير الملف
        const encryptedFilePath = encryptJS(filePath, secretKey);

        if (encryptedFilePath) {
            // إرسال الملف المشفر
            await bot.sendDocument(chatId, encryptedFilePath);
            bot.sendMessage(chatId, 'تم تشفير الملف بنجاح وإرساله.');
        } else {
            bot.sendMessage(chatId, 'حدث خطأ أثناء تشفير الملف.');
        }

        // حذف الملفات المؤقتة
        fs.unlinkSync(filePath);
        if (encryptedFilePath) {
            fs.unlinkSync(encryptedFilePath);
        }
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ: ${error.message}`);
    }
});