import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('renders nothing when there is one page or fewer', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={3} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders page buttons and the total count', () => {
    render(<Pagination page={1} totalPages={3} total={25} onChange={vi.fn()} />);
    expect(screen.getByText('25 links')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('disables prev on the first page and next on the last page', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={3} total={25} onChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    rerender(<Pagination page={3} totalPages={3} total={25} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls onChange with the clicked page', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={3} total={25} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('collapses distant pages with an ellipsis', () => {
    render(<Pagination page={5} totalPages={10} total={100} onChange={vi.fn()} />);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });
});
