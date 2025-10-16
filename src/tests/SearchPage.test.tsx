import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import SearchPage from '@/pages/SearchPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
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

describe('SearchPage', () => {
  it('renders search input', () => {
    renderWithProviders(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/search for products or ask anything/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('displays recent searches when no query', () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('Trending Searches')).toBeInTheDocument();
  });

  it('shows AI suggestions button when query entered', () => {
    renderWithProviders(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/search for products or ask anything/i);
    
    fireEvent.change(searchInput, { target: { value: 'organic vegetables' } });
    
    expect(screen.getByText(/get ai-powered suggestions/i)).toBeInTheDocument();
  });

  it('clears search query when X button clicked', () => {
    renderWithProviders(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/search for products or ask anything/i) as HTMLInputElement;
    
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    expect(searchInput.value).toBe('test query');
    
    const clearButton = screen.getByRole('button', { name: '' });
    fireEvent.click(clearButton);
    
    expect(searchInput.value).toBe('');
  });
});
