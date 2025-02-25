require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const playdl = require('play-dl');

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
    console.error("❌ ERROR: YOUTUBE_API_KEY is missing! Please set it in .env or Vercel settings.");
    process.exit(1);
}

console.log(`🔑 تم تحميل مفتاح API: ${API_KEY.substring(0, 8)}...`);

// تهيئة play-dl مع الكوكيز
const initPlayDL = async () => {
    try {
        await playdl.setToken({
            youtube: {
                cookie: `SID=g.a000tQhow7geJZpBtLbaPDK_cMNkcpDcpWGWSMDJL3RQQLq7cIVADvnYWAomxciohVdtzeiqtgACgYKAS4SARQSFQHGX2MifABpkTQ-y-1yocitwvDFlxoVAUF8yKrLpTM9v_tEF6E4O2tSmhJU0076; __Secure-1PSID=g.a000tQhow7geJZpBtLbaPDK_cMNkcpDcpWGWSMDJL3RQQLq7cIVAd51Q8GmI_4F0sArLW6rpXQACgYKAXkSARQSFQHGX2MiNqCWJ_kGwloB2INW5Xb9zhoVAUF8yKq1En3JAxhJDOasFidSHwF50076; __Secure-3PSID=g.a000tQhow7geJZpBtLbaPDK_cMNkcpDcpWGWSMDJL3RQQLq7cIVAvTbl4Otg1OrFU_MCMgLa9QACgYKAXkSARQSFQHGX2MiOI9C6mWLfC1wXuAagh-G5xoVAUF8yKruKpg5mj1cRLG-SdKshYXv0076; HSID=AHSB4ZxGVcZzfSMdx; SSID=A0EREnGtbtu62cPbe; APISID=cqLL8dAfuOuNzIV8/AhI2Ff-qit72KBqPH; SAPISID=7bedCbXyCFmRNkBK/AFkXKvCeHNb_K2QP7; __Secure-1PAPISID=7bedCbXyCFmRNkBK/AFkXKvCeHNb_K2QP7; __Secure-3PAPISID=7bedCbXyCFmRNkBK/AFkXKvCeHNb_K2QP7; LOGIN_INFO=AFmmF2swRAIgSZ7crhdUHxdo8LlnXwgxdqryplBlZa0JrCoRjvbbrYwCICg35OH54LM3Os4um0YYbUpoaQoXsstn1npQWeJeDok2:QUQ3MjNmd05iQkxyZXRpZXVLZFVMTWhMWVFKalVBYlVqRlNCV2JHdG4xVE83dHVWZ0Jybm9Yd0QzazlsMkNkVWpab3NrUXZkb2Z4Q0QyWXpBUmIyNU9KdHpkLXVwUFR5N1NHcWFMSlFpMjJuUUJ3VTRDWnlXV0o1ZTJBbG04MHhobm1GWUJUUkFoS1J1MW1FMnlrOThCaG5iRF9ZN0xKY2N3; PREF=tz=Africa.Cairo&f6=40000000&f7=100; __Secure-1PSIDTS=sidts-CjEBEJ3XV3_z31puNOt7Un0CqUZ-RmKkzesUrt_tpfWdml02p_yWN8YE1S4V05q0E4JZEAA; __Secure-3PSIDTS=sidts-CjEBEJ3XV3_z31puNOt7Un0CqUZ-RmKkzesUrt_tpfWdml02p_yWN8YE1S4V05q0E4JZEAA; SIDCC=AKEyXzVaKOdpg4Y4s_j6JBF-_ZPQnc2jDId24v3V0IVAheLN-RYNCIlRpf3zNtqk5l9ULCGwZO8; __Secure-1PSIDCC=AKEyXzVgUcr21k42A43g9C0CTz5wVA4jRWY0RcfyiUMwyZm19wO9zBRZmr2gSoAA0YmQcZ0me5w; __Secure-3PSIDCC=AKEyXzWQig3X9QBDc84i9_8iQIs8REzVzkecK9AFuzFifpMBgMaRGE7tyoOUmAzqT3Ykn4rFJNc; VISITOR_INFO1_LIVE=Iql3k0bgMD0; VISITOR_PRIVACY_METADATA=CgJFRxIEGgAgGw%3D%3D; YSC=qLzeGaUVXWU`
            }
        });
        console.log('✅ تم تهيئة play-dl بنجاح مع الكوكيز');
    } catch (error) {
        console.error('❌ خطأ في تهيئة play-dl:', error);
    }
};

// استدعاء التهيئة عند بدء التطبيق
initPlayDL();

