const express = require('express');
const cors = require('cors');
const { video_info, stream } = require('play-dl');

const app = express();

// إعداد CORS للسماح بالوصول من Vercel
app.use(cors({
  origin: ['https://yt-savepro.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// الحصول على معلومات الفيديو
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'يجب توفير رابط الفيديو' });
    }

    console.log('🔍 جاري جلب معلومات الفيديو...');
    
    const info = await video_info(url);
    console.log('معلومات الفيديو:', JSON.stringify(info, null, 2));

    if (!info) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    // تحويل المعلومات إلى الشكل المطلوب
    const formats = info.format
      .filter(format => format?.mimeType?.includes('video/mp4') || format?.mimeType?.includes('audio/mp4'))
      .map(format => ({
        itag: format.itag,
        quality: format.qualityLabel || (format.audioQuality ? 'Audio' : 'Unknown'),
        hasAudio: Boolean(format.audioQuality),
        hasVideo: Boolean(format.qualityLabel),
        container: 'mp4',
        fps: format.fps,
        filesize: parseInt(format.contentLength) || 0,
        audioQuality: format.audioQuality
      }))
      .filter(format => format.quality !== 'Unknown')
      .sort((a, b) => {
        // ترتيب الصيغ حسب الجودة
        if (a.hasVideo && b.hasVideo) {
          const qualityA = parseInt(a.quality) || 0;
          const qualityB = parseInt(b.quality) || 0;
          return qualityB - qualityA;
        }
        // وضع ملفات الصوت في النهاية
        if (!a.hasVideo && b.hasVideo) return 1;
        if (a.hasVideo && !b.hasVideo) return -1;
        return 0;
      });

    // اختيار أفضل صورة مصغرة
    const thumbnails = info.video_details.thumbnails || [];
    const thumbnail = thumbnails.length > 0 
      ? thumbnails.reduce((prev, current) => {
          return (prev.width > current.width) ? prev : current;
        }, thumbnails[0])
      : null;

    const responseData = {
      title: info.video_details.title || 'بدون عنوان',
      thumbnail: thumbnail?.url || '',
      duration: info.video_details.durationInSec || 0,
      views: info.video_details.views || 0,
      formats,
    };

    console.log('البيانات المرسلة:', JSON.stringify(responseData, null, 2));

    res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات الفيديو:', error);
    console.error('تفاصيل الخطأ:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// تحميل الفيديو
app.get('/api/download', async (req, res) => {
  try {
    const { url, itag } = req.query;

    if (!url || !itag) {
      return res.status(400).json({ error: 'يجب توفير رابط الفيديو والجودة المطلوبة' });
    }

    console.log(`🚀 بدء تحميل الفيديو بجودة ${itag}...`);

    const videoStream = await stream(url, { quality: parseInt(itag) });
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

    // توجيه البيانات إلى المستجيب
    videoStream.stream.pipe(res);

    // معالجة الأخطاء
    videoStream.stream.on('error', (error) => {
      console.error('❌ خطأ في تحميل الفيديو:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'فشل في تحميل الفيديو' });
      }
    });

    videoStream.stream.on('end', () => {
      console.log('✅ تم تحميل الفيديو بنجاح!');
    });

  } catch (error) {
    console.error('❌ خطأ في تحميل الفيديو:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// تعريف المنفذ
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${port}`);
});
