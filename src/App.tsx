import React, { useState } from 'react';
import { Video, Music4, Zap, Smartphone, Loader2, Clipboard } from 'lucide-react';
import type { VideoInfo, VideoFormat, ApiError } from './types';
import axios from 'axios';

// تكوين عنوان API
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://yt-savepro.vercel.app/api' 
  : 'http://localhost:3000/api';

// تكوين Axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);

  const translations = {
    en: {
      title: 'YouTube Video Download',
      subtitle: 'Download YouTube Videos in HD Quality',
      placeholder: 'Paste YouTube video link here...',
      loading: 'Loading...',
      download: 'Download',
      paste: 'Paste',
      error: {
        invalidUrl: 'Invalid YouTube URL',
        fetchError: 'Failed to fetch video information',
        downloadError: 'Failed to download video'
      },
      videoInfo: {
        title: 'Video Title',
        quality: 'Quality',
        format: 'Format',
        download: 'Download'
      },
      features: {
        quality: {
          title: 'High Quality Videos',
          desc: 'Download videos in HD quality up to 4K resolution'
        },
        fast: {
          title: 'Fast & Easy to Download',
          desc: 'Quick downloads with no registration required'
        },
        shorts: {
          title: 'YouTube Shorts Download',
          desc: 'Download YouTube Shorts videos easily'
        },
        mp3: {
          title: 'MP3 Download',
          desc: 'Convert and download videos to MP3'
        }
      },
      steps: {
        title: 'Steps to Download',
        paste: 'Paste Youtube Video Link',
        format: 'Select Format',
        quality: 'Choose Quality',
        download: 'Download Video'
      }
    },
    ar: {
      title: 'تحميل فيديو يوتيوب',
      subtitle: 'قم بتحميل مقاطع فيديو يوتيوب بجودة عالية',
      placeholder: 'الصق رابط فيديو يوتيوب هنا...',
      loading: 'جاري التحميل...',
      download: 'تحميل',
      paste: 'لصق',
      error: {
        invalidUrl: 'رابط يوتيوب غير صالح',
        fetchError: 'فشل في جلب معلومات الفيديو',
        downloadError: 'فشل في تحميل الفيديو'
      },
      videoInfo: {
        title: 'عنوان الفيديو',
        quality: 'الجودة',
        format: 'الصيغة',
        download: 'تحميل'
      },
      features: {
        quality: {
          title: 'فيديوهات عالية الجودة',
          desc: 'قم بتحميل مقاطع الفيديو بجودة HD تصل إلى 4K'
        },
        fast: {
          title: 'تحميل سريع وسهل',
          desc: 'تحميل سريع بدون تسجيل'
        },
        shorts: {
          title: 'تحميل Shorts',
          desc: 'قم بتحميل مقاطع Shorts بسهولة'
        },
        mp3: {
          title: 'تحميل MP3',
          desc: 'تحويل وتحميل الفيديو إلى MP3'
        }
      },
      steps: {
        title: 'خطوات التحميل',
        paste: 'الصق رابط الفيديو',
        format: 'اختر الصيغة',
        quality: 'اختر الجودة',
        download: 'تحميل الفيديو'
      }
    }
  };

  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVideoInfo(null);
    setSelectedFormat(null);

    try {
      const encodedUrl = encodeURIComponent(url.trim());
      const response = await api.get<VideoInfo>('/info', {
        params: { url: encodedUrl }
      });

      if (response.status !== 200) {
        throw new Error('فشل في جلب معلومات الفيديو');
      }

      const data = response.data;
      if (!data || !data.formats || data.formats.length === 0) {
        throw new Error('لم يتم العثور على معلومات الفيديو');
      }

      setVideoInfo(data);
    } catch (error) {
      console.error('Error fetching video info:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء جلب معلومات الفيديو');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: VideoFormat) => {
    try {
      const encodedUrl = encodeURIComponent(url.trim());
      window.location.href = `${API_URL}/download?url=${encodedUrl}&itag=${format.itag}`;
    } catch (error) {
      console.error('Download error:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء التحميل');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes('youtube.com') || text.includes('youtu.be')) {
        setUrl(text);
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">YTSavepro</h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded ${language === 'en' ? 'bg-blue-500' : 'bg-gray-700'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ar')}
              className={`px-3 py-1 rounded ${language === 'ar' ? 'bg-blue-500' : 'bg-gray-700'}`}
            >
              عربي
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-400 mb-4">{t.title}</h2>
          <p className="text-xl text-gray-400">{t.subtitle}</p>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-16">
          <div className="flex gap-2">
            <div className="flex-1 flex">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.placeholder}
                className="flex-1 px-4 py-3 rounded-l-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="px-4 py-3 bg-gray-700 border-y border-r border-gray-700 rounded-r-lg hover:bg-gray-600 transition-colors"
                title={t.paste}
              >
                <Clipboard className="w-5 h-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !url}
              className="px-6 py-3 bg-blue-500 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed min-w-[120px]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.loading}</span>
                </div>
              ) : (
                t.download
              )}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Video Info */}
        {videoInfo && (
          <div className="max-w-3xl mx-auto mb-16 bg-gray-800/80 backdrop-blur rounded-xl overflow-hidden border border-gray-700">
            <div className="p-8">
              <div className="flex gap-8">
                <div className="relative w-64 flex-shrink-0">
                  <img 
                    src={videoInfo.thumbnail} 
                    alt={videoInfo.title}
                    className="w-full h-auto rounded-lg shadow-lg hover:scale-105 transition-transform duration-300"
                  />
                  {videoInfo.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm">
                      {new Date(videoInfo.duration * 1000).toISOString().substr(11, 8)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2 line-clamp-2">{videoInfo.title}</h3>
                  {videoInfo.views && (
                    <p className="text-gray-400 mb-4">
                      {new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US').format(videoInfo.views)} {language === 'ar' ? 'مشاهدة' : 'views'}
                    </p>
                  )}
                  
                  {/* Format Groups */}
                  <div className="space-y-6">
                    {/* Video + Audio */}
                    {videoInfo.formats.some(f => f.hasVideo && f.hasAudio) && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Video className="w-5 h-5" />
                          {language === 'ar' ? 'فيديو مع صوت' : 'Video with Audio'}
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {videoInfo.formats
                            .filter(format => format.hasVideo && format.hasAudio)
                            .sort((a, b) => {
                              const qualityA = parseInt(a.quality) || 0;
                              const qualityB = parseInt(b.quality) || 0;
                              return qualityB - qualityA;
                            })
                            .map(format => (
                              <div 
                                key={format.itag}
                                className="p-4 bg-gray-700/50 backdrop-blur rounded-lg flex justify-between items-center hover:bg-gray-700 transition-colors"
                              >
                                <div>
                                  <p className="font-medium flex items-center gap-2">
                                    {format.quality}
                                    {format.fps && <span className="text-blue-400 text-sm">{format.fps}fps</span>}
                                  </p>
                                  {format.filesize && (
                                    <p className="text-sm text-gray-400">
                                      {(format.filesize / (1024 * 1024)).toFixed(1)} MB
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDownload(format)}
                                  className="px-6 py-2.5 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                  <span>{t.download}</span>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Video Only (High Quality) */}
                    {videoInfo.formats.some(f => f.hasVideo && !f.hasAudio) && (
                      <div>
                        <div className="mb-3">
                          <h4 className="text-lg font-semibold flex items-center gap-2">
                            <Video className="w-5 h-5" />
                            {language === 'ar' ? 'جودة عالية (بدون صوت)' : 'High Quality (No Audio)'}
                          </h4>
                          <p className="text-sm text-yellow-400 mt-1">
                            {language === 'ar' 
                              ? 'هذه الجودات العالية تأتي بدون صوت. يمكنك تحميل الصوت بشكل منفصل.'
                              : 'These high quality formats come without audio. You can download audio separately.'}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {videoInfo.formats
                            .filter(format => format.hasVideo && !format.hasAudio)
                            .sort((a, b) => {
                              const qualityA = parseInt(a.quality) || 0;
                              const qualityB = parseInt(b.quality) || 0;
                              return qualityB - qualityA;
                            })
                            .map(format => (
                              <div 
                                key={format.itag}
                                className="p-4 bg-gray-700/50 backdrop-blur rounded-lg flex justify-between items-center hover:bg-gray-700 transition-colors"
                              >
                                <div>
                                  <p className="font-medium flex items-center gap-2">
                                    {format.quality}
                                    {format.fps && <span className="text-blue-400 text-sm">{format.fps}fps</span>}
                                    <span className="text-yellow-400 text-xs">No Audio</span>
                                  </p>
                                  {format.filesize && (
                                    <p className="text-sm text-gray-400">
                                      {(format.filesize / (1024 * 1024)).toFixed(1)} MB
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDownload(format)}
                                  className="px-6 py-2.5 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                  <span>{t.download}</span>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Audio Only */}
                    {videoInfo.formats.some(f => !f.hasVideo && f.hasAudio) && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Music4 className="w-5 h-5" />
                          {language === 'ar' ? 'صوت فقط' : 'Audio Only'}
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {videoInfo.formats
                            .filter(format => !format.hasVideo && format.hasAudio)
                            .map(format => (
                              <div 
                                key={format.itag}
                                className="p-4 bg-gray-700/50 backdrop-blur rounded-lg flex justify-between items-center hover:bg-gray-700 transition-colors"
                              >
                                <div>
                                  <p className="font-medium">
                                    {format.audioQuality || 'MP3'}
                                  </p>
                                  {format.filesize && (
                                    <p className="text-sm text-gray-400">
                                      {(format.filesize / (1024 * 1024)).toFixed(1)} MB
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDownload(format)}
                                  className="px-6 py-2.5 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                  <span>{t.download}</span>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <FeatureCard
            icon={<Video className="w-12 h-12 text-blue-400" />}
            title={t.features.quality.title}
            description={t.features.quality.desc}
          />
          <FeatureCard
            icon={<Zap className="w-12 h-12 text-green-400" />}
            title={t.features.fast.title}
            description={t.features.fast.desc}
          />
          <FeatureCard
            icon={<Smartphone className="w-12 h-12 text-purple-400" />}
            title={t.features.shorts.title}
            description={t.features.shorts.desc}
          />
          <FeatureCard
            icon={<Music4 className="w-12 h-12 text-red-400" />}
            title={t.features.mp3.title}
            description={t.features.mp3.desc}
          />
        </div>

        {/* Download Steps */}
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold mb-12">{t.steps.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StepCard number={1} title={t.steps.paste} />
            <StepCard number={2} title={t.steps.format} />
            <StepCard number={3} title={t.steps.quality} />
            <StepCard number={4} title={t.steps.download} />
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-gray-800 rounded-xl">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function StepCard({ number, title }: { number: number; title: string }) {
  return (
    <div className="relative">
      <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl font-bold">{number}</span>
      </div>
      <h4 className="text-lg font-semibold">{title}</h4>
    </div>
  );
}

export default App;