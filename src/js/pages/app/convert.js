/**
 * Convert Page Controller
 * Handles USDT to USD conversion with live rates and detailed quote breakdown
 */

// Import shared app initializer
import '/public/assets/js/_shared/app_init.js';

class ConvertPage {
  constructor() {
    this.currentUser = null;
    this.userBalances = null;
    this.currentQuote = null;
    this.conversionSettings = null;
    this.lastConversions = null;
    this.init();
  }

  async init() {
    console.log('Convert page initializing...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }

  async setupPage() {
    try {
      // Initialize app shell (sidebar, navigation, etc.)
      if (window.AppShell) {
        window.AppShell.initShell();
      }
      
      // Show skeleton while loading
      this.showLoadingState();
      
      // Load data with error handling
      await this.loadUserData();
      await this.loadConversionSettings();
      await this.loadUserBalances();
      await this.loadConversionHistory();
      
      // Setup UI
      this.updateBalanceDisplay();
      this.setupSearchAndFilters();
      this.setupRefreshButton();
      
      console.log('Convert page setup complete');
    } catch (error) {
      console.error('Error setting up convert page:', error);
      
      // Show error modal with retry
      const mappedError = error.mappedError || {
        kind: 'unknown',
        title: 'Setup Failed',
        message: 'Failed to load conversion page. Please try again.'
      };
      
      window.showModal({
        title: mappedError.title,
        message: mappedError.message,
        primaryText: 'Retry',
        onPrimary: () => this.setupPage(),
        secondaryText: 'Cancel',
        onSecondary: () => this.showErrorState()
      });
    }
  }

  showLoadingState() {
    // Show skeleton for conversion history
    const historyContainer = document.querySelector('[data-list="conversion-history"]');
    if (historyContainer) {
      window.renderSkeletonList(historyContainer, 5);
    }
  }

  showErrorState() {
    const historyContainer = document.querySelector('[data-list="conversion-history"]');
    if (historyContainer) {
      window.renderError(historyContainer, {
        title: 'Failed to Load',
        body: 'Could not load conversion history. Please refresh the page.',
        actionText: 'Refresh',
        onAction: () => this.setupPage()
      });
    }
  }

  setupSearchAndFilters() {
    // Add search input for conversion history
    const searchInput = document.querySelector('[data-search="conversions"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterConversions(e.target.value);
      });
    }

    // Add filter chips
    const filterChips = document.querySelectorAll('[data-filter]');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        // Remove active class from all chips
        filterChips.forEach(c => c.classList.remove('active'));
        // Add active class to clicked chip
        chip.classList.add('active');
        // Apply filter
        this.filterConversionsByStatus(chip.dataset.filter);
      });
    });
  }

  setupRefreshButton() {
    const refreshBtn = document.querySelector('[data-refresh="conversions"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
        
        try {
          await this.loadConversionHistory();
          window.toast.success('Conversion history refreshed');
        } catch (error) {
          window.toast.error('Failed to refresh history');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = 'Refresh';
        }
      });
    }
  }

  filterConversions(searchTerm) {
    const items = document.querySelectorAll('[data-list="conversion-history"] .list-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(term) ? 'block' : 'none';
    });
  }

  filterConversionsByStatus(status) {
    const items = document.querySelectorAll('[data-list="conversion-history"] .list-item');
    
    items.forEach(item => {
      if (status === 'all') {
        item.style.display = 'block';
      } else {
        const itemStatus = item.dataset.status;
        item.style.display = itemStatus === status ? 'block' : 'none';
      }
    });
  }

  loadAppShell() {
    const shellContainer = document.getElementById('app-shell-container');
    if (shellContainer) {
      fetch('/src/components/app-shell.html')
        .then(response => response.text())
        .then(html => {
          shellContainer.innerHTML = html;
          
          if (window.AppShell) {
            window.AppShell.setupShell();
          }
        })
        .catch(error => {
          console.error('Failed to load app shell:', error);
        });
    }
  }

  async loadUserData() {
    try {
      this.currentUser = await window.AuthService.getCurrentUserWithProfile();
      
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      throw error;
    }
  }

  async loadConversionSettings() {
    try {
      // Use withdrawal_settings to get conversion fees
      const { data, error } = await window.API.fetchEdge('withdrawal_settings', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      // Use real settings only
      this.conversionSettings = {
        auto_convert_enabled: data.auto_convert_enabled ?? true,
        fees: {
          markup_percentage: data.markup_percentage ?? 0,
          fixed_fee_usd: data.fixed_fee_usd ?? 0,
          variable_fee_percentage: data.variable_fee_percentage ?? 0
        },
        rounding: {
          usd_decimals: data.usd_decimals ?? 2,
          usdt_decimals: data.usdt_decimals ?? 6
        },
        rate_provider: data.rate_provider ?? 'fixed',
        refresh_interval: data.refresh_interval ?? 30
      };
    } catch (error) {
      console.error('Failed to load conversion settings:', error);
      // No fallback - show error state
      this.conversionSettings = null;
    }
  }

  async loadUserBalances() {
    try {
      console.log('Loading user balances via BalanceService...');
      
      // Get current user ID
      const userId = await window.API.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Use BalanceService as single source of truth
      if (!window.BalanceService) {
        throw new Error('BalanceService not available');
      }
      
      const balanceData = await window.BalanceService.getUserBalances(userId);
      
      // Transform BalanceService format to the format expected by convert page
      this.userBalances = balanceData.balances || {};
      console.log('User balances loaded:', this.userBalances);
    } catch (error) {
      console.error('Failed to load user balances:', error);
      // No fallback - show error state
      this.userBalances = null;
    }
  }

  async loadConversionHistory() {
    try {
      const { data, error } = await window.API.fetchEdge('conversion_history', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      // Use real conversions or empty array
      this.lastConversions = data.conversions || [];
      this.renderConversionHistory();
    } catch (error) {
      console.error('Failed to load conversion history:', error);
      
      // Show error state for conversion history
      const historyContainer = document.querySelector('[data-list="conversion-history"]');
      if (historyContainer) {
        window.renderError(historyContainer, {
          title: 'Failed to Load History',
          body: 'Could not load conversion history. Please try refreshing.',
          actionText: 'Retry',
          onAction: () => this.loadConversionHistory()
        });
      }
      
      // Set empty array for other UI components
      this.lastConversions = [];
    }
  }

  updateBalanceDisplay() {
    const usdtBalance = document.getElementById('usdt-balance');
    const usdBalance = document.getElementById('usd-balance');
    const lastUSDTConversion = document.getElementById('last-usdt-conversion');
    const lastUSDConversion = document.getElementById('last-usd-conversion');

    // Handle missing balance data gracefully
    if (!this.userBalances) {
      if (usdtBalance) usdtBalance.textContent = 'Balance unavailable';
      if (usdBalance) usdBalance.textContent = 'Balance unavailable';
      return;
    }

    const usdt = Number(this.userBalances?.USDT?.available || 0);
    const usd = Number(this.userBalances?.USD?.available || 0);
    if (!Number.isFinite(usdt)) usdt = 0;
    if (!Number.isFinite(usd)) usd = 0;

    if (usdtBalance) {
      usdtBalance.textContent = `₮${this.formatMoney(usdt, 6)}`;
    }

    if (usdBalance) {
      usdBalance.textContent = `$${this.formatMoney(usd, 2)}`;
    }

    // Update last conversion info
    if (this.lastConversions && this.lastConversions.length > 0) {
      const lastConversion = this.lastConversions[0];
      const timeAgo = this.getTimeAgo(new Date(lastConversion.created_at));
      
      if (lastUSDTConversion) {
        lastUSDTConversion.textContent = `Last: ${timeAgo}`;
      }
      
      if (lastUSDConversion) {
        lastUSDConversion.textContent = `Last: ${timeAgo}`;
      }
    }
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  setupAutoRefresh() {
    // Auto-refresh quote every 30 seconds
    setInterval(() => {
      if (this.currentQuote) {
        this.refreshQuote();
      }
    }, this.conversionSettings.refresh_interval * 1000);
  }

  async updateQuote() {
    const amountInput = document.getElementById('convert-amount');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
      this.hideQuote();
      return;
    }

    // Check if amount exceeds available balance
    if (amount > this.userBalances.USDT.available) {
      this.showQuoteError('Insufficient USDT balance');
      return;
    }

    try {
      const { data, error } = await window.API.fetchEdge('fx_quote', {
        method: 'POST',
        body: {
          from_currency: 'USDT',
          to_currency: 'USD',
          amount: amount
        }
      });

      if (error) {
        throw error;
      }

      this.currentQuote = data.quote;
      this.displayQuote();

    } catch (error) {
      console.error('Failed to get quote:', error);
      this.showQuoteError('Failed to get quote. Please try again.');
    }
  }

  displayQuote() {
    if (!this.currentQuote) return;

    const quotePreview = document.getElementById('quote-preview');
    const quoteStatus = document.getElementById('quote-status');
    
    // Update quote elements with safe defaults
    document.getElementById('quote-usdt-amount').textContent = `₮${this.formatMoney(this.currentQuote?.from_amount || 0, 6)}`;
    document.getElementById('quote-live-rate').textContent = `1 USDT = $${this.formatMoney(this.currentQuote?.live_rate || 0, 6)}`;
    document.getElementById('quote-markup').textContent = `+${this.conversionSettings?.fees?.markup_percentage || 0}%`;
    document.getElementById('quote-fixed-fee').textContent = `$${this.formatMoney(this.currentQuote?.fixed_fee || 0, 2)}`;
    document.getElementById('quote-variable-fee').textContent = `$${this.formatMoney(this.currentQuote?.variable_fee || 0, 2)}`;
    document.getElementById('quote-total-fees').textContent = `$${this.formatMoney(this.currentQuote?.total_fees || 0, 2)}`;
    document.getElementById('quote-usd-received').textContent = `$${this.formatMoney(this.currentQuote?.to_amount || 0, 2)}`;
    
    // Update rate breakdown with safe defaults
    const fromAmount = this.currentQuote?.from_amount || 0;
    const toAmount = this.currentQuote?.to_amount || 0;
    const finalRate = fromAmount > 0 ? toAmount / fromAmount : 0;
    document.getElementById('breakdown-live-rate').textContent = this.formatMoney(this.currentQuote?.live_rate || 0, 6);
    document.getElementById('breakdown-markup-rate').textContent = `${this.conversionSettings?.fees?.markup_percentage || 0}%`;
    document.getElementById('breakdown-final-rate').textContent = this.formatMoney(finalRate, 6);
    
    // Update status
    quoteStatus.textContent = `Live (${new Date().toLocaleTimeString()})`;
    
    quotePreview.style.display = 'block';
  }

  showQuoteError(message) {
    const quotePreview = document.getElementById('quote-preview');
    const quoteStatus = document.getElementById('quote-status');
    
    quoteStatus.textContent = 'Error';
    quoteStatus.style.background = 'rgba(239, 68, 68, 0.1)';
    quoteStatus.style.color = 'var(--error)';
    
    // Show error message instead of quote
    quotePreview.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--error);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <p>${message}</p>
      </div>
    `;
    
    quotePreview.style.display = 'block';
  }

  hideQuote() {
    const quotePreview = document.getElementById('quote-preview');
    quotePreview.style.display = 'none';
  }

  async refreshQuote() {
    const amountInput = document.getElementById('convert-amount');
    if (amountInput.value) {
      await this.updateQuote();
    }
  }

  setAmount(amount) {
    const amountInput = document.getElementById('convert-amount');
    amountInput.value = amount;
    this.updateQuote();
  }

  setMaxAmount() {
    const amountInput = document.getElementById('convert-amount');
    amountInput.value = this.userBalances.USDT.available;
    this.updateQuote();
  }

  async executeConversion() {
    const amount = parseFloat(document.getElementById('convert-amount').value);
    
    if (!amount || amount <= 0) {
      window.Notify.error('Please enter a valid amount');
      return;
    }

    // Check balance using real data structure
    const usdtBalance = Number(this.userBalances?.USDT || 0);
    if (amount > usdtBalance) {
      window.Notify.error('Insufficient USDT balance');
      return;
    }

    try {
      this.setButtonLoading('execute-convert-btn', true);

      // Use real convert_usdt_to_usd endpoint
      const { data, error } = await window.API.fetchEdge('convert_usdt_to_usd', {
        method: 'POST',
        body: {
          usdt_amount: amount
        }
      });

      if (error) {
        throw error;
      }

      // Show success message
      const usdReceived = data?.conversion?.usd_net || 0;
      window.Notify.success(`Successfully converted ₮${this.formatMoney(amount, 6)} to $${this.formatMoney(usdReceived, 2)}!`);

      // Reset form
      this.resetForm();

      // Reload data
      await this.loadUserBalances();
      await this.loadConversionHistory();
      this.updateBalanceDisplay();

    } catch (error) {
      console.error('Conversion failed:', error);
      window.Notify.error(error.message || 'Failed to execute conversion');
    } finally {
      this.setButtonLoading('execute-convert-btn', false);
    }
  }

  renderConversionHistory() {
    const historyContainer = document.querySelector('[data-list="conversion-history"]');
    if (!historyContainer) return;

    if (!this.lastConversions || this.lastConversions.length === 0) {
      window.renderEmpty(historyContainer, {
        title: 'No Conversion History',
        body: 'You haven\'t made any conversions yet. Start by converting USDT to USD.',
        actionText: 'Make First Conversion',
        onAction: () => {
          // Scroll to conversion form
          const form = document.getElementById('conversion-form');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
      return;
    }

    const historyHTML = `
      <div class="list">
        ${this.lastConversions.map(conversion => `
          <div class="list-item" data-status="${conversion?.status || 'unknown'}">
            <div class="flex justify-between items-center mb-2">
              <div class="flex items-center gap-3">
                <div>
                  <div class="font-semibold">₮${this.formatMoney(conversion?.from_amount || 0, 6)}</div>
                  <div class="text-sm text-secondary">→ $${this.formatMoney(conversion?.to_amount || 0, 2)}</div>
                </div>
                <div class="badge ${this.getStatusBadgeClass(conversion?.status)}">
                  ${conversion?.status || 'unknown'}
                </div>
              </div>
              <div class="text-sm text-secondary">
                ${this.getTimeAgo(new Date(conversion?.created_at))}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-secondary">Rate:</span>
                <span class="ml-2">${this.formatMoney(conversion?.rate || 0, 6)}</span>
              </div>
              <div>
                <span class="text-secondary">Fees:</span>
                <span class="ml-2">$${this.formatMoney(conversion?.fees || 0, 2)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    historyContainer.innerHTML = historyHTML;
  }

  getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-info';
    }
  }

  resetForm() {
    // Reset form inputs
    document.getElementById('convert-amount').value = '';
    
    // Hide quote
    this.hideQuote();
    
    // Clear current quote
    this.currentQuote = null;
  }

  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button.innerHTML = `
        <div class="loading-spinner" style="display: inline-block; margin-right: 8px;"></div>
        Processing...
      `;
    } else {
      button.disabled = false;
      button.textContent = 'Convert Now';
    }
  }

  formatMoney(amount, precision = 2) {
    let n = Number(amount);
    if (!Number.isFinite(n)) n = 0;
    
    return n.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
  }

  // Cleanup method
  destroy() {
    console.log('Convert page cleanup');
  }
}

// Initialize page controller
window.convertPage = new ConvertPage();

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConvertPage;
}
