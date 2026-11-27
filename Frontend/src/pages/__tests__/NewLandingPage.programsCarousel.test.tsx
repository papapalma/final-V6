import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LandingProgramsShowcase, {
  AUTO_ADVANCE_MS,
  CAROUSEL_MAX_ITEMS,
  prioritizePrograms,
} from '../../components/LandingProgramsShowcase';
import { type Program } from '../../utils/programHelpers';

let prefersReducedMotionMatch = false;

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === '(prefers-reduced-motion: reduce)'
          ? prefersReducedMotionMatch
          : query === '(min-width: 1024px)' || query === '(min-width: 640px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function buildPrograms(count = 15): Program[] {
  const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const past = '2026-09-28';

  const list: Program[] = [];
  // 5 older inactive programs listed FIRST to verify priority sorting moves them behind Upcoming/Active
  for (let i = 1; i <= 5; i += 1) {
    list.push({
      id: `inactive-${i}`,
      name: `Completed Batch ${i}`,
      description: `Archived curriculum ${i}`,
      duration: '4 weeks',
      type_of_funding: 'LGU',
      icon: 'GraduationCap',
      status: 'inactive',
      startDate: past,
      endDate: '2026-10-30',
      photoUrl: '',
      createdAt: '2026-09-28T00:00:00Z',
      updatedAt: '2026-10-30T00:00:00Z',
      instructor: `Trainer Old ${i}`,
    });
  }
  // 6 active programs
  for (let i = 1; i <= 6; i += 1) {
    list.push({
      id: `active-${i}`,
      name: `Active Course ${i}`,
      description: `Hands-on active course ${i}`,
      duration: '5 weeks',
      type_of_funding: 'TESDA TWSP',
      icon: 'GraduationCap',
      status: 'active',
      startDate: past,
      endDate: '2026-12-20',
      photoUrl: '',
      createdAt: '2026-10-15T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
      instructor: `Trainer Active ${i}`,
    });
  }
  // Remaining upcoming programs
  const upcomingCount = Math.max(1, count - 11);
  for (let i = 1; i <= upcomingCount; i += 1) {
    list.push({
      id: `upcoming-${i}`,
      name: `Upcoming Track ${i}`,
      description: `Upcoming cohort ${i}`,
      duration: '6 weeks',
      type_of_funding: 'TESDA STEP',
      icon: 'GraduationCap',
      status: 'active',
      startDate: tomorrow,
      endDate: '2027-01-15',
      photoUrl: '',
      createdAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-20T00:00:00Z',
      instructor: `Trainer Upcoming ${i}`,
    });
  }

  return list;
}

