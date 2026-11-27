import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import ImageWithSkeleton from './ui/ImageWithSkeleton';
import { type Program } from '../utils/programHelpers';
import {
  GraduationCap,
  Search,
  Clock,
  BookOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
} from 'lucide-react';

export const CAROUSEL_MAX_ITEMS = 9;
export const AUTO_ADVANCE_MS = 6000;

type ProgramFilter = 'all' | 'upcoming' | 'active';
type ViewMode = 'carousel' | 'all';

interface LandingProgramsShowcaseProps {
  programs: Program[];
  isModalOpen: boolean;
  onSelectProgram: (program: Program) => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'TBA';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const isProgramUpcoming = (startDate: string): boolean => {
  if (!startDate) return false;
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start > today;
};

export const daysUntilStart = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const isProgramActive = (program: Program): boolean => {
  const status = program.status?.toLowerCase();
  return status === 'active' || status === 'open';
};

/**
 * Stable priority ordering so Upcoming and Active programs always lead the featured carousel
 * before Completed / Inactive programs.
 */
export const prioritizePrograms = (programs: Program[]): Program[] => {
  const getTier = (program: Program): number => {
    if (isProgramUpcoming(program.startDate)) return 0;
    if (isProgramActive(program)) return 1;
    return 2;
  };

  return programs
    .map((program, index) => ({ program, index, tier: getTier(program) }))
    .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.index - b.index))
    .map((entry) => entry.program);
};

function getResponsiveCardsPerView(): 1 | 2 | 3 {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 3;
  }
  const lg = window.matchMedia('(min-width: 1024px)');
  const sm = window.matchMedia('(min-width: 640px)');
  if (lg?.matches) return 3;
  if (sm?.matches) return 2;
  // In jsdom tests where matchMedia defaults all queries to false, treat desktop width (>= 1024 or default 1024) as 3
  if (typeof window.innerWidth === 'number' && window.innerWidth >= 1024) return 3;
  if (typeof window.innerWidth === 'number' && window.innerWidth >= 640) return 2;
  return 1;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const handleChange = () => setReduced(Boolean(mq.matches));
    handleChange();
    mq.addEventListener?.('change', handleChange);
    return () => mq.removeEventListener?.('change', handleChange);
  }, []);

  return reduced;
}

interface ProgramCardProps {
  program: Program;
  onSelect: (program: Program) => void;
}

