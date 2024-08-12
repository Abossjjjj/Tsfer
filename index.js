
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');

// وضع التوكن الخاص بالبوت
const token = '7201159369:AAFeKi6GT73iDalEH8_e8W9x41weAhb0NmU';

// إنشاء بوت تيليجرام
const bot = new TelegramBot(token, { polling: true });

// خادم HTTP بسيط
const PORT = process.env.PORT || 3000; // استخدام المنفذ الذي توفره الاستضافة أو 3000 كافتراضي


// دالة لفك تشفير نص معين
function decryptText(encryptedText, secretKey) {
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
    return decryptedBytes.toString(CryptoJS.enc.Utf8);
}

// دالة لتشفير نص معين
function encryptText(text, secretKey) {
    return CryptoJS.AES.encrypt(text, secretKey).toString();
}

// الرد على الأمر /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'أرسل لي ملف JavaScript لأقوم بتشفيره أو استخدم الأمر /decrypt لفك التشفير.');
});

// معالجة المستندات (الملفات) التي يتم إرسالها
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
        const filePath = path.join(__dirname, document.file_name);
        const secretKey = 'your-strong-secret-key'; // استخدم مفتاحًا سريًا قويًا

        const response = await fetch(fileLink);
        const fileBuffer = await response.buffer();
        fs.writeFileSync(filePath, fileBuffer);

        // قراءة محتويات الملف
        const jsCode = fs.readFileSync(filePath, 'utf8');

        // تشفير النص بالكامل
        const encryptedCode = encryptText(jsCode, secretKey);

        // إنشاء الملف المشفر الجديد
        const encryptedFilePath = path.join(__dirname, `encrypted_${document.file_name}`);
        const encryptedJsContent = `
const CryptoJS = require('crypto-js');

function decryptText(encryptedText, secretKey) {
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
    return decryptedBytes.toString(CryptoJS.enc.Utf8);
}

const secretKey = '${secretKey}';
const encryptedCode = "${encryptedCode}";
eval(decryptText(encryptedCode, secretKey));
`;
        fs.writeFileSync(encryptedFilePath, encryptedJsContent, 'utf8');

        // إرسال الملف المشفر
        await bot.sendDocument(chatId, encryptedFilePath);
        bot.sendMessage(chatId, 'تم تشفير الملف بنجاح وإرساله.');

        // حذف الملفات المؤقتة
        fs.unlinkSync(filePath);
        fs.unlinkSync(encryptedFilePath);
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ: ${error.message}`);
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
        const filePath = path.join(__dirname, document.file_name);
        const secretKey = 'your-strong-secret-key'; // استخدم مفتاحًا سريًا قويًا

        const response = await fetch(fileLink);
        const fileBuffer = await response.buffer();
        fs.writeFileSync(filePath, fileBuffer);

        // فك تشفير النص
        const encryptedJsContent = fs.readFileSync(filePath, 'utf8');
        const decryptedCode = eval(encryptedJsContent);

        const decryptedFilePath = path.join(__dirname, `decrypted_${document.file_name.replace('encrypted_', '')}`);
        fs.writeFileSync(decryptedFilePath, decryptedCode, 'utf8');

        // إرسال الملف المفكك
        await bot.sendDocument(chatId, decryptedFilePath);
        bot.sendMessage(chatId, 'تم فك تشفير الملف بنجاح وإرساله.');

        // حذف الملفات المؤقتة
        fs.unlinkSync(filePath);
        fs.unlinkSync(decryptedFilePath);
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ: ${error.message}`);
    }
});
