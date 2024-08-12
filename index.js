const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch'); // تأكد من وجود هذه المكتبة

// وضع التوكن الخاص بالبوت
const token = '7201159369:AAFeKi6GT73iDalEH8_e8W9x41weAhb0NmU';

// إنشاء بوت تيليجرام
const bot = new TelegramBot(token, { polling: true });

// مفتاح رئيسي لتشفير المفتاح السري
const masterKey = 'super-master-key-for-encrypting-secret-key';

// دالة لتشفير وفك تشفير باستخدام Base64
function encryptBase64(text) {
    return Buffer.from(text).toString('base64');
}

function decryptBase64(base64) {
    return Buffer.from(base64, 'base64').toString('utf8');
}

// دالة لفك تشفير نص معين
function decryptText(encryptedText, encryptedSecretKey) {
    try {
        const secretKey = decryptBase64(encryptedSecretKey);
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
        return decryptedBytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        throw new Error('Error decrypting the text: ' + error.message);
    }
}

// دالة لتشفير نص معين
function encryptText(text, secretKey) {
    try {
        const encrypted = CryptoJS.AES.encrypt(text, secretKey);
        return encrypted.toString();
    } catch (error) {
        throw new Error('Error encrypting the text: ' + error.message);
    }
}

// دالة لتشفير المفتاح السري
function encryptSecretKey(secretKey, masterKey) {
    return encryptBase64(CryptoJS.AES.encrypt(secretKey, masterKey).toString());
}

// دالة لفك تشفير المفتاح السري
function decryptSecretKey(encryptedSecretKey, masterKey) {
    const decrypted = CryptoJS.AES.decrypt(decryptBase64(encryptedSecretKey), masterKey);
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// توليد المفتاح السري وتشفيره
const secretKey = 'your-strong-secret-key';
const encryptedSecretKey = encryptSecretKey(secretKey, masterKey);

// الرد على الأمر /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'أرسل لي ملف JavaScript لأقوم بتشفيره أو استخدم الأمر /decrypt لفك التشفير.');
});

// معالجة المستندات (الملفات) التي يتم إرسالها للتشفير
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    const fileExtension = path.extname(document.file_name).toLowerCase();

    // التحقق من أن الملف هو ملف JavaScript
    if (fileExtension !== '.js') {
        bot.sendMessage(chatId, 'يرجى إرسال ملف JavaScript فقط.');
        return;
    }

    try {
        // تحميل الملف المرسل
        const fileLink = await bot.getFileLink(document.file_id);
        const response = await fetch(fileLink);
        const fileBuffer = await response.buffer();
        const jsCode = fileBuffer.toString('utf8');

        // تشفير النص بالكامل
        const encryptedCode = encryptText(jsCode, secretKey);

        // إنشاء الملف المشفر الجديد
        const encryptedJsContent = `
const CryptoJS = require('crypto-js');

function decryptBase64(base64) {
    return Buffer.from(base64, 'base64').toString('utf8');
}

function decryptText(encryptedText, encryptedSecretKey) {
    const secretKey = decryptBase64(encryptedSecretKey);
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
    return decryptedBytes.toString(CryptoJS.enc.Utf8);
}

const encryptedSecretKey = '${encryptedSecretKey}';
const encryptedCode = "${encryptedCode}";
eval(decryptText(encryptedCode, encryptedSecretKey));
`;

        const encryptedFilePath = path.join(__dirname, `encrypted_${document.file_name}`);
        fs.writeFileSync(encryptedFilePath, encryptedJsContent, 'utf8');

        // إرسال الملف المشفر
        await bot.sendDocument(chatId, encryptedFilePath);
        bot.sendMessage(chatId, 'تم تشفير الملف بنجاح وإرساله.');

        // حذف الملفات المؤقتة
        fs.unlinkSync(encryptedFilePath);
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء معالجة الملف: ${error.message}`);
    }
});

// الرد على الأمر /decrypt
bot.onText(/\/decrypt/, (msg) => {
    bot.sendMessage(msg.chat.id, 'أرسل لي ملف JavaScript المشفر لأقوم بفك تشفيره.');
});

// معالجة الملفات المرسلة لفك التشفير
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    const fileExtension = path.extname(document.file_name).toLowerCase();

    // التحقق من أن الملف هو ملف JavaScript مشفر
    if (!document.file_name.startsWith('encrypted_') || fileExtension !== '.js') {
        bot.sendMessage(chatId, 'يرجى إرسال ملف JavaScript مشفر فقط.');
        return;
    }

    try {
        // تحميل الملف المرسل
        const fileLink = await bot.getFileLink(document.file_id);
        const response = await fetch(fileLink);
        const fileBuffer = await response.buffer();
        const jsCode = fileBuffer.toString('utf8');

        // تنفيذ الكود المشفر
        const decryptedCode = eval(jsCode);

        const decryptedFilePath = path.join(__dirname, `decrypted_${document.file_name.replace('encrypted_', '')}`);
        fs.writeFileSync(decryptedFilePath, decryptedCode, 'utf8');

        // إرسال الملف المفكك
        await bot.sendDocument(chatId, decryptedFilePath);
        bot.sendMessage(chatId, 'تم فك تشفير الملف بنجاح وإرساله.');

        // حذف الملفات المؤقتة
        fs.unlinkSync(decryptedFilePath);
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء فك التشفير: ${error.message}`);
    }
});
