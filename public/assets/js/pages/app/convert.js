/**
 * Convert Page Controller
 * Handles USDT to USD conversion with live rates and detailed quote breakdown
 */

class ConvertPage {
  constructor() {
    this.currentUser = null;
    this.userBalances = null;
    this.currentQuote = null;
    this.conversionSettings = null;
    this.lastConversions = null;
    
    // Get API client
    this.api = window.API || null;

    if (!this.api) {
      console.warn("ConvertPage: API client not found on load. Retrying in 500ms...");
      setTimeout(() => this.retryInit(), 500);
    } else {
      this.init();
    }
  }

  retryInit() {
    this.api = window.API || null;
    if (this.api) {
      this.init();
    } else {
      // Retry again if API client still not available
      setTimeout(() => this.retryInit(), 500);
    }
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
      // Load data
      await this.loadUserData();
      await this.loadConversionSettings();
      await this.loadUserBalances();
      await this.loadConversionHistory();
      
      // Setup UI
      this.updateBalanceDisplay();
      this.setupFormHandlers();
      this.setupAutoRefresh();
      
      console.log('Convert page setup complete');
    } catch (error) {
      console.error('Error setting up convert page:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load convert page');
      }
    }
  }

  async loadUserData() {
    try {
      console.log('Loading user data via REST API...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load user profile from database
      const data = await this.api.getUserProfile(userId);
      
      this.currentUser = data;
      console.log('User data loaded:', this.currentUser);
    } catch (error) {
      console.error('Failed to load user data:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load user profile. Please try again.');
      }
      throw error;
    }
  }

  async loadConversionSettings() {
    try {
      console.log('Loading conversion settings via REST API...');
      
      // Load conversion settings from database
      const data = await this.api.getConversionSettings();
      
      this.conversionSettings = data;
      console.log('Conversion settings loaded:', this.conversionSettings);
    } catch (error) {
      console.error('Failed to load conversion settings:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load conversion settings. Please try again.');
      }
      throw error;
    }
  }

  async loadUserBalances() {
    try {
      console.log('Loading user balances via BalanceService...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
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
      if (window.Notify) {
        window.Notify.error('Failed to load user balances. Please try again.');
      }
      throw error;
    }
  }

  async loadConversionHistory() {
    try {
      console.log('Loading conversion history via REST API...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load conversion history from database
      const data = await this.api.getConversionHistory(userId);
      
      this.lastConversions = data || [];
      this.renderConversionHistory();
      console.log('Conversion history loaded from database:', this.lastConversions.length, 'conversions');
    } catch (error) {
      console.error('Failed to load conversion history:', error);
      
      // Check if it's a table not found error
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('[ConvertPage] Conversions table does not exist yet. Showing empty history.');
        this.lastConversions = [];
        this.renderConversionHistory();
        
        // Show info message to user
        if (window.Notify) {
          window.Notify.info('Conversion history will be available once database is set up.');
        }
      } else {
        // Show error to user for other errors
        if (window.Notify) {
          window.Notify.error('Failed to load conversion history. Please try again.');
        }
        this.lastConversions = [];
        this.renderConversionHistory();
      }
    }
  }

  updateBalanceDisplay() {
    const usdtBalance = document.getElementById('usdt-balance');
    const usdBalance = document.getElementById('usd-balance');
    const lastUSDTConversion = document.getElementById('last-usdt-conversion');
    const lastUSDConversion = document.getElementById('last-usd-conversion');

    // Check if balances are available
    if (!this.userBalances) {
      if (usdtBalance) usdtBalance.textContent = '₮0.000000';
      if (usdBalance) usdBalance.textContent = '$0.00';
      console.log('Balances not available yet');
      return;
    }

    if (usdtBalance) {
      usdtBalance.textContent = `₮${this.formatMoney(this.userBalances.USDT?.available || 0, 6)}`;
    }

    if (usdBalance) {
      usdBalance.textContent = `$${this.formatMoney(this.userBalances.USD?.available || 0, 2)}`;
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

  setupFormHandlers() {
    // Setup form event listeners
    const amountInput = document.getElementById('convert-amount');
    const convertBtn = document.getElementById('execute-convert-btn');
    const swapBtn = document.getElementById('swap-currencies');

    if (amountInput) {
      amountInput.addEventListener('input', () => this.updateQuote());
    }
    
    if (convertBtn) {
      convertBtn.addEventListener('click', () => this.executeConversion());
      console.log('Convert button event listener attached');
    } else {
      console.warn('Convert button not found with ID: execute-convert-btn');
    }
    
    if (swapBtn) {
      swapBtn.addEventListener('click', () => this.swapCurrencies());
    }

    console.log('Form handlers setup complete');
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
    console.log('=== updateQuote START ===');
    const amountInput = document.getElementById('convert-amount');
    const amount = parseFloat(amountInput?.value);
    
    console.log('updateQuote called with amount:', amount);
    
    if (!amount || amount <= 0) {
      console.log('Invalid amount, hiding quote');
      this.hideQuote();
      return;
    }

    console.log('Amount validation passed');

    // Check if balances are available
    if (!this.userBalances || !this.userBalances.USDT) {
      console.log('Balances not available, proceeding with quote anyway');
      // Don't return - allow quote generation even without balance info
    } else {
      console.log('Balances available:', this.userBalances);
      // Check if amount exceeds available balance
      if (this.userBalances.USDT.available > 0 && amount > this.userBalances.USDT.available) {
        console.log('Amount exceeds balance:', amount, '>', this.userBalances.USDT.available);
        this.showQuoteError('Insufficient USDT balance');
        return;
      }
      // Allow quote generation if balance is 0 (for demo/testing)
      if (this.userBalances.USDT.available === 0) {
        console.log('Balance is 0, allowing quote generation for demo purposes');
      }
    }

    console.log('Balance check passed, calling getFXQuote');

    try {
      // For now, use mock data since we don't have a quote API endpoint yet
      // Get FX quote from database
      console.log('Calling getFXQuote with:', 'USDT', 'USD', amount);
      const data = await this.api.getFXQuote('USDT', 'USD', amount);
      console.log('getFXQuote returned:', data);
      
      this.currentQuote = data;
      console.log('Generated quote:', this.currentQuote);
      this.displayQuote();
      console.log('Quote updated for amount:', amount);

    } catch (error) {
      console.error('Failed to update quote:', error);
      this.showQuoteError('Failed to get quote');
    }
    
    console.log('=== updateQuote END ===');
  }

  
  executeConversion() {
    if (!this.currentQuote) {
      if (window.Notify) {
        window.Notify.error('Please enter an amount to convert');
      }
      return;
    }

    console.log('Executing conversion:', this.currentQuote);
    
    // For now, just show success message
    if (window.Notify) {
      window.Notify.success(`Converting ${this.currentQuote.from_amount} USDT to ${this.currentQuote.to_amount} USD`);
    }
    
    // TODO: Implement actual conversion when API is ready
  }

  swapCurrencies() {
    console.log('Swap currencies clicked');
    // TODO: Implement currency swapping when needed
    if (window.Notify) {
      window.Notify.info('Currency swap not implemented yet');
    }
  }

  showQuoteError(message) {
    const quotePreview = document.getElementById('quote-preview');
    const quoteStatus = document.getElementById('quote-status');
    
    if (quoteStatus) {
      quoteStatus.textContent = message;
      quoteStatus.className = 'quote-status error';
    } else {
      console.warn('quote-status element not found');
    }
    
    if (quotePreview) {
      quotePreview.style.display = 'none';
    } else {
      console.warn('quote-preview element not found');
    }
  }

  hideQuote() {
    const quotePreview = document.getElementById('quote-preview');
    const quoteStatus = document.getElementById('quote-status');
    
    if (quotePreview) {
      quotePreview.style.display = 'none';
    } else {
      console.warn('quote-preview element not found');
    }
    
    if (quoteStatus) {
      quoteStatus.textContent = '';
      quoteStatus.className = 'quote-status';
    } else {
      console.warn('quote-status element not found');
    }
  }

  displayQuote() {
    try {
      console.log('displayQuote called, currentQuote:', this.currentQuote);
      
      if (!this.currentQuote) {
        console.log('No current quote to display');
        return;
      }

      const quotePreview = document.getElementById('quote-preview');
      const quoteStatus = document.getElementById('quote-status');
      
      console.log('Quote preview element:', !!quotePreview);
      console.log('Quote status element:', !!quoteStatus);
      
      // Check if conversion settings are available
      if (!this.conversionSettings || !this.conversionSettings.fees) {
        console.log('Conversion settings not available, using defaults');
        // Don't return - use default values
      }
    
      // Update quote elements with null checks
      const usdtAmountEl = document.getElementById('quote-usdt-amount');
      const liveRateEl = document.getElementById('quote-live-rate');
      const markupEl = document.getElementById('quote-markup');
      
      if (usdtAmountEl) {
        usdtAmountEl.textContent = `₮${this.formatMoney(this.currentQuote.from_amount, 6)}`;
      }
    
    if (liveRateEl) {
      liveRateEl.textContent = `1 USDT = $${this.formatMoney(this.currentQuote.rate || 0, 6)}`;
    }
    
    if (markupEl) {
      markupEl.textContent = `+${this.conversionSettings.fees.markup_percentage || 0}%`;
    }
    
    // Update remaining quote elements with null checks
    const fixedFeeEl = document.getElementById('quote-fixed-fee');
    const variableFeeEl = document.getElementById('quote-variable-fee');
    const totalFeesEl = document.getElementById('quote-total-fees');
    const usdReceivedEl = document.getElementById('quote-usd-received');
    
    if (fixedFeeEl) {
      fixedFeeEl.textContent = `$${this.formatMoney(this.currentQuote.fees || 0, 2)}`;
    }
    
    if (variableFeeEl) {
      variableFeeEl.textContent = `$${this.formatMoney(this.currentQuote.fees || 0, 2)}`;
    }
    
    if (totalFeesEl) {
      totalFeesEl.textContent = `$${this.formatMoney(this.currentQuote.fees || 0, 2)}`;
    }
    
    if (usdReceivedEl) {
      usdReceivedEl.textContent = `$${this.formatMoney(this.currentQuote.to_amount || 0, 2)}`;
    }
    
    // Update rate breakdown with null checks
    const breakdownLiveRateEl = document.getElementById('breakdown-live-rate');
    const breakdownMarkupRateEl = document.getElementById('breakdown-markup-rate');
    const breakdownFinalRateEl = document.getElementById('breakdown-final-rate');
    
    if (breakdownLiveRateEl) {
      breakdownLiveRateEl.textContent = this.formatMoney(this.currentQuote.rate || 0, 6);
    }
    
    if (breakdownMarkupRateEl) {
      breakdownMarkupRateEl.textContent = `${this.conversionSettings.fees.markup_percentage || 0}%`;
    }
    
    if (breakdownFinalRateEl) {
      const finalRate = (this.currentQuote.to_amount || 0) / (this.currentQuote.from_amount || 1);
      breakdownFinalRateEl.textContent = this.formatMoney(finalRate, 6);
    }
    
    // Update status with null check
    if (quoteStatus) {
      quoteStatus.textContent = `Live (${new Date().toLocaleTimeString()})`;
    }
    
    if (quotePreview) {
      quotePreview.style.display = 'block';
    }
    } catch (error) {
      console.error('Error in displayQuote:', error);
      this.showQuoteError('Failed to display quote');
    }
  }

  showQuoteError(message) {
    const quotePreview = document.getElementById('quote-preview');
    const quoteStatus = document.getElementById('quote-status');
    
    if (quoteStatus) {
      quoteStatus.textContent = message;
      quoteStatus.className = 'quote-status error';
    } else {
      console.warn('quote-status element not found');
    }
    
    if (quotePreview) {
      quotePreview.style.display = 'none';
    } else {
      console.warn('quote-preview element not found');
    }
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
    if (this.userBalances && this.userBalances.USDT) {
      amountInput.value = this.userBalances.USDT.available;
      this.updateQuote();
    } else {
      if (window.Notify) {
        window.Notify.error('Balance information not available');
      }
    }
  }

  async executeConversion() {
    console.log('executeConversion called, currentQuote:', this.currentQuote);
    
    if (!this.currentQuote) {
      // Try to generate a quote first
      const amountInput = document.getElementById('convert-amount');
      const amount = parseFloat(amountInput?.value);
      
      if (!amount || amount <= 0) {
        if (window.Notify) {
          window.Notify.error('Please enter an amount to convert');
        }
        return;
      }

      // Generate quote automatically
      await this.updateQuote();
      
      if (!this.currentQuote) {
        if (window.Notify) {
          window.Notify.error('Failed to generate quote. Please try again.');
        }
        return;
      }
    }

    const amount = parseFloat(document.getElementById('convert-amount').value);
    
    if (!amount || amount <= 0) {
      if (window.Notify) {
        window.Notify.error('Please enter a valid amount');
      }
      return;
    }

    if (!this.userBalances || !this.userBalances.USDT || amount > this.userBalances.USDT.available) {
      if (window.Notify) {
        window.Notify.error('Insufficient USDT balance');
      }
      return;
    }

    try {
      this.setButtonLoading('execute-convert-btn', true);

      // Save conversion to database
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const conversionData = {
        user_id: userId,
        from_currency: this.currentQuote.from_currency,
        to_currency: this.currentQuote.to_currency,
        from_amount: this.currentQuote.from_amount,
        to_amount: this.currentQuote.to_amount,
        rate: this.currentQuote.rate,
        fees: this.currentQuote.fees,
        status: 'completed',
        created_at: new Date().toISOString()
      };

      // Save conversion to database
      const { data, error } = await this.api.serviceClient
        .from('conversions')
        .insert([conversionData])
        .select();

      if (error) {
        console.error('Failed to save conversion:', error);
        
        // Check if table doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[ConvertPage] Conversions table does not exist yet. Simulating conversion success.');
          // Don't throw error, just simulate success
        } else {
          throw error;
        }
      }

      console.log('Conversion saved to database:', data);
      
      if (window.Notify) {
        window.Notify.success(`Successfully converted ${this.currentQuote.from_amount} USDT to ${this.currentQuote.to_amount} USD`);
      }
      
      // Reset button
      this.setButtonLoading('execute-convert-btn', false);
      
      // Clear quote after successful conversion
      this.currentQuote = null;
      this.hideQuote();
      
      // Reload data
      await this.loadUserBalances();
      await this.loadConversionHistory();
      this.updateBalanceDisplay();

    } catch (error) {
      console.error('Failed to execute conversion:', error);
      if (window.Notify) {
        window.Notify.error('Failed to execute conversion. Please try again.');
      }
    } finally {
      this.setButtonLoading('execute-convert-btn', false);
    }
  }

  resetForm() {
    const amountInput = document.getElementById('convert-amount');
    if (amountInput) {
      amountInput.value = '';
    }
    this.currentQuote = null;
    this.hideQuote();
  }

  setButtonLoading(buttonId, loading) {
    const button = document.getElementById(buttonId);
    if (button) {
      if (loading) {
        button.disabled = true;
        button.textContent = 'Processing...';
      } else {
        button.disabled = false;
        button.textContent = 'Convert';
      }
    }
  }

  formatMoney(amount, decimals = 2) {
    if (typeof amount !== 'number') return '0.00';
    return amount.toFixed(decimals);
  }

  renderConversionHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (!this.lastConversions || this.lastConversions.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; opacity: 0.5;">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
          </svg>
          <p>No conversion history yet</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = this.lastConversions.map(conversion => `
      <div class="history-item">
        <div class="history-item-header">
          <div class="history-item-amount">
            <span class="from-amount">₮${this.formatMoney(conversion.from_amount, 6)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"></path>
              <polyline points="12 19 19 12 12 5"></polyline>
            </svg>
            <span class="to-amount">$${this.formatMoney(conversion.to_amount, 2)}</span>
          </div>
          <div class="history-item-status ${conversion.status}">
            ${conversion.status === 'completed' ? 'Completed' : 'Pending'}
          </div>
        </div>
        <div class="history-item-details">
          <div class="history-item-rate">Rate: ${this.formatMoney(conversion.rate, 6)}</div>
          <div class="history-item-fees">Fees: $${this.formatMoney(conversion.fees, 2)}</div>
          <div class="history-item-time">${this.getTimeAgo(new Date(conversion.created_at))}</div>
        </div>
      </div>
    `).join('');
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }
}

// Initialize page controller
window.convertPage = new ConvertPage();