const app = express();
app.use(cors());
app.use(express.json());

// دالة لاستخراج معرف الفيديو
function extractVideoID(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/(?:embed|v|shorts)\/))([^?&]+)/);
    return match ? match[1] : null;
}

// الحصول على معلومات الفيديو
app.get('/api/info', async (req, res) => {
    try {
        const url = decodeURIComponent(req.query.url);
        console.log('📌 URL المستلم:', url);
        console.log('🔄 URL بعد فك الترميز:', url);

        console.log('🔄 جاري جلب معلومات الفيديو...');
        const info = await playdl.video_basic_info(url);
        console.log('✅ تم جلب معلومات الفيديو الأساسية');
        console.log('📹 عنوان الفيديو:', info.video_details.title);

        // استخراج الصيغ من معلومات الفيديو الأساسية
        const formats = info.format.map(format => {
            console.log('🔄 معالجة الصيغة:', {
                itag: format.itag,
                quality: format.qualityLabel,
                hasAudio: format.hasAudio,
                hasVideo: format.hasVideo
            });
            
            return {
                itag: format.itag || 0,
                quality: format.qualityLabel || 'Unknown',
                hasAudio: Boolean(format.hasAudio),
                hasVideo: Boolean(format.hasVideo),
                container: 'mp4',
                fps: format.fps,
                filesize: parseInt(format.contentLength) || 0,
                audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null
            };
        });

        console.log('📊 عدد الصيغ المتاحة:', formats.length);

        const response = {
            title: info.video_details.title,
            thumbnail: info.video_details.thumbnails[0].url,
            duration: info.video_details.durationInSec,
            views: info.video_details.views,
            formats: formats,
            author: info.video_details.channel.name,
            description: info.video_details.description,
            publishedAt: info.video_details.uploadedAt,
            likes: info.video_details.likes,
            dislikes: info.video_details.dislikes
        };

        console.log('✅ تم تجهيز البيانات للإرسال');
        res.json(response);
    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        res.status(500).json({
            error: error.message || 'حدث خطأ أثناء جلب معلومات الفيديو'
        });
    }
});

// تحميل الفيديو
app.get('/api/download', async (req, res) => {
    try {
        const { url, itag } = req.query;
        console.log('📥 طلب تحميل:', { url, itag });

        if (!url || !itag) {
            return res.status(400).json({ 
                error: 'بيانات غير مكتملة',
                details: 'يجب توفير رابط الفيديو والجودة المطلوبة'
            });
        }

        const videoId = extractVideoID(url);
        if (!videoId) {
            return res.status(400).json({ 
                error: 'رابط غير صالح',
                details: 'الرابط لا يتطابق مع صيغة روابط يوتيوب'
            });
        }

        console.log('🔍 جاري التحقق من الصيغ المتاحة...');
        const videoInfo = await playdl.video_basic_info(url);
        
        // البحث عن الصيغة في كلا المصدرين
        const formats = videoInfo.format || [];
        const format = formats.find(f => f.itag === parseInt(itag));

        if (!format) {
            console.error('❌ الصيغة المطلوبة غير متوفرة:', itag);
            return res.status(400).json({
                error: 'الصيغة غير متوفرة',
                details: `الصيغة المطلوبة (${itag}) غير متوفرة للفيديو`
            });
        }

        console.log('✅ تم العثور على الصيغة المطلوبة:', {
            itag: format.itag,
            quality: format.qualityLabel,
            container: format.container
        });

        const stream = await playdl.stream(url, { quality: parseInt(itag) });
        console.log('✅ تم بدء تدفق الفيديو');

        const sanitizedTitle = videoInfo.video_details.title
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '_');

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp4"`);

        let downloadedBytes = 0;
        stream.stream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (format.contentLength) {
                const progress = (downloadedBytes / parseInt(format.contentLength) * 100).toFixed(2);
                console.log(`📊 تقدم التحميل: ${progress}%`);
            }
        });

        stream.stream.on('end', () => {
            console.log('✅ اكتمل تحميل الفيديو');
        });

        stream.stream.on('error', (error) => {
            console.error('❌ خطأ في تدفق الفيديو:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'فشل في تحميل الفيديو',
                    details: error.message
                });
            }
        });

        stream.stream.pipe(res);
    } catch (error) {
        console.error('❌ خطأ في تحميل الفيديو:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'حدث خطأ أثناء تحميل الفيديو',
                details: error.message
            });
        }
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${port}`);
    console.log('✨ تم تهيئة الخادم بنجاح');
});
