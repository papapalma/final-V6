import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Megaphone, Calendar, ChevronLeft, ChevronRight, Sparkles, Bell, ArrowUpRight, Clock, Sun, Moon } from 'lucide-react';
import announcementService, { Announcement } from '../services/announcementService';
import { getFileUrl } from '../services/api';
import ImageWithSkeleton from './ui/ImageWithSkeleton';
import { useTheme } from '../contexts/ThemeContext';

interface AnnouncementsSectionProps {
  inHero?: boolean;
  onHasAnnouncements?: (has: boolean) => void;
}

export default function AnnouncementsSection({ inHero = false, onHasAnnouncements }: AnnouncementsSectionProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [[page, direction], setPage] = useState([0, 0]);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const { isDark, toggleTheme } = useTheme();

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        paginate(1);
      } else {
        paginate(-1);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  useEffect(() => {
    onHasAnnouncements?.(true); // Initial optimistic state while fetching
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await announcementService.getPublicAnnouncements();
        if (isMounted) {
          setAnnouncements(data);
          onHasAnnouncements?.(data.length > 0);
        }
      } catch (e) {
        if (isMounted) onHasAnnouncements?.(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // Wrap index safely around the array length
  const activeIndex = announcements.length > 0
    ? ((page % announcements.length) + announcements.length) % announcements.length
    : 0;

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  // Subtle auto-advance every 8 seconds, paused on hover or when modal is open
  useEffect(() => {
    if (announcements.length <= 1 || isHovered || selectedAnnouncement) return;
    autoPlayRef.current = setTimeout(() => {
      paginate(1);
    }, 8000);

    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [page, announcements.length, isHovered, selectedAnnouncement]);

  // Loading shimmer placeholder
  if (loading) {
    if (inHero) {
      return (
        <div className="w-full rounded-3xl border border-white/20 bg-slate-900/60 backdrop-blur-2xl p-6 shadow-2xl animate-pulse space-y-4 text-white">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32 rounded-full bg-white/10" />
            <Skeleton className="h-6 w-16 rounded-full bg-white/10" />
          </div>
          <Skeleton className="h-44 sm:h-52 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-5 w-3/4 rounded-lg bg-white/10" />
          <Skeleton className="h-4 w-full rounded-lg bg-white/10" />
        </div>
      );
    }
    return (
      <section className="py-6 sm:py-8 bg-muted/20 border-b border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="space-y-3">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-48 sm:h-56 w-full rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  // If there are no announcements, hide the section per specification
  if (announcements.length === 0) {
    return null;
  }

  const current = announcements[activeIndex] || announcements[0];

  // Apple-grade spring transition curves
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 340, damping: 30 },
        opacity: { duration: 0.25, ease: 'easeOut' },
        scale: { duration: 0.25, ease: 'easeOut' },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -50 : 50,
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.2,
        ease: 'easeInOut',
      },
    }),
  };

  // ─── HERO GALLERY CARD VARIANT (Placed in Hero right column / red box) ───
  if (inHero) {
    return (
      <div
        className="w-full relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Vibrant Ambient Backlight Aura */}
        <div
          className={`absolute -inset-2 rounded-[2rem] bg-gradient-to-r ${isDark
              ? 'from-blue-600/50 via-sky-400/40 to-indigo-600/50 opacity-75'
              : 'from-blue-500/35 via-indigo-500/25 to-sky-400/35 opacity-65'
            } blur-2xl pointer-events-none -z-10`}
          aria-hidden="true"
        />

        {/* High-Impact Announcement Gallery Card (Light or Dark Mode) */}
        <div
          onClick={() => setSelectedAnnouncement(current)}
          className="ds-card-interactive relative z-10 flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border-2 border-primary bg-card p-4 text-card-foreground shadow-[0_10px_30px_-5px_rgba(15,23,42,0.12),0_0_25px_-2px_rgba(37,99,235,0.22)] transition-all duration-300 dark:border-sky-400 dark:bg-slate-950 dark:text-white dark:shadow-[0_0_45px_-10px_rgba(56,189,248,0.4),0_25px_60px_-15px_rgba(0,0,0,0.85)] sm:p-6"
        >
          {/* Top Glowing Gradient Accent Bar */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${isDark
              ? 'from-blue-500 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
              : 'from-blue-600 via-indigo-600 to-sky-500 shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            } absolute top-0 left-0 right-0 z-20`} />

          {/* Card Header: Live Badge, Counter, Quick Theme Toggle, Navigation Arrows */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 pt-1">
            <div className="flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-bold tracking-wide text-white shadow-md ${
                  isDark
                    ? 'border-blue-400 bg-gradient-to-br from-blue-600 to-indigo-600'
                    : 'border-blue-700 bg-primary'
                }`}
              >
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-white"></span>
                </span>
                <span>Official Update</span>
              </div>

              {announcements.length > 1 && (
                <span className={`text-xs font-semibold tracking-tight px-2 py-0.5 rounded-full border ${isDark
                    ? 'text-sky-200/90 bg-white/10 border-white/10'
                    : 'text-slate-800 bg-slate-100 border-slate-300'
                  }`}>
                  {activeIndex + 1} of {announcements.length}
                </span>
              )}
            </div>

            {/* Quick Card Controls (Theme Switcher + Nav Arrows) */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Quick Card Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`size-8 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-sm ${isDark
                    ? 'border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/25 text-amber-300'
                    : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </button>

              {announcements.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => paginate(-1)}
                    className={`size-8 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-sm ${isDark
                        ? 'border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/30 text-white focus-visible:ring-sky-400'
                        : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-blue-500'
                      }`}
                    aria-label="Previous announcement"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => paginate(1)}
                    className={`size-8 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-sm ${isDark
                        ? 'border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/30 text-white focus-visible:ring-sky-400'
                        : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-blue-500'
                      }`}
                    aria-label="Next announcement"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Animated Slide Content with native touch gestures */}
          <div
            className="relative overflow-hidden min-h-[250px] flex flex-col justify-between"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={page}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full flex flex-col justify-between"
              >
                {/* Media Preview (Photo or Video) */}
                {current.media_url ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnouncement(current);
                    }}
                    className={`w-full h-44 sm:h-48 rounded-2xl overflow-hidden relative mb-3 group/media shadow-md cursor-pointer ${isDark ? 'bg-black/60 border-2 border-white/20' : 'bg-slate-100 border-2 border-slate-200'
                      }`}
                  >
                    {current.media_type === 'video' ? (
                      <video
                        src={getFileUrl(current.media_url)}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <ImageWithSkeleton
                        src={getFileUrl(current.media_url)}
                        alt={current.title}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnouncement(current);
                    }}
                    className={`w-full h-24 rounded-2xl flex items-center gap-3 px-4 mb-3 border cursor-pointer ${isDark
                        ? 'bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent border-sky-400/20'
                        : 'bg-gradient-to-br from-blue-50 to-indigo-50/60 border-blue-200'
                      }`}
                  >
                    <div className="size-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
                      <Megaphone className="size-5" />
                    </div>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white/90' : 'text-slate-800'}`}>
                      Bongabong MDC Official Broadcast
                    </p>
                  </div>
                )}

                {/* Text Information */}
                <div
                  className="space-y-1.5 min-w-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnouncement(current);
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 font-semibold ${isDark ? 'text-sky-300' : 'text-blue-700'
                      }`}>
                      <Calendar className="size-3 text-primary" />
                      {new Date(current.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    {activeIndex === 0 && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                        <Sparkles className="size-2.5" />
                        Latest
                      </span>
                    )}
                  </div>

                  <h3 className={`text-base sm:text-lg font-extrabold tracking-tight leading-snug line-clamp-2 transition-colors ${isDark
                      ? 'text-white group-hover:text-sky-300 drop-shadow-sm'
                      : 'text-slate-900 group-hover:text-blue-600'
                    }`}>
                    {current.title}
                  </h3>

                  <p className={`text-xs sm:text-sm line-clamp-2 leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-200/95' : 'text-slate-700 font-medium'
                    }`}>
                    {current.body}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Card Footer: Interactive Navigation Dots + Solid Highlight CTA */}
            <div className={`flex items-center justify-between gap-3 pt-3 mt-3 border-t ${isDark ? 'border-white/15' : 'border-slate-200'
              }`}>
              {announcements.length > 1 ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {announcements.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => paginate(idx - activeIndex)}
                      className="h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2"
                      style={{
                        width: idx === activeIndex ? '24px' : '6px',
                        backgroundColor: idx === activeIndex
                          ? (isDark ? '#38bdf8' : '#2563eb')
                          : (isDark ? 'rgba(255,255,255,0.3)' : '#cbd5e1'),
                        boxShadow: idx === activeIndex
                          ? (isDark ? '0 0 10px rgba(56,189,248,0.8)' : '0 0 8px rgba(37,99,235,0.5)')
                          : 'none',
                      }}
                      aria-label={`Jump to announcement ${idx + 1}`}
                    />
                  ))}
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnouncement(current);
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold shadow-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isDark
                    ? 'bg-sky-400 text-slate-950 shadow-sky-400/35 hover:bg-sky-300'
                    : 'bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90'
                }`}
              >
                View Details
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Full Dialog Modal */}
        <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
          <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl sm:p-8">
            {selectedAnnouncement && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5 flex items-center gap-1.5">
                      <Megaphone className="size-3.5 text-primary" />
                      Official Announcement
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-2.5 py-1 rounded-full">
                      <Calendar className="size-3 text-primary" />
                      {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
                    {selectedAnnouncement.title}
                  </DialogTitle>
                </div>

                {selectedAnnouncement.media_url && (
                  <div
                    className="w-full rounded-2xl overflow-hidden bg-black/5 dark:bg-black/40 border border-border/70 flex items-center justify-center shadow-inner"
                    style={{ maxHeight: '380px' }}
                  >
                    {selectedAnnouncement.media_type === 'video' ? (
                      <video
                        src={getFileUrl(selectedAnnouncement.media_url)}
                        controls
                        playsInline
                        className="w-full max-h-[380px] object-contain rounded-2xl"
                      />
                    ) : (
                      <img
                        src={getFileUrl(selectedAnnouncement.media_url)}
                        alt={selectedAnnouncement.title}
                        className="w-full max-h-[380px] object-contain rounded-2xl"
                      />
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line font-normal">
                    {selectedAnnouncement.body}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {selectedAnnouncement.expires_at ? (
                      <>
                        <Clock className="size-3 text-muted-foreground" />
                        <span>Valid until {new Date(selectedAnnouncement.expires_at).toLocaleDateString()}</span>
                      </>
                    ) : (
                      <span>General Center Announcement</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAnnouncement(null)}
                    className="rounded-xl px-4 h-9 font-medium"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <section
      id="announcements"
      className="py-6 sm:py-8 bg-gradient-to-b from-background via-muted/20 to-background border-b border-border/60 relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle Apple Ambient Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[200px] bg-primary/5 blur-3xl pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-primary/10 text-primary border border-primary/20 shadow-sm backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              <span>Official Updates</span>
            </div>

            {announcements.length > 1 && (
              <span className="text-xs font-medium text-muted-foreground/80 tracking-tight">
                {activeIndex + 1} of {announcements.length}
              </span>
            )}
          </div>

          {/* Apple-style Tactile Controls */}
          {announcements.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  paginate(-1);
                }}
                className="size-8 rounded-full border border-border/80 bg-background/80 hover:bg-background text-foreground/80 hover:text-foreground flex items-center justify-center shadow-sm backdrop-blur-md transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Previous announcement"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  paginate(1);
                }}
                className="size-8 rounded-full border border-border/80 bg-background/80 hover:bg-background text-foreground/80 hover:text-foreground flex items-center justify-center shadow-sm backdrop-blur-md transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Next announcement"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Carousel Viewport with Swipe Gesture and Click-to-Modal */}
        <div className="relative overflow-hidden rounded-2xl min-h-[160px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={page}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag={announcements.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                const swipeThreshold = 50;
                if (info.offset.x < -swipeThreshold || info.velocity.x < -300) {
                  paginate(1);
                } else if (info.offset.x > swipeThreshold || info.velocity.x > 300) {
                  paginate(-1);
                }
              }}
              className="w-full cursor-pointer"
            >
              <div
                onClick={() => setSelectedAnnouncement(current)}
                className="group rounded-2xl border border-border/80 bg-card/85 dark:bg-card/50 backdrop-blur-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-lg active:scale-[0.99]"
              >
                <div className="flex w-full flex-col md:h-60 md:max-h-60 md:flex-row md:items-stretch">

                  {/* Media Column (Compact cinematic split on desktop, letterbox banner on mobile) */}
                  {current.media_url && (
                    <div className="relative h-48 max-h-52 w-full shrink-0 overflow-hidden border-b border-border/60 bg-muted/40 md:h-full md:max-h-60 md:w-80 md:min-w-[280px] md:max-w-[340px] md:border-r md:border-b-0">
                      {current.media_type === 'video' ? (
                        <video
                          src={getFileUrl(current.media_url)}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                          style={{ maxHeight: '240px', objectFit: 'cover' }}
                        />
                      ) : (
                        <ImageWithSkeleton
                          src={getFileUrl(current.media_url)}
                          alt={current.title}
                          containerClassName="w-full h-full"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          style={{ maxHeight: '240px', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  )}

                  {/* Content Column */}
                  <div className="flex-1 p-6 flex flex-col justify-between gap-3 min-w-0 overflow-hidden">
                    <div className="space-y-2.5">
                      {/* Meta badge & Timestamp */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
                        <span className="inline-flex items-center gap-1.5 bg-muted/60 px-2.5 py-0.5 rounded-full text-foreground/80 text-[11px]">
                          <Calendar className="size-3 text-primary" />
                          <span>
                            {new Date(current.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </span>

                        {activeIndex === 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Sparkles className="size-2.5" />
                            Latest
                          </span>
                        )}
                      </div>

                      {/* Display Typography */}
                      <div className="flex items-start gap-3">
                        {!current.media_url && (
                          <div className="hidden sm:flex size-10 rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary items-center justify-center border border-primary/20 shadow-sm shrink-0 mt-0.5">
                            <Bell className="size-5 stroke-[1.8]" />
                          </div>
                        )}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {current.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground/90 leading-relaxed whitespace-pre-line font-normal line-clamp-2">
                            {current.body}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Apple-style Interactive Footer with Pagination & CTA */}
                    <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-border/50">
                      {/* Segmented Dots */}
                      {announcements.length > 1 ? (
                        <div className="flex items-center gap-2">
                          {announcements.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                const diff = idx - activeIndex;
                                paginate(diff);
                              }}
                              className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${idx === activeIndex
                                  ? 'w-6 bg-primary shadow-sm'
                                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                }`}
                              aria-label={`Jump to announcement ${idx + 1}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div />
                      )}

                      {/* Read More Trigger Hint */}
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform duration-200">
                        View Details
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── FULL ANNOUNCEMENT DETAILS MODAL ─── */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl sm:p-8">
          {selectedAnnouncement && (
            <div className="space-y-6">
              {/* Header Badges & Date */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5 flex items-center gap-1.5">
                    <Megaphone className="size-3.5 text-primary" />
                    Official Announcement
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-2.5 py-1 rounded-full">
                    <Calendar className="size-3 text-primary" />
                    {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
                  {selectedAnnouncement.title}
                </DialogTitle>
              </div>

              {/* Full Media Player / Photo Display */}
              {selectedAnnouncement.media_url && (
                <div
                  className="w-full rounded-2xl overflow-hidden bg-black/5 dark:bg-black/40 border border-border/70 flex items-center justify-center shadow-inner"
                  style={{ maxHeight: '380px' }}
                >
                  {selectedAnnouncement.media_type === 'video' ? (
                    <video
                      src={getFileUrl(selectedAnnouncement.media_url)}
                      controls
                      playsInline
                      className="w-full max-h-[380px] object-contain rounded-2xl"
                    />
                  ) : (
                    <img
                      src={getFileUrl(selectedAnnouncement.media_url)}
                      alt={selectedAnnouncement.title}
                      className="w-full max-h-[380px] object-contain rounded-2xl"
                    />
                  )}
                </div>
              )}

              {/* Full Body Content */}
              <div className="space-y-3">
                <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line font-normal">
                  {selectedAnnouncement.body}
                </p>
              </div>

              {/* Footer with Expiry Info & Close Button */}
              <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {selectedAnnouncement.expires_at ? (
                    <>
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Valid until {new Date(selectedAnnouncement.expires_at).toLocaleDateString()}</span>
                    </>
                  ) : (
                    <span>General Center Announcement</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="rounded-xl px-4 h-9 font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
