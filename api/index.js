const express = require('express');
const cors = require('cors');
const playdl = require('play-dl');

const app = express();
app.use(cors());
app.use(express.json());

// تكوين خيارات الطلب
const requestOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
};

// تأخير للحماية من الحظر
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// التحقق من صحة الرابط
const isValidYoutubeUrl = (url) => {
  try {
    return playdl.yt_validate(url) === 'video';
  } catch (error) {
    console.error('خطأ في التحقق من صحة الرابط:', error);
    return false;
  }
};

// الحصول على معلومات الفيديو
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    console.log('الرابط المستلم:', url);
    
    if (!url) {
      return res.status(400).json({ 
        error: 'يجب توفير رابط الفيديو',
        details: 'الرابط غير موجود'
      });
    }

    if (!isValidYoutubeUrl(url)) {
      return res.status(400).json({ 
        error: 'رابط الفيديو غير صالح',
        details: 'الرابط لا يتطابق مع صيغة روابط يوتيوب المعروفة'
      });
    }

    await delay(Math.random() * 1000);

    const videoInfo = await playdl.video_info(url, requestOptions);

    if (!videoInfo) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    const formats = videoInfo.format
      .filter(format => format.container === 'mp4' && (format.hasVideo || format.hasAudio))
      .map(format => ({
        itag: format.itag,
        quality: format.qualityLabel || (format.audioBitrate ? `Audio ${format.audioBitrate}kbps` : 'Unknown'),
        hasAudio: format.hasAudio,
        hasVideo: format.hasVideo,
        container: format.container,
        fps: format.fps || 0,
        filesize: format.contentLength ? parseInt(format.contentLength) : 0,
        audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null,
        width: format.width || 0,
        height: format.height || 0,
        mimeType: format.mimeType || 'video/mp4'
      }))
      .filter(format => format.quality !== 'Unknown')
      .sort((a, b) => {
        if (a.hasVideo && b.hasVideo) {
          const qualityA = parseInt(a.quality.replace(/\D/g, '')) || a.height || 0;
          const qualityB = parseInt(b.quality.replace(/\D/g, '')) || b.height || 0;
          return qualityB - qualityA;
        }
        if (!a.hasVideo && b.hasVideo) return 1;
        if (a.hasVideo && !b.hasVideo) return -1;
        return (parseInt(b.audioQuality) || 0) - (parseInt(a.audioQuality) || 0);
      });

    const responseData = {
      title: videoInfo.video_details.title || 'بدون عنوان',
      thumbnail: videoInfo.video_details.thumbnails[videoInfo.video_details.thumbnails.length - 1]?.url || '',
      duration: parseInt(videoInfo.video_details.durationInSec) || 0,
      views: parseInt(videoInfo.video_details.viewCount) || 0,
      formats,
      author: videoInfo.video_details.channel?.name || '',
      description: videoInfo.video_details.description || '',
      uploadDate: videoInfo.video_details.uploadDate || '',
      category: videoInfo.video_details.category || ''
    };

    // تخزين مؤقت للنتائج
    res.set('Cache-Control', 'public, max-age=300');
    res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات الفيديو:', error);
    
    // معالجة أنواع مختلفة من الأخطاء
    if (error.message.includes('Status code: 410')) {
      return res.status(410).json({ 
        error: 'الفيديو لم يعد متاحًا',
        details: 'تم إزالة الفيديو من يوتيوب'
      });
    }
    
    if (error.message.includes('private video')) {
      return res.status(403).json({ 
        error: 'الفيديو خاص',
        details: 'لا يمكن الوصول إلى الفيديو لأنه خاص'
      });
    }

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

    console.log('طلب تحميل:', { url, itag });

    if (!url || !itag) {
      return res.status(400).json({ 
        error: 'بيانات غير مكتملة',
        details: 'يجب توفير رابط الفيديو والجودة المطلوبة'
      });
    }

    if (!isValidYoutubeUrl(url)) {
      return res.status(400).json({ 
        error: 'رابط غير صالح',
        details: 'الرابط لا يتطابق مع صيغة روابط يوتيوب'
      });
    }

    await delay(Math.random() * 1000);

    const stream = await playdl.stream(url, { quality: itag });

    const sanitizedTitle = stream.video_details.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    const contentType = stream.stream.headers['content-type']?.split(';')[0] || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp4"`);

    stream.stream.on('error', (error) => {
      console.error('❌ خطأ في تدفق الفيديو:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'فشل في تحميل الفيديو',
          details: error.message
        });
      }
    });

    let downloadedBytes = 0;
    stream.stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (stream.stream.headers['content-length']) {
        const progress = (downloadedBytes / parseInt(stream.stream.headers['content-length']) * 100).toFixed(2);
        console.log(`تقدم التحميل: ${progress}%`);
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
