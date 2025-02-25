const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

// تكوين خيارات الطلب
const requestOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
};

// تأخير للحماية من الحظر
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const app = express();
app.use(cors());
app.use(express.json());

// التحقق من صحة الرابط
const isValidYoutubeUrl = (url) => {
  try {
    return ytdl.validateURL(url) && (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/'));
  } catch {
    return false;
  }
};

// معالجة الصيغ
const processFormats = (formats) => {
  return formats
    .filter(format => {
      try {
        return format?.container === 'mp4' && (format.hasVideo || format.hasAudio);
      } catch {
        return false;
      }
    })
    .map(format => {
      try {
        let quality = format.qualityLabel;
        if (!quality && format.audioBitrate) {
          quality = `Audio ${format.audioBitrate}kbps`;
        } else if (!quality) {
          quality = 'Unknown';
        }

        return {
          itag: format.itag,
          quality,
          hasAudio: Boolean(format.hasAudio),
          hasVideo: Boolean(format.hasVideo),
          container: format.container,
          fps: format.fps || 0,
          filesize: format.contentLength ? parseInt(format.contentLength) : 0,
          audioQuality: format.audioBitrate ? `${format.audioBitrate}kbps` : null,
          width: format.width || 0,
          height: format.height || 0,
          mimeType: format.mimeType || 'video/mp4'
        };
      } catch (error) {
        console.error('خطأ في معالجة الصيغة:', error);
        return null;
      }
    })
    .filter(format => format && format.quality !== 'Unknown')
    .sort((a, b) => {
      try {
        if (a.hasVideo && b.hasVideo) {
          const qualityA = parseInt(a.quality.replace(/\D/g, '')) || a.height || 0;
          const qualityB = parseInt(b.quality.replace(/\D/g, '')) || b.height || 0;
          return qualityB - qualityA;
        }
        if (!a.hasVideo && b.hasVideo) return 1;
        if (a.hasVideo && !b.hasVideo) return -1;
        return (parseInt(b.audioQuality) || 0) - (parseInt(a.audioQuality) || 0);
      } catch {
        return 0;
      }
    });
};

// الحصول على معلومات الفيديو
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || !isValidYoutubeUrl(url)) {
      return res.status(400).json({ error: 'يجب توفير رابط فيديو يوتيوب صالح' });
    }

    console.log('🔍 جاري جلب معلومات الفيديو:', url);
    
    await delay(Math.random() * 1000);
    
    const info = await ytdl.getInfo(url, { requestOptions });
    
    if (!info?.videoDetails) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    const formats = processFormats(info.formats);

    if (!formats.length) {
      throw new Error('لم يتم العثور على صيغ تحميل متاحة');
    }

    const responseData = {
      title: info.videoDetails.title || 'بدون عنوان',
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || '',
      duration: parseInt(info.videoDetails.lengthSeconds) || 0,
      views: parseInt(info.videoDetails.viewCount) || 0,
      formats,
      author: info.videoDetails.author?.name || '',
      description: info.videoDetails.description || '',
      uploadDate: info.videoDetails.uploadDate || '',
      category: info.videoDetails.category || ''
    };

    res.set('Cache-Control', 'public, max-age=300');
    res.json(responseData);
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات الفيديو:', error);
    res.status(500).json({ 
      error: 'حدث خطأ أثناء جلب بيانات الفيديو',
      message: error.message
    });
  }
});

// تحميل الفيديو
app.get('/api/download', async (req, res) => {
  try {
    const { url, itag } = req.query;

    if (!url || !itag || !isValidYoutubeUrl(url)) {
      return res.status(400).json({ error: 'يجب توفير رابط فيديو صالح والجودة المطلوبة' });
    }

    await delay(Math.random() * 1000);

    const info = await ytdl.getInfo(url, { requestOptions });
    const format = ytdl.chooseFormat(info.formats, { quality: itag });

    if (!format) {
      throw new Error('الجودة المطلوبة غير متوفرة');
    }

    const sanitizedTitle = info.videoDetails.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    const contentType = format.mimeType?.split(';')[0] || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.mp4"`);

    const stream = ytdl(url, { 
      format,
      requestOptions,
      highWaterMark: 32 * 1024 
    });

    stream.on('error', (error) => {
      console.error('❌ خطأ في تدفق الفيديو:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'فشل في تحميل الفيديو' });
      }
    });

    let downloadedBytes = 0;
    stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (format.contentLength) {
        const progress = (downloadedBytes / format.contentLength * 100).toFixed(2);
        console.log(`تقدم التحميل: ${progress}%`);
      }
    });

    stream.pipe(res);

  } catch (error) {
    console.error('❌ خطأ في تحميل الفيديو:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'حدث خطأ أثناء تحميل الفيديو',
        message: error.message
      });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 الخادم يعمل على المنفذ ${port}`));
