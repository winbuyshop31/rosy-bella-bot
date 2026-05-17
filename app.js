const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ============================================
//   ⚙️ إعدادات البوت — عدّل هنا فقط
// ============================================
const PAGE_TOKEN   = process.env.PAGE_TOKEN   || 'ضع_توكن_فيسبوك_هنا';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'rosybella2025';
const SHEETS_URL   = process.env.SHEETS_URL   || ''; // رابط Google Apps Script

// ============================================
//   🛍️ قائمة المنتجات
// ============================================
const products = [
  {
    sku: 'RB-T001',
    name: 'طقم تنكري أخضر من التول والدانتيل',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778764813_0f87bb50_23f830cd3fb1.webp',
    url: 'https://rosybellalingerie.shop/product/25367'
  },
  {
    sku: 'RB-R001',
    name: 'طقم بفتحة مع رباط دانتيل',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778081286_28718e91_f368f9a7ce54.webp',
    url: 'https://rosybellalingerie.shop/product/20041'
  },
  {
    sku: 'RB-R002',
    name: 'طقم رباط أسود فاخر مع سلسلة',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778077755_cb015d62_93e3d8581126.webp',
    url: 'https://rosybellalingerie.shop/product/19999'
  },
  {
    sku: 'RB-T002',
    name: 'طقم تنكري أحمر من التول والدانتيل',
    price: 2850, oldPrice: 3950,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778764813_94f702c7_86c9d733a453.webp',
    url: 'https://rosybellalingerie.shop/product/20033'
  },
  {
    sku: 'RB-R003',
    name: 'طقم رباط نسائي باللون الأزرق',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778081286_05e9df8b_bf54496ea48a.webp',
    url: 'https://rosybellalingerie.shop/product/20047'
  },
  {
    sku: 'RB-R004',
    name: 'طقم رباط ساق وردي بسلسلة',
    price: 2850, oldPrice: 3950,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778077755_efecb79d_4ce7b1f70841.webp',
    url: 'https://rosybellalingerie.shop/product/20039'
  },
  {
    sku: 'RB-R005',
    name: 'طقم برباط من الدانتيل الأبيض',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778081286_fa636e92_e82202b5ef9b.webp',
    url: 'https://rosybellalingerie.shop/product/25360'
  },
  {
    sku: 'RB-R006',
    name: 'طقم خيالي برباط من الدانتيل الأحمر',
    price: 2550, oldPrice: 3750,
    img: 'https://cdn.dzbuild.app/uploads/products/8609/8609_1778077755_bee25bd4_e82202b5ef9b.webp',
    url: 'https://rosybellalingerie.shop/product/20057'
  },
];

// ============================================
//   💾 جلسات الزبائن (مؤقتة في الذاكرة)
// ============================================
const sessions = {};

function getSession(uid) {
  if (!sessions[uid]) sessions[uid] = { step: null, order: {} };
  return sessions[uid];
}

