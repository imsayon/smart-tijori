// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AtelierHero } from '@/components/shop/atelier/atelier-hero';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => React.createElement('img', { alt, src }),
}));

describe('Green Atelier homepage hero', () => {
  it('leads with editorial photography and real catalog and branch links', () => {
    render(<AtelierHero />);
    expect(screen.getByRole('heading', { name: /Better things.*Closer home/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByAltText('Warmly lit travel essentials arranged by a window')).toHaveAttribute('src', '/atelier/neighbourhood-editorial.jpeg');
    expect(screen.getByRole('link', { name: /Explore the collection/i })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /Find your store/i })).toHaveAttribute('href', '/stores');
    expect(screen.queryByRole('button', { name: /interactive view/i })).not.toBeInTheDocument();
  });
});