describe('LandingProgramsShowcase (Carousel & View All)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefersReducedMotionMatch = false;
    mockMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prioritizes Upcoming then Active then Inactive and caps default carousel to 9 items', () => {
    const programs = buildPrograms(15);
    const ordered = prioritizePrograms(programs);
    expect(ordered[0].id).toBe('upcoming-1');
    expect(ordered[4].id).toBe('active-1');
    expect(ordered[10].id).toBe('inactive-1');

    render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={vi.fn()}
      />
    );

    const carouselCards = screen.getAllByTestId('carousel-program-item');
    expect(carouselCards).toHaveLength(CAROUSEL_MAX_ITEMS);
    expect(document.getElementById('programs')).toHaveClass('landing-band-programs');
    expect(carouselCards[0].querySelector('[data-slot="card"]')).toHaveClass('landing-glass-card');
    expect(screen.getByText('Showing 9 featured of 15 programs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View All Programs \(15\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming Track 1' })).toBeInTheDocument();
    // Inactive batch #5 is beyond the top 9 featured cap in carousel mode
    expect(screen.queryByRole('heading', { name: 'Completed Batch 5' })).not.toBeInTheDocument();
  });

  it('supports Prev/Next wrap-around, slide dots, and keyboard arrow navigation', () => {
    const programs = buildPrograms(15);
    render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={vi.fn()}
      />
    );

    const slide1Tab = screen.getByRole('tab', { name: 'Go to slide 1' });
    const slide2Tab = screen.getByRole('tab', { name: 'Go to slide 2' });
    const slide3Tab = screen.getByRole('tab', { name: 'Go to slide 3' });

    expect(slide1Tab).toHaveAttribute('aria-selected', 'true');

    // Next button -> slide 2
    fireEvent.click(screen.getByRole('button', { name: 'Next programs' }));
    expect(slide2Tab).toHaveAttribute('aria-selected', 'true');

    // Direct dot click -> slide 3
    fireEvent.click(slide3Tab);
    expect(slide3Tab).toHaveAttribute('aria-selected', 'true');

    // Wrap forward from slide 3 -> slide 1
    fireEvent.click(screen.getByRole('button', { name: 'Next programs' }));
    expect(slide1Tab).toHaveAttribute('aria-selected', 'true');

    // Wrap backward via Previous -> slide 3
    fireEvent.click(screen.getByRole('button', { name: 'Previous programs' }));
    expect(slide3Tab).toHaveAttribute('aria-selected', 'true');

    // Keyboard ArrowRight wraps back to slide 1
    const region = screen.getByRole('region', { name: 'Featured training programs' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(slide1Tab).toHaveAttribute('aria-selected', 'true');
  });

  it('auto-advances every 6s when idle and pauses on hover, open modal, search, or reduced motion', () => {
    vi.useFakeTimers();
    const programs = buildPrograms(15);

    const { rerender } = render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Go to slide 1' })).toHaveAttribute('aria-selected', 'true');

    // Idle 6s -> advances to slide 2
    act(() => {
      vi.advanceTimersByTime(AUTO_ADVANCE_MS);
    });
    expect(screen.getByRole('tab', { name: 'Go to slide 2' })).toHaveAttribute('aria-selected', 'true');

    // Hover pauses auto-advance
    const region = screen.getByRole('region', { name: 'Featured training programs' });
    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(AUTO_ADVANCE_MS * 2);
    });
    expect(screen.getByRole('tab', { name: 'Go to slide 2' })).toHaveAttribute('aria-selected', 'true');

    // Mouse leave resumes, but opening modal pauses
    fireEvent.mouseLeave(region);
    rerender(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={true}
        onSelectProgram={vi.fn()}
      />
    );
    act(() => {
      vi.advanceTimersByTime(AUTO_ADVANCE_MS * 2);
    });
    expect(screen.getByRole('tab', { name: 'Go to slide 2' })).toHaveAttribute('aria-selected', 'true');

    // Reduced motion prevents auto-advance even when modal closes
    prefersReducedMotionMatch = true;
    const { unmount } = render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={vi.fn()}
      />
    );
    const reducedSlide1 = screen.getAllByRole('tab', { name: 'Go to slide 1' })[1];
    expect(reducedSlide1).toHaveAttribute('aria-selected', 'true');
    act(() => {
      vi.advanceTimersByTime(AUTO_ADVANCE_MS * 2);
    });
    expect(reducedSlide1).toHaveAttribute('aria-selected', 'true');
    unmount();
  });

  it('expands inline to show all programs without pagination and collapses via Collapse', () => {
    const programs = buildPrograms(15);
    render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /View All Programs \(15\)/i }));

    expect(screen.getByTestId('all-programs-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('grid-program-item')).toHaveLength(15);
    expect(screen.getByRole('heading', { name: 'Completed Batch 5' })).toBeInTheDocument();

    // Collapse buttons appear at top and bottom
    const collapseButtons = screen.getAllByRole('button', { name: /Collapse/i });
    expect(collapseButtons).toHaveLength(2);

    fireEvent.click(collapseButtons[1]);
    expect(screen.queryByTestId('all-programs-grid')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('carousel-program-item')).toHaveLength(CAROUSEL_MAX_ITEMS);
  });

  it('searches across the full catalog even while in carousel mode and invokes onSelectProgram', () => {
    const programs = buildPrograms(15);
    const onSelectProgram = vi.fn();

    render(
      <LandingProgramsShowcase
        programs={programs}
        isModalOpen={false}
        onSelectProgram={onSelectProgram}
      />
    );

    const searchInput = screen.getByLabelText('Search courses');
    fireEvent.change(searchInput, { target: { value: 'Completed Batch 5' } });

    // Found immediately even though it was outside the top 9 carousel items
    expect(screen.getAllByTestId('carousel-program-item')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Completed Batch 5' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View Details/i }));
    expect(onSelectProgram).toHaveBeenCalledWith(expect.objectContaining({ id: 'inactive-5' }));

    // Unmatched search shows empty state & Clear Search resets it
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Course XYZ' } });
    expect(screen.getByText('No Programs Found')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear Search/i }));
    expect(screen.getAllByTestId('carousel-program-item')).toHaveLength(CAROUSEL_MAX_ITEMS);
  });
});
