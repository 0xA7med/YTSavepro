const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

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
    
    const info = await ytdl.getInfo(url);
    
    if (!info || !info.formats) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    // تحويل المعلومات إلى الشكل المطلوب
    const formats = info.formats
      .filter(format => format.container === 'mp4')
      .map(format => ({
        itag: format.itag,
        quality: format.qualityLabel || (format.audioBitrate ? 'Audio' : 'Unknown'),
        hasAudio: Boolean(format.hasAudio),
        hasVideo: Boolean(format.hasVideo),
        container: format.container,
        fps: format.fps,
        filesize: parseInt(format.contentLength) || 0,
        audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null
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

    const responseData = {
      title: info.videoDetails.title || 'بدون عنوان',
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || '',
      duration: parseInt(info.videoDetails.lengthSeconds) || 0,
      views: parseInt(info.videoDetails.viewCount) || 0,
      formats: formats || [],
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات الفيديو:', error);
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

    const info = await ytdl.getInfo(url);
    const format = info.formats.find(f => f.itag === itag);

    if (!format) {
      throw new Error('الجودة المطلوبة غير متوفرة');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);

    ytdl(url, { format }).pipe(res);

  } catch (error) {
    console.error('❌ خطأ في تحميل الفيديو:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 الخادم يعمل على المنفذ ${port}`));
