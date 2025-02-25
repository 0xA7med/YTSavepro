const express = require('express');
const cors = require('cors');
const { video_info, stream } = require('play-dl');

const app = express();

// إعداد CORS للسماح بالوصول من أي مصدر
app.use(cors());
app.use(express.json());

// التعامل مع طلبات OPTIONS
app.options('*', cors());

// الحصول على معلومات الفيديو
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'يجب توفير رابط الفيديو' });
    }

    console.log('🔍 جاري جلب معلومات الفيديو:', url);
    
    const info = await video_info(url).catch(error => {
      console.error('خطأ في video_info:', error);
      throw new Error(`فشل في جلب معلومات الفيديو: ${error.message}`);
    });

    if (!info || !info.video_details) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    // تحويل المعلومات إلى الشكل المطلوب
    const formats = (info.format || [])
      .filter(format => format && (
        (format.mimeType && (format.mimeType.includes('video/mp4') || format.mimeType.includes('audio/mp4'))) ||
        (format.format_note && format.format_note.includes('mp4'))
      ))
      .map(format => ({
        itag: format.itag || format.format_id,
        quality: format.qualityLabel || format.quality || (format.audioQuality ? 'Audio' : 'Unknown'),
        hasAudio: Boolean(format.audioQuality || format.acodec !== 'none'),
        hasVideo: Boolean(format.qualityLabel || format.height),
        container: 'mp4',
        fps: format.fps,
        filesize: parseInt(format.contentLength || format.filesize) || 0,
        audioQuality: format.audioQuality || (format.acodec !== 'none' ? format.acodec : null)
      }))
      .filter(format => format.quality !== 'Unknown')
      .sort((a, b) => {
        if (a.hasVideo && b.hasVideo) {
          const qualityA = parseInt(a.quality) || 0;
          const qualityB = parseInt(b.quality) || 0;
          return qualityB - qualityA;
        }
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
      formats: formats || [],
    };

    console.log('تم جلب معلومات الفيديو بنجاح');
    res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات الفيديو:', error);
    console.error('تفاصيل الخطأ:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

    const videoStream = await stream(url, { quality: parseInt(itag) }).catch(error => {
      console.error('خطأ في stream:', error);
      throw new Error(`فشل في تحميل الفيديو: ${error.message}`);
    });
    
    if (!videoStream || !videoStream.stream) {
      throw new Error('فشل في إنشاء تدفق الفيديو');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

    videoStream.stream.pipe(res);

    videoStream.stream.on('error', (error) => {
      console.error('❌ خطأ في تدفق الفيديو:', error);
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
      res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('❌ خطأ عام:', err);
  res.status(500).json({ 
    error: 'حدث خطأ في الخادم',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// تعريف المنفذ
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${port}`);
});
