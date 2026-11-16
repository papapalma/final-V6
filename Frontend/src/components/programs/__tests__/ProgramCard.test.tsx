import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProgramCard } from '../ProgramCard';

const render = (ui: React.ReactElement, options?: any) =>
  rtlRender(ui, { wrapper: MemoryRouter, ...options });

// Mock the useMediaQuery hook
vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn((query: string) => query === '(min-width: 1024px)'),
  breakpoints: {
    desktop: '(min-width: 1024px)',
  },
}));

import { useMediaQuery } from '../../../hooks/useMediaQuery';

describe('ProgramCard - Button Visibility Behavior', () => {
  const mockProgram = {
    id: '1',
    name: 'React Basics',
    description: 'Learn React fundamentals',
    start_date: '2024-01-01',
    end_date: '2024-02-01',
    status: 'active',
    instructor: 'John Doe',
    duration_weeks: 4,
    max_trainees: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop Button Visibility (Hover-based)', () => {
    beforeEach(() => {
      vi.mocked(useMediaQuery).mockReturnValue(true); // Desktop
    });

    it('should hide button on desktop by default', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /enroll/i });
      expect(button.className).toContain('opacity-0');
    });

    it('should show button on desktop hover', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');
      expect(card).toBeInTheDocument();

      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-100');
      });
    });

    it('should hide button on mouse leave', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');

      // First show the button
      fireEvent.mouseEnter(card!);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enroll/i }).className).toContain('opacity-100');
      });

      // Then hide it
      fireEvent.mouseLeave(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-0');
      });
    });
  });

  describe('Mobile Button Visibility (Touch-based)', () => {
    beforeEach(() => {
      vi.mocked(useMediaQuery).mockReturnValue(false); // Mobile
    });

    it('should hide button on mobile by default', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /enroll/i });
      expect(button.className).toContain('opacity-0');
    });

    it('should show button on mobile touch start', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');

      fireEvent.touchStart(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-100');
      });
    });

    it('should hide button on touch end', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');

      // Show button with touch
      fireEvent.touchStart(card!);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enroll/i }).className).toContain('opacity-100');
      });

      // Hide button
      fireEvent.touchEnd(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-0');
      });
    });

    it('should show button on focus', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');

      fireEvent.focus(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-100');
      });
    });

    it('should hide button on blur', async () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');

      fireEvent.focus(card!);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enroll/i }).className).toContain('opacity-100');
      });

      fireEvent.blur(card!);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        expect(button.className).toContain('opacity-0');
      });
    });
  });

  describe('Button State Management', () => {
    it('should display "Enroll" button when not enrolled', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /enroll/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should display "Enrolled" button when enrolled', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={true}
          enrollmentStatus="in-progress"
          onEnroll={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /enrolled/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('should display "Graduate" button when program completed', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={true}
          enrollmentStatus="completed"
          graduatedDate={new Date('2024-02-01')}
          onEnroll={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: /graduate/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('should call onEnroll when button clicked', async () => {
      const onEnroll = vi.fn();
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={onEnroll}
        />
      );

      const card = container.querySelector('[tabindex="0"]');
      fireEvent.mouseEnter(card!); // Show button on desktop

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /enroll/i });
        fireEvent.click(button);
      });

      expect(onEnroll).toHaveBeenCalled();
    });
  });

  describe('Capacity Counter Display', () => {
    it('should render capacity counter with format "X / Y trainees" when enrollmentLimit and enrolledCount provided', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={12}
        />
      );

      const capacityText = screen.getByText('12 / 30 trainees');
      expect(capacityText).toBeInTheDocument();
    });

    it('should not render capacity counter when enrollmentLimit is null', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={null}
          enrolledCount={12}
        />
      );

      expect(screen.queryByText(/\d+ \/ \d+ trainees/)).not.toBeInTheDocument();
    });

    it('should not render capacity counter when enrollmentLimit is undefined', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrolledCount={12}
        />
      );

      expect(screen.queryByText(/\d+ \/ \d+ trainees/)).not.toBeInTheDocument();
    });

    it('should render capacity counter at 0 when no trainees enrolled', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={0}
        />
      );

      const capacityText = screen.getByText('0 / 30 trainees');
      expect(capacityText).toBeInTheDocument();
    });

    it('should render "Full" badge when at capacity', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={30}
        />
      );

      const fullBadge = screen.getByText('Full');
      expect(fullBadge).toBeInTheDocument();
    });

    it('should not render "Full" badge when not at capacity', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={12}
        />
      );

      expect(screen.queryByText('Full')).not.toBeInTheDocument();
    });

    it('should disable enrollment button when at capacity', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={30}
        />
      );

      const button = screen.getByRole('button', { name: /program full/i });
      expect(button).toBeDisabled();
    });

    it('should change button text to "Program Full" when at capacity', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={30}
        />
      );

      const button = screen.getByRole('button', { name: /program full/i });
      expect(button).toBeInTheDocument();
    });

    it('should enable enrollment button when below capacity', () => {
      render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={29}
        />
      );

      const button = screen.getByRole('button', { name: /enroll/i });
      expect(button).not.toBeDisabled();
    });

    it('should update capacity counter when props change', () => {
      const { rerender } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={12}
        />
      );

      expect(screen.getByText('12 / 30 trainees')).toBeInTheDocument();

      rerender(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
          enrollmentLimit={30}
          enrolledCount={15}
        />
      );

      expect(screen.getByText('15 / 30 trainees')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have tabIndex for keyboard navigation', () => {
      const { container } = render(
        <ProgramCard
          program={mockProgram}
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const card = container.querySelector('[tabindex="0"]');
      expect(card).toBeInTheDocument();
    });

    it('should have alt text for program image', () => {
      render(
        <ProgramCard
          program={mockProgram}
          photoUrl="http://example.com/image.jpg"
          isEnrolled={false}
          enrollmentStatus="accepting"
          onEnroll={vi.fn()}
        />
      );

      const image = screen.getByAltText('React Basics');
      expect(image).toBeInTheDocument();
    });
  });
});