// ============================================
//   🔗 Webhook فيسبوك
// ============================================
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      const event = entry.messaging?.[0];
      if (!event) continue;
      const uid = event.sender.id;
      try {
        if (event.message?.text) {
          await handleMessage(uid, event.message.text);
        } else if (event.postback?.payload) {
          await handlePostback(uid, event.postback.payload);
        }
      } catch (e) {
        console.error('Error handling event:', e.message);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// ============================================
//   💬 معالجة الرسائل
// ============================================
async function handleMessage(uid, text) {
  const session = getSession(uid);
  const t = text.trim();

  // -- مراحل الحجز --
  if (session.step === 'name') {
    session.order.name = t;
    session.step = 'phone';
    return sendText(uid, '✅ شكراً!\n\n📱 أرسل رقم هاتفك:');
  }
  if (session.step === 'phone') {
    session.order.phone = t;
    session.step = 'wilaya';
    return sendText(uid, '📱 ممتاز!\n\n📍 في أي ولاية تريد التوصيل؟');
  }
  if (session.step === 'wilaya') {
    session.order.wilaya = t;
    session.step = null;
    return finishOrder(uid, session);
  }

  // -- البحث بالكود --
  const bySku = products.find(p => p.sku.toLowerCase() === t.toLowerCase());
  if (bySku) return sendProductCard(uid, bySku);

  // -- الكلمات المفتاحية --
  const lower = t.toLowerCase();
  if (lower.match(/مرحب|اهلا|السلام|بوجور|هلا/))
    return sendWelcome(uid);

  if (lower.match(/منتج|عرض|شوف|كاتالوج|قائمة/))
    return sendCarousel(uid);

  if (lower.match(/سعر|كم|بكام|بقداش/))
    return sendText(uid, '💰 عروضنا الآن:\n\n🔥 خصم 35% على كل شيء!\n👗 أطقم من 2,550 دج\n🚚 شحن مجاني من 4,000 دج\n💳 دفع عند الاستلام');

  if (lower.match(/شحن|توصيل/))
    return sendText(uid, '🚚 معلومات التوصيل:\n\n📦 شحن مجاني من 4,000 دج\n⏱️ 2-4 أيام عمل\n💳 دفع عند الاستلام\n🇩🇿 جميع ولايات الجزائر');

  if (lower.match(/تتبع|رقم طلب/))
    return sendText(uid, '🔍 تتبع طلبك على:\nhttps://rosybellalingerie.shop/track-order\n\nأو أرسل لنا رقم طلبك 📱');

  if (lower.match(/حجز|اطلب|عايز|بغيت/))
    return sendCarousel(uid);

  // -- بحث بالاسم أو اللون --
  const keywords = ['أخضر','أحمر','أسود','أبيض','وردي','أزرق','تنكري','رباط','نوم','كبير','دانتيل'];
  const matched = keywords.filter(k => lower.includes(k));
  if (matched.length > 0) {
    const found = products.filter(p => matched.some(k => p.name.includes(k)));
    if (found.length === 1) return sendProductCard(uid, found[0]);
    if (found.length > 1)  return sendCarousel(uid, found);
  }

  // -- رد افتراضي --
  return sendButtons(uid,
    'عذراً لم أفهم 😊\nاختر من الخيارات أو تواصل معنا على واتساب:\n0791841673',
    [
      { title: '🛍️ عرض المنتجات', payload: 'SHOW_PRODUCTS' },
      { title: '📦 حجز طلب',       payload: 'START_ORDER'   },
      { title: '🚚 الشحن',         payload: 'SHOW_SHIPPING'  },
    ]
  );
}

// ============================================
//   🖱️ معالجة الضغط على الأزرار
// ============================================
async function handlePostback(uid, payload) {
  const session = getSession(uid);

  if (payload === 'SHOW_PRODUCTS') return sendCarousel(uid);
  if (payload === 'START_ORDER')   return sendCarousel(uid);
  if (payload === 'SHOW_PRICES')   return sendText(uid, '💰 خصم 35%!\nأطقم من 2,550 دج\nشحن مجاني من 4,000 دج 🚚');
  if (payload === 'SHOW_SHIPPING') return sendText(uid, '🚚 شحن مجاني من 4,000 دج\n2-4 أيام عمل\nدفع عند الاستلام 💳');
  if (payload === 'TRACK_ORDER')   return sendText(uid, '🔍 https://rosybellalingerie.shop/track-order');

  if (payload.startsWith('ORDER_')) {
    const sku = payload.replace('ORDER_', '');
    const product = products.find(p => p.sku === sku);
    if (product) {
      session.order = { product: product.name, sku: product.sku, price: product.price };
      session.step = 'name';
      return sendText(uid,
        `اخترت: ${product.name} 💖\n🏷️ كود: ${product.sku}\n💰 ${product.price.toLocaleString()} دج\n\n👤 أرسل اسمك الكامل لإكمال الطلب:`
      );
    }
  }
}

// ============================================
//   ✅ إنهاء الطلب
// ============================================
async function finishOrder(uid, session) {
  const id = 'RB' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const order = {
    id,
    ...session.order,
    date: now.toLocaleDateString('ar-DZ'),
    time: now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
    status: 'جديد'
  };

  // إرسال لـ Google Sheets
  await sendToSheets(order);

  await sendText(uid,
    `🎉 تم استلام طلبك بنجاح!\n\n` +
    `🔖 رقم الطلب: ${order.id}\n` +
    `🏷️ كود المنتج: ${order.sku || '—'}\n` +
    `👤 الاسم: ${order.name}\n` +
    `📱 الهاتف: ${order.phone}\n` +
    `📍 الولاية: ${order.wilaya}\n` +
    `🛍️ المنتج: ${order.product}\n` +
    `💰 السعر: ${order.price?.toLocaleString()} دج\n\n` +
    `سنتصل بك للتأكيد قريباً 💖\n` +
    `Rosy Bella Lingerie 🌸`
  );
}

// ============================================
//   📤 دوال الإرسال
// ============================================
async function sendText(uid, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    { recipient: { id: uid }, message: { text } }
  );
}

