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
        const { url } = req.query;
        console.log('🔍 جاري البحث عن معلومات الفيديو:', url);
        
        if (!url) {
            return res.status(400).json({ 
                error: "❌ يجب توفير رابط الفيديو",
                details: "الرابط غير موجود"
            });
        }

        // استخراج معرف الفيديو من الرابط
        const videoId = extractVideoID(url);
        if (!videoId) {
            return res.status(400).json({ 
                error: "❌ رابط يوتيوب غير صالح",
                details: "تأكد من صحة الرابط"
            });
        }

        // استعلام API يوتيوب
        console.log('🔍 جاري الاستعلام عن معلومات الفيديو من API يوتيوب...');
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&part=snippet,contentDetails,statistics`;
        const response = await axios.get(apiUrl);

        if (!response.data.items.length) {
            return res.status(404).json({ 
                error: "❌ الفيديو غير موجود",
                details: "لم يتم العثور على الفيديو"
            });
        }

        const videoInfo = response.data.items[0];
        console.log('✅ تم جلب معلومات الفيديو بنجاح');

        // جلب معلومات التنزيل باستخدام play-dl
        const dlInfo = await playdl.video_info(url);
        console.log('✅ تم جلب معلومات التنزيل بنجاح');

        const formats = dlInfo.format
            .filter(format => format.container === 'mp4' && (format.hasVideo || format.hasAudio))
            .map(format => ({
                itag: format.itag,
                quality: format.qualityLabel || (format.audioBitrate ? `Audio ${format.audioBitrate}kbps` : 'Unknown'),
                hasAudio: format.hasAudio,
                hasVideo: format.hasVideo,
                container: format.container,
                fps: format.fps || 0,
                filesize: format.contentLength ? parseInt(format.contentLength) : 0,
                audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null
            }))
            .filter(format => format.quality !== 'Unknown')
            .sort((a, b) => {
                if (a.hasVideo && b.hasVideo) {
                    const qualityA = parseInt(a.quality.replace(/\D/g, '')) || 0;
                    const qualityB = parseInt(b.quality.replace(/\D/g, '')) || 0;
                    return qualityB - qualityA;
                }
                if (!a.hasVideo && b.hasVideo) return 1;
                if (a.hasVideo && !b.hasVideo) return -1;
                return 0;
            });

        const responseData = {
            title: videoInfo.snippet.title,
            thumbnail: videoInfo.snippet.thumbnails.maxres?.url || videoInfo.snippet.thumbnails.high?.url,
            duration: videoInfo.contentDetails.duration,
            views: parseInt(videoInfo.statistics.viewCount) || 0,
            formats,
            author: videoInfo.snippet.channelTitle,
            description: videoInfo.snippet.description,
            publishedAt: videoInfo.snippet.publishedAt,
            tags: videoInfo.snippet.tags || []
        };

        res.json(responseData);
    } catch (error) {
        console.error('❌ خطأ في جلب معلومات الفيديو:', error);
        res.status(500).json({ 
            error: 'حدث خطأ أثناء جلب بيانات الفيديو',
            details: error.message
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
        const format = videoInfo.format.find(f => f.itag === parseInt(itag));

        if (!format) {
            console.error('❌ الصيغة المطلوبة غير متوفرة:', itag);
            return res.status(400).json({
                error: 'الصيغة غير متوفرة',
                details: `الصيغة المطلوبة (${itag}) غير متوفرة للفيديو`
            });
        }

        console.log('✅ تم العثور على الصيغة المطلوبة:', format);

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
app.listen(port, () => console.log(`🚀 الخادم يعمل على المنفذ ${port}`));
