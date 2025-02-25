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

// تهيئة play-dl
(async () => {
    try {
        await playdl.setToken({
            youtube: {
                cookie: process.env.YOUTUBE_COOKIE || ''
            }
        });
        console.log('✅ تم تهيئة play-dl بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تهيئة play-dl:', error);
        process.exit(1); // إضافة هذا السطر لإيقاف تشغيل الخادم في حالة فشل تهيئة play-dl
    }
})();

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
        let { url } = req.query;
        console.log('📥 URL المستلم:', url);

        // فك ترميز URL
        url = decodeURIComponent(decodeURIComponent(url));
        console.log('🔄 URL بعد فك الترميز:', url);

        if (!url) {
            throw new Error('URL مطلوب');
        }

        // التحقق من صحة URL
        if (!url.match(/^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+$/)) {
            throw new Error('رابط يوتيوب غير صالح');
        }

        console.log('🔄 جاري جلب معلومات الفيديو...');
        
        // إضافة تأخير قصير قبل الطلب
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let dlInfo;
        try {
            dlInfo = await playdl.video_basic_info(url);
            console.log('✅ تم جلب معلومات الفيديو الأساسية');
        } catch (error) {
            console.error('❌ خطأ في جلب معلومات الفيديو:', error);
            throw new Error('فشل في جلب معلومات الفيديو: ' + error.message);
        }
        
        if (!dlInfo || !dlInfo.video_details) {
            throw new Error('لم يتم العثور على معلومات الفيديو');
        }

        const video = dlInfo.video_details;
        console.log('📹 عنوان الفيديو:', video.title);

        let formats = [];
        try {
            console.log('🔄 جاري جلب معلومات الصيغ...');
            const streamData = await playdl.stream_from_info(dlInfo);
            console.log('✅ تم جلب معلومات الصيغ');
            
            if (streamData && streamData.format) {
                formats = streamData.format
                    .filter(format => 
                        format.mimeType?.includes('video/mp4') || 
                        format.mimeType?.includes('audio/mp4')
                    )
                    .map(format => ({
                        itag: format.itag,
                        quality: format.qualityLabel || (format.audioBitrate ? `Audio ${format.audioBitrate}kbps` : 'Unknown'),
                        hasAudio: format.hasAudio,
                        hasVideo: format.hasVideo,
                        container: 'mp4',
                        contentLength: format.contentLength,
                        filesize: format.contentLength ? parseInt(format.contentLength) : 0,
                        audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null
                    }));
            }
        } catch (streamError) {
            console.error('❌ خطأ في جلب صيغ الفيديو:', streamError);
            // لا نريد إيقاف العملية إذا فشل جلب الصيغ
        }

        console.log(`📊 عدد الصيغ المتاحة: ${formats.length}`);

        const responseData = {
            title: video.title || '',
            thumbnail: video.thumbnails?.[0]?.url || '',
            duration: video.durationInSec || 0,
            views: video.views || 0,
            formats: formats,
            author: video.channel?.name || '',
            description: video.description || '',
            publishedAt: video.uploadedAt || '',
            likes: video.likes || 0,
            dislikes: video.dislikes || 0
        };

        console.log('✅ تم تجهيز البيانات للإرسال');
        res.json(responseData);
    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        res.status(500).json({ 
            error: error.message || 'حدث خطأ أثناء جلب معلومات الفيديو',
            details: error.toString()
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
        const videoInfo = await playdl.video_info(url);
        
        // البحث عن الصيغة في كلا المصدرين
        const formats = videoInfo?.video_details?.formats || videoInfo.format || [];
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