async function sendButtons(uid, text, buttons) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    {
      recipient: { id: uid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text,
            buttons: buttons.map(b => ({ type: 'postback', title: b.title, payload: b.payload }))
          }
        }
      }
    }
  );
}

async function sendProductCard(uid, p) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    {
      recipient: { id: uid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [{
              title: p.name,
              subtitle: `💰 ${p.price.toLocaleString()} دج | 🏷️ ${p.sku}`,
              image_url: p.img,
              buttons: [
                { type: 'postback', title: '📦 أحجز هذا', payload: `ORDER_${p.sku}` },
                { type: 'web_url',  title: '🔗 التفاصيل', url: p.url }
              ]
            }]
          }
        }
      }
    }
  );
}

async function sendCarousel(uid, list) {
  const items = (list || products).slice(0, 10);
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    {
      recipient: { id: uid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: items.map(p => ({
              title: p.name,
              subtitle: `💰 ${p.price.toLocaleString()} دج  |  🏷️ ${p.sku}`,
              image_url: p.img,
              buttons: [
                { type: 'postback', title: '📦 أحجز هذا', payload: `ORDER_${p.sku}` },
                { type: 'web_url',  title: '🔗 التفاصيل', url: p.url }
              ]
            }))
          }
        }
      }
    }
  );
}

async function sendWelcome(uid) {
  await sendButtons(uid,
    'أهلاً وسهلاً! 💖\nمرحباً في Rosy Bella Lingerie\nستايل تركي فاخر 🇹🇷\n\nكيف أقدر أساعدك؟',
    [
      { title: '🛍️ عرض المنتجات', payload: 'SHOW_PRODUCTS' },
      { title: '📦 حجز طلب',       payload: 'START_ORDER'   },
      { title: '💰 الأسعار',        payload: 'SHOW_PRICES'   },
    ]
  );
}

// ============================================
//   📊 Google Sheets
// ============================================
async function sendToSheets(order) {
  if (!SHEETS_URL) return;
  try {
    await axios.post(SHEETS_URL, order, { timeout: 5000 });
    console.log('✅ تم الإرسال لـ Google Sheets:', order.id);
  } catch (e) {
    console.error('⚠️ Sheets error:', e.message);
  }
}

// ============================================
//   🏠 صفحة رئيسية للتأكد أن البوت شغّال
// ============================================
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family:sans-serif;text-align:center;padding:40px;direction:rtl;">
      <h1>🌸 Rosy Bella Bot</h1>
      <p style="color:green;font-size:20px;">✅ البوت يشتغل!</p>
      <p>Webhook: <code>/webhook</code></p>
      <p><a href="https://rosybellalingerie.shop">rosybellalingerie.shop</a></p>
    </div>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌸 Rosy Bella Bot يشتغل على port ${PORT}`));
