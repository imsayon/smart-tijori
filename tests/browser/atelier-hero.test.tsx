// @vitest-environment happy-dom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AtelierHero } from '@/components/shop/atelier/atelier-hero';

vi.mock('next/dynamic', () => ({
  default: () => function MockScene() { return null; },
}));
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => React.createElement('img', { alt, src }),
}));

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('Green Atelier homepage hero', () => {
  it('opens with the editorial photograph, matching the reference design', () => {
    render(<AtelierHero />);
    expect(screen.getByRole('heading', { name: /Better things.*Closer home/i })).toBeInTheDocument();
    const photograph = screen.getByAltText('Warmly lit travel essentials arranged by a window');
    expect(photograph).toHaveAttribute('src', '/atelier/neighbourhood-editorial.jpeg');
    expect(screen.getByRole('link', { name: /Explore the collection/i })).toHaveAttribute('href', '/#market');
    expect(screen.getByRole('link', { name: /Find your store/i })).toHaveAttribute('href', '/stores');
  });

  it('can enter and exit the optional 3D experience without losing the photograph', () => {
    render(<AtelierHero />);
    fireEvent.click(screen.getByRole('button', { name: /Switch to 3D Spatial Lock View/i }));
    expect(screen.queryByAltText('Warmly lit travel essentials arranged by a window')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Switch to Editorial View/i }));
    expect(screen.getByAltText('Warmly lit travel essentials arranged by a window')).toBeInTheDocument();
  });
});
