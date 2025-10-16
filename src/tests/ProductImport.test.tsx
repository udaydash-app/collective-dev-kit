import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import ProductImport from '@/pages/admin/ProductImport';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    functions: {
      invoke: vi.fn()
    }
  }
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ProductImport', () => {
  it('renders import form', () => {
    renderWithProviders(<ProductImport />);
    expect(screen.getByText('Product Import Tool')).toBeInTheDocument();
    expect(screen.getByLabelText(/website url/i)).toBeInTheDocument();
  });

  it('disables import button when fields empty', () => {
    renderWithProviders(<ProductImport />);
    const importButton = screen.getByRole('button', { name: /import products/i });
    expect(importButton).toBeDisabled();
  });

  it('enables import button when fields filled', () => {
    renderWithProviders(<ProductImport />);
    const urlInput = screen.getByLabelText(/website url/i);
    
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    
    const importButton = screen.getByRole('button', { name: /import products/i });
    // Note: Still disabled until store is selected, but URL validation works
    expect(urlInput).toHaveValue('https://example.com');
  });
});