function ProgramCard({ program, onSelect }: ProgramCardProps) {
  const isUpcoming = isProgramUpcoming(program.startDate);
  const days = isUpcoming ? daysUntilStart(program.startDate) : 0;

  return (
    <Card
      interactive
      className="group flex flex-col h-full overflow-hidden border landing-glass-card landing-glass-card-interactive rounded-2xl"
      onClick={() => onSelect(program)}
    >
      {/* Course Image: 16:9 Aspect Ratio with Shimmer Skeleton */}
      <div className="relative w-full aspect-video overflow-hidden border-b border-border/60 bg-muted/30">
        {program.photoUrl ? (
          <ImageWithSkeleton
            src={program.photoUrl}
            alt={program.name}
            className="programs-card-media"
            fallbackIcon={<BookOpen className="size-8 stroke-1 text-primary/40 mb-1" />}
          />
        ) : (
          <div
            aria-hidden="true"
            className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 text-primary p-4"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/80 text-center line-clamp-1 max-w-[85%]">
              {program.name}
            </span>
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 z-10">
          <Badge className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 shadow-sm">
            {program.status || 'Active'}
          </Badge>
        </div>
      </div>

      <CardHeader className="px-6 pt-6 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {isUpcoming && (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Clock className="size-3.5" />
              Starts in {days} {days === 1 ? 'day' : 'days'}
            </span>
          )}
          {program.duration && (
            <span className="text-xs text-muted-foreground ml-auto font-medium">
              {program.duration}
            </span>
          )}
        </div>
        <CardTitle className="text-base sm:text-lg font-bold line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug">
          {program.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-0 flex flex-col flex-1 justify-between space-y-4">
        <CardDescription className="text-xs sm:text-sm line-clamp-2 text-muted-foreground font-normal leading-relaxed">
          {program.description || 'Comprehensive technical training program designed to prepare trainees for industry roles.'}
        </CardDescription>

        <div className="space-y-2 border-t border-border/60 pt-3.5 text-xs text-muted-foreground">
          {program.instructor && (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground/80">Instructor:</span>
              <span className="text-foreground truncate font-medium text-right max-w-[160px]">
                {program.instructor}
              </span>
            </div>
          )}
          {program.startDate && (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground/80">Start:</span>
              <span className="text-foreground font-medium">{formatDate(program.startDate)}</span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(program);
          }}
          className="programs-tactile-btn w-full h-9 text-xs sm:text-sm font-semibold bg-background border border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary rounded-xl"
        >
          <Eye className="size-3.5 mr-1.5" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LandingProgramsShowcase({
  programs,
  isModalOpen,
  onSelectProgram,
}: LandingProgramsShowcaseProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const touchPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ProgramFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [cardsPerView, setCardsPerView] = useState<1 | 2 | 3>(() => getResponsiveCardsPerView());
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusedWithin, setIsFocusedWithin] = useState(false);
  const [isTouchPaused, setIsTouchPaused] = useState(false);

  // Track responsive breakpoints (1 / 2 / 3 cards per view)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const lgQuery = window.matchMedia('(min-width: 1024px)');
    const smQuery = window.matchMedia('(min-width: 640px)');
    const updateCardsPerView = () => {
      setCardsPerView(getResponsiveCardsPerView());
    };

    updateCardsPerView();
    lgQuery.addEventListener?.('change', updateCardsPerView);
    smQuery.addEventListener?.('change', updateCardsPerView);

    return () => {
      lgQuery.removeEventListener?.('change', updateCardsPerView);
      smQuery.removeEventListener?.('change', updateCardsPerView);
    };
  }, []);

  // Filter across the full catalog first (so searching older/unfeatured programs still finds them),
  // then stably prioritize Upcoming -> Active -> Inactive.
  const sortedFilteredPrograms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = programs.filter((program) => {
      const matchesSearch =
        !query ||
        program.name.toLowerCase().includes(query) ||
        (program.description && program.description.toLowerCase().includes(query)) ||
        (program.instructor && program.instructor.toLowerCase().includes(query));

      if (!matchesSearch) return false;
      if (selectedFilter === 'upcoming') return isProgramUpcoming(program.startDate);
      if (selectedFilter === 'active') return isProgramActive(program);
      return true;
    });

    return prioritizePrograms(filtered);
  }, [programs, searchQuery, selectedFilter]);

  const carouselPrograms = useMemo(
    () => sortedFilteredPrograms.slice(0, CAROUSEL_MAX_ITEMS),
    [sortedFilteredPrograms]
  );

  const totalSlides = Math.max(1, Math.ceil(carouselPrograms.length / cardsPerView));
  const hasActiveFilter = searchQuery.trim().length > 0 || selectedFilter !== 'all';
  const showViewAllToggle =
    sortedFilteredPrograms.length > cardsPerView ||
    sortedFilteredPrograms.length > carouselPrograms.length;
  const isCapped = sortedFilteredPrograms.length > carouselPrograms.length;

  const scrollToSlide = useCallback(
    (targetSlide: number) => {
      const bounded = ((targetSlide % totalSlides) + totalSlides) % totalSlides;
      setActiveSlide(bounded);

      const track = trackRef.current;
      if (!track || typeof track.scrollTo !== 'function') return;

      const cardIndex = Math.min(bounded * cardsPerView, Math.max(0, track.children.length - 1));
      const targetCard = track.children[cardIndex] as HTMLElement | undefined;
      if (!targetCard) return;

      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const targetLeft = Math.min(targetCard.offsetLeft, maxScroll);

      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 380);

      track.scrollTo({
        left: targetLeft,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [totalSlides, cardsPerView, prefersReducedMotion]
  );

  // Reset carousel to slide 0 when filters, search, or viewport column count change
  useEffect(() => {
    setActiveSlide(0);
    const track = trackRef.current;
    if (track && typeof track.scrollTo === 'function') {
      track.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [searchQuery, selectedFilter, cardsPerView, viewMode]);

  // Clean up pending timers on unmount
  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      if (touchPauseTimerRef.current) clearTimeout(touchPauseTimerRef.current);
    };
  }, []);

  // Gentle 6s auto-advance when idle in carousel mode (matches Hero Announcements cadence)
  const shouldAutoAdvance =
    viewMode === 'carousel' &&
    totalSlides > 1 &&
    !isHovered &&
    !isFocusedWithin &&
    !isTouchPaused &&
    !isModalOpen &&
    searchQuery.trim().length === 0 &&
    !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAutoAdvance) return;

    const timer = setTimeout(() => {
      scrollToSlide(activeSlide + 1);
    }, AUTO_ADVANCE_MS);

    return () => clearTimeout(timer);
  }, [shouldAutoAdvance, activeSlide, scrollToSlide]);

  // Sync dot indicator when user swipes or trackpad-scrolls natively
  const handleTrackScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    const track = trackRef.current;
    if (!track || track.children.length === 0) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    let closestSlide = 0;
    let smallestDelta = Number.POSITIVE_INFINITY;

    for (let slide = 0; slide < totalSlides; slide += 1) {
      const cardIndex = Math.min(slide * cardsPerView, track.children.length - 1);
      const cardEl = track.children[cardIndex] as HTMLElement | undefined;
      if (!cardEl) continue;
      const expectedLeft = Math.min(cardEl.offsetLeft, maxScroll);
      const delta = Math.abs(track.scrollLeft - expectedLeft);
      if (delta < smallestDelta) {
        smallestDelta = delta;
        closestSlide = slide;
      }
    }

    if (closestSlide !== activeSlide) {
      setActiveSlide(closestSlide);
    }
  };

  const handleTouchInteraction = () => {
    setIsTouchPaused(true);
    if (touchPauseTimerRef.current) clearTimeout(touchPauseTimerRef.current);
    touchPauseTimerRef.current = setTimeout(() => {
      setIsTouchPaused(false);
    }, AUTO_ADVANCE_MS);
  };

  const handleCarouselKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalSlides <= 1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToSlide(activeSlide + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToSlide(activeSlide - 1);
    }
  };

  const handleCollapseToCarousel = () => {
    setViewMode('carousel');
    setActiveSlide(0);
    if (typeof sectionRef.current?.scrollIntoView === 'function') {
      sectionRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  const filterOptions: Array<{ value: ProgramFilter; label: string }> = [
    { value: 'all', label: `All (${programs.length})` },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'active', label: 'Active' },
  ];

  return (
    <section
      id="programs"
      ref={sectionRef}
      className="py-16 md:py-24 lg:py-28 landing-band-programs border-b border-border/50 scroll-mt-20"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
          <div className="space-y-3 max-w-xl">
            <Badge
              variant="outline"
              className="px-3.5 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5"
            >
              Vocational Tracks
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Explore Available Programs
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Find the training course that matches your interests and career goals.
            </p>
          </div>

          {/* Search & Segmented Filter Pills */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                aria-label="Search courses"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-60 h-10 bg-background"
              />
            </div>

            <LayoutGroup id="landing-programs-filters">
              <div
                role="group"
                aria-label="Filter programs by status"
                className="flex items-center gap-1 p-1 bg-background rounded-lg border border-border"
              >
                {filterOptions.map((opt) => {
                  const isActive = selectedFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedFilter(opt.value)}
                      aria-pressed={isActive}
                      className={`relative h-8 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isActive &&
                        (prefersReducedMotion ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-primary shadow-xs"
                          />
                        ) : (
                          <motion.span
                            layoutId="landing-programs-filter-pill"
                            aria-hidden="true"
                            transition={{ type: 'spring', duration: 0.22, bounce: 0 }}
                            className="absolute inset-0 rounded-md bg-primary shadow-xs"
                          />
                        ))}
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>

        {/* Content Area */}
        {sortedFilteredPrograms.length > 0 ? (
          viewMode === 'carousel' ? (
            <div
              key="carousel-view"
              role="region"
              aria-roledescription="carousel"
              aria-label="Featured training programs"
              tabIndex={0}
              onKeyDown={handleCarouselKeyDown}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onFocusCapture={() => setIsFocusedWithin(true)}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setIsFocusedWithin(false);
                }
              }}
              onTouchStart={handleTouchInteraction}
              className="programs-view-enter focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
            >
              {/* Horizontal Scroll-Snap Track */}
              <div
                ref={trackRef}
                onScroll={handleTrackScroll}
                data-testid="programs-carousel-track"
                className="programs-carousel-track relative flex gap-6 overflow-x-auto snap-x snap-mandatory py-3 -my-3 px-1 -mx-1"
              >
                {carouselPrograms.map((program) => (
                  <div
                    key={program.id}
                    data-testid="carousel-program-item"
                    className="shrink-0 snap-start w-full sm:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)]"
                  >
                    <ProgramCard program={program} onSelect={onSelectProgram} />
                  </div>
                ))}
              </div>

              {/* Carousel Controls & View All CTA */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {totalSlides > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => scrollToSlide(activeSlide - 1)}
                        aria-label="Previous programs"
                        className="programs-tactile-btn size-10 rounded-full bg-background border-border/80 hover:border-primary/40"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>

                      <div className="flex items-center gap-1" role="tablist" aria-label="Program carousel slides">
                        {Array.from({ length: totalSlides }, (_, idx) => {
                          const isCurrent = idx === activeSlide;
                          return (
                            <button
                              key={idx}
                              type="button"
                              role="tab"
                              aria-selected={isCurrent}
                              aria-label={`Go to slide ${idx + 1}`}
                              onClick={() => scrollToSlide(idx)}
                              className="p-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full"
                            >
                              <span
                                className={`block h-2 rounded-full transition-all duration-200 ${
                                  isCurrent
                                    ? 'w-6 bg-primary'
                                    : 'w-2 bg-border hover:bg-primary/50'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => scrollToSlide(activeSlide + 1)}
                        aria-label="Next programs"
                        className="programs-tactile-btn size-10 rounded-full bg-background border-border/80 hover:border-primary/40"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  )}

                  <span className="text-xs font-medium text-muted-foreground">
                    {isCapped
                      ? `Showing ${carouselPrograms.length} featured of ${sortedFilteredPrograms.length} programs`
                      : totalSlides > 1
                        ? `Slide ${activeSlide + 1} of ${totalSlides}`
                        : `Showing ${carouselPrograms.length} ${carouselPrograms.length === 1 ? 'program' : 'programs'}`}
                  </span>
                </div>

                {showViewAllToggle && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode('all')}
                    className="programs-tactile-btn py-2.5 px-5 h-10 rounded-xl font-semibold bg-background border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary w-full sm:w-auto"
                  >
                    <LayoutGrid className="size-4 mr-2" />
                    {hasActiveFilter
                      ? `View All Matching Programs (${sortedFilteredPrograms.length})`
                      : `View All Programs (${sortedFilteredPrograms.length})`}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div key="all-programs-view" className="programs-view-enter">
              {/* Top Expand Summary Bar */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border landing-glass-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing all{' '}
                  <span className="font-semibold text-foreground">
                    {sortedFilteredPrograms.length}
                  </span>{' '}
                  {hasActiveFilter ? 'matching ' : ''}
                  {sortedFilteredPrograms.length === 1 ? 'program' : 'programs'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCollapseToCarousel}
                  className="programs-tactile-btn py-2 px-3.5 h-9 rounded-xl font-semibold self-start sm:self-auto"
                >
                  <ChevronUp className="size-4 mr-1.5" />
                  Collapse
                </Button>
              </div>

              {/* Full Grid (all matching programs, zero per-card scroll-stagger delay) */}
              <div
                data-testid="all-programs-grid"
                className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              >
                {sortedFilteredPrograms.map((program) => (
                  <div key={program.id} data-testid="grid-program-item">
                    <ProgramCard program={program} onSelect={onSelectProgram} />
                  </div>
                ))}
              </div>

              {/* Bottom Collapse Button */}
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCollapseToCarousel}
                  className="programs-tactile-btn py-2.5 px-5 h-10 rounded-xl font-semibold bg-background"
                >
                  <ChevronUp className="size-4 mr-2" />
                  Collapse
                </Button>
              </div>
            </div>
          )
        ) : (
          <Card className="border-dashed border-2 landing-glass-card p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4 text-muted-foreground">
              <GraduationCap className="size-7" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Programs Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              {searchQuery
                ? `No courses matched "${searchQuery}". Try clearing your search.`
                : selectedFilter !== 'all'
                  ? `No ${selectedFilter} programs are currently available.`
                  : 'There are currently no training programs listed.'}
            </p>
            {(searchQuery || selectedFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                className="programs-tactile-btn py-2 px-3.5"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFilter('all');
                }}
              >
                {searchQuery ? 'Clear Search' : 'Show All Programs'}
              </Button>
            )}
          </Card>
        )}
      </div>
    </section>
  );
}
