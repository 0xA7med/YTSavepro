const express = require('express');
const cors = require('cors');
const playdl = require('play-dl');

const app = express();
app.use(cors());
app.use(express.json());

// تهيئة play-dl
(async () => {
  try {
    await playdl.getFreeClientID();
    console.log('✅ تم تهيئة play-dl بنجاح');
  } catch (error) {
    console.error('❌ خطأ في تهيئة play-dl:', error);
  }
})();

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
    
    console.log('🔍 جاري البحث عن معلومات الفيديو:', url);
    
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

    const videoInfo = await playdl.video_basic_info(url);
    console.log('✅ تم جلب معلومات الفيديو الأساسية');

    if (!videoInfo || !videoInfo.video_details) {
      throw new Error('لم يتم العثور على معلومات الفيديو');
    }

    const formats = await playdl.video_info(url);
    console.log('✅ تم جلب معلومات الصيغ المتاحة');
    console.log('الصيغ المتاحة:', formats.format.map(f => ({
      itag: f.itag,
      quality: f.qualityLabel,
      container: f.container,
      hasVideo: f.hasVideo,
      hasAudio: f.hasAudio
    })));

    const availableFormats = formats.format
      .filter(format => {
        const isValid = format.container === 'mp4' && (format.hasVideo || format.hasAudio);
        console.log(`تحقق من الصيغة ${format.itag}: ${isValid ? '✅' : '❌'}`);
        return isValid;
      })
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

    console.log('الصيغ المتاحة بعد الفلترة:', availableFormats);

    const responseData = {
      title: videoInfo.video_details.title || 'بدون عنوان',
      thumbnail: videoInfo.video_details.thumbnails[videoInfo.video_details.thumbnails.length - 1]?.url || '',
      duration: parseInt(videoInfo.video_details.durationInSec) || 0,
      views: parseInt(videoInfo.video_details.viewCount) || 0,
      formats: availableFormats,
      author: videoInfo.video_details.channel?.name || '',
      description: videoInfo.video_details.description || ''
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

    if (!isValidYoutubeUrl(url)) {
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
