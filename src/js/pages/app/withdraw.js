/**
 * Withdraw Page Controller
 * Handles withdrawal requests, method management, and validation
 */

// Import shared app initializer
import '/public/assets/js/_shared/app_init.js';

class WithdrawPage {
  constructor() {
    this.currentUser = null;
    this.userBalances = null;
    this.withdrawalSettings = null;
    this.userMethods = null;
    this.selectedCurrency = null;
    this.selectedMethod = null;
    this.dailyLimits = null;
    this.init();
  }

  async init() {
    console.log('Withdrawals page initializing...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }

  async setupPage() {
    try {
      // Load app shell components
      this.loadAppShell();
      
      // Load data
      await this.loadUserData();
      await this.loadWithdrawalSettings();
      await this.loadUserBalances();
      await this.loadUserMethods();
      await this.loadDailyLimits();
      await this.loadWithdrawalRequests();
      
      // Setup UI
      this.setupKYCStatus();
      this.updateBalanceDisplay();
      this.setupCurrencyOptions();
      
      console.log('Withdrawals page setup complete');
    } catch (error) {
      console.error('Error setting up withdrawals page:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load withdrawal options');
      }
    }
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

  async loadWithdrawalSettings() {
    try {
      const { data, error } = await window.API.fetchEdge('withdrawal_settings', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      // Use real settings or minimal fallback
      this.withdrawalSettings = {
        withdrawal_fee_pct: data.withdrawal_fee_pct || 0,
        withdrawal_daily_cap_usd: data.withdrawal_daily_cap_usd || 10000,
        withdrawal_daily_cap_usdt: data.withdrawal_daily_cap_usdt || 10000
      };
    } catch (error) {
      console.error('Failed to load withdrawal settings:', error);
      // Minimal fallback
      this.withdrawalSettings = {
        withdrawal_fee_pct: 0,
        withdrawal_daily_cap_usd: 10000,
        withdrawal_daily_cap_usdt: 10000
      };
    }
  }


  async loadUserBalances() {
    try {
      console.log('Loading user balances via BalanceService...');
      
      const userId = await window.API.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Use BalanceService to fetch balances from database
      if (window.BalanceService) {
        const balanceData = await window.BalanceService.getUserBalances(userId);
        
        // Transform BalanceService format to the format expected by withdraw page
        this.userBalances = balanceData.balances || {};
        console.log('User balances loaded:', this.userBalances);
      } else {
        console.warn('BalanceService not available, using fallback');
        this.userBalances = await window.API.fetchBalances();
      }
    } catch (error) {
      console.error('Failed to load user balances:', error);
      // Fallback to API fetchBalances
      try {
        this.userBalances = await window.API.fetchBalances();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        this.userBalances = null;
      }
    }
  }

  async loadUserMethods() {
    try {
      const { data, error } = await window.API.fetchEdge('user_withdrawal_methods', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      this.userMethods = data.methods || {};
    } catch (error) {
      console.error('Failed to load user methods:', error);
      this.userMethods = {};
    }
  }

  async loadDailyLimits() {
    try {
      const { data, error } = await window.API.fetchEdge('withdrawal_limits_check', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      this.dailyLimits = data.limits || null;
    } catch (error) {
      console.error('Failed to load daily limits:', error);
      this.dailyLimits = null;
    }
  }


  async loadWithdrawalRequests() {
    try {
      const { data, error } = await window.API.fetchEdge('withdraw_list', {
        method: 'GET'
      });

      if (error) {
        throw error;
      }

      this.renderWithdrawalRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load withdrawal requests:', error);
      this.renderWithdrawalRequests([]);
    }
  }

  setupKYCStatus() {
    const kycBanner = document.getElementById('kyc-banner');
    const kycTitle = document.getElementById('kyc-title');
    const kycDescription = document.getElementById('kyc-description');
    const kycAction = document.getElementById('kyc-action');

    if (!this.currentUser.profile) {
      // Show KYC required
      kycBanner.style.display = 'flex';
      kycBanner.className = 'kyc-banner error';
      kycTitle.textContent = 'KYC Verification Required';
      kycDescription.textContent = 'Complete KYC verification to enable withdrawals';
      kycAction.textContent = 'Complete KYC';
      return;
    }

    const profile = this.currentUser.profile;
    const kycApproved = profile.kyc_status === 'approved';
    const emailVerified = profile.email_verified;

    if (!kycApproved || !emailVerified) {
      kycBanner.style.display = 'flex';
      
      if (!kycApproved && !emailVerified) {
        kycBanner.className = 'kyc-banner error';
        kycTitle.textContent = 'KYC & Email Verification Required';
        kycDescription.textContent = 'Complete KYC verification and verify your email to enable withdrawals';
        kycAction.textContent = 'Complete Verification';
      } else if (!kycApproved) {
        kycBanner.className = 'kyc-banner error';
        kycTitle.textContent = 'KYC Verification Required';
        kycDescription.textContent = 'Your KYC verification is pending approval';
        kycAction.textContent = 'Check Status';
      } else if (!emailVerified) {
        kycBanner.className = 'kyc-banner error';
        kycTitle.textContent = 'Email Verification Required';
        kycDescription.textContent = 'Please verify your email address to enable withdrawals';
        kycAction.textContent = 'Verify Email';
      }
    } else {
      kycBanner.style.display = 'none';
    }
  }

  updateBalanceDisplay() {
    const availableUSD = document.getElementById('available-usd');
    const availableUSDT = document.getElementById('available-usdt');
    const dailyUsed = document.getElementById('daily-used');
    const usdStatus = document.getElementById('usd-status');
    const usdtStatus = document.getElementById('usdt-status');
    const limitsStatus = document.getElementById('limits-status');

    // Handle missing balance data gracefully
    if (!this.userBalances) {
      if (availableUSD) availableUSD.textContent = 'Balance unavailable';
      if (availableUSDT) availableUSDT.textContent = 'Balance unavailable';
      if (usdStatus) {
        usdStatus.textContent = 'Balance unavailable';
        usdStatus.className = 'balance-status error';
      }
      if (usdtStatus) {
        usdtStatus.textContent = 'Balance unavailable';
        usdtStatus.className = 'balance-status error';
      }
      if (limitsStatus) {
        limitsStatus.textContent = 'Limits unavailable';
        limitsStatus.className = 'limits-status error';
      }
      return;
    }

    if (availableUSD) {
      availableUSD.textContent = `$${this.formatMoney(this.userBalances.USD.available)}`;
    }

    if (availableUSDT) {
      availableUSDT.textContent = `₮${this.formatMoney(this.userBalances.USDT.available, 6)}`;
    }

    if (dailyUsed) {
      if (!this.dailyLimits) {
        dailyUsed.textContent = 'Limits unavailable';
        dailyUsed.style.color = 'var(--error-color)';
      } else {
        const totalUsed = this.dailyLimits.USD.used + this.dailyLimits.USDT.used;
        dailyUsed.textContent = `$${this.formatMoney(totalUsed)}`;
      }
    }

    // Update status indicators
    const hasActivePositions = this.userBalances.USD.locked > 0 || this.userBalances.USDT.locked > 0;
    
    if (usdStatus) {
      if (hasActivePositions) {
        usdStatus.textContent = 'Locked (Active Positions)';
        usdStatus.className = 'balance-status locked';
      } else {
        usdStatus.textContent = 'Available';
        usdStatus.className = 'balance-status available';
      }
    }

    if (usdtStatus) {
      if (hasActivePositions) {
        usdtStatus.textContent = 'Locked (Active Positions)';
        usdtStatus.className = 'balance-status locked';
      } else {
        usdtStatus.textContent = 'Available';
        usdtStatus.className = 'balance-status available';
      }
    }

    if (limitsStatus) {
      const totalLimit = this.withdrawalSettings.currencies.USD.daily_limit + this.withdrawalSettings.currencies.USDT.daily_limit;
      const totalUsed = this.dailyLimits.USD.used + this.dailyLimits.USDT.used;
      
      if (totalUsed >= totalLimit) {
        limitsStatus.textContent = 'Daily Limit Reached';
        limitsStatus.className = 'balance-status locked';
      } else {
        limitsStatus.textContent = 'Within Limits';
        limitsStatus.className = 'balance-status available';
      }
    }
  }

  setupCurrencyOptions() {
    const currencySelect = document.getElementById('currency-select');
    if (!currencySelect) return;

    // Check if withdrawals are blocked due to active positions
    const hasActivePositions = this.userBalances.USD.locked > 0 || this.userBalances.USDT.locked > 0;
    
    if (hasActivePositions) {
      // Disable all currencies if there are active positions
      currencySelect.innerHTML = '<option value="">Withdrawals Blocked - Active Positions</option>';
      currencySelect.disabled = true;
      return;
    }

    // Enable currency selection
    currencySelect.disabled = false;
    currencySelect.innerHTML = '<option value="">Select Currency</option>';
    
    Object.keys(this.withdrawalSettings.currencies).forEach(currency => {
      const balance = this.userBalances[currency];
      if (balance && balance.available > 0) {
        const option = document.createElement('option');
        option.value = currency;
        option.textContent = `${currency} (Available: ${currency === 'USD' ? '$' : '₮'}${this.formatMoney(balance.available, currency === 'USDT' ? 6 : 2)})`;
        currencySelect.appendChild(option);
      }
    });
  }

  handleCurrencyChange() {
    const currencySelect = document.getElementById('currency-select');
    const methodSelect = document.getElementById('method-select');
    const amountInput = document.getElementById('amount-input');
    const amountCurrency = document.getElementById('amount-currency');

    this.selectedCurrency = currencySelect.value;
    
    if (!this.selectedCurrency) {
      methodSelect.innerHTML = '<option value="">Select Currency First</option>';
      methodSelect.disabled = true;
      amountInput.disabled = true;
      return;
    }

    // Update currency symbol
    amountCurrency.textContent = this.selectedCurrency === 'USD' ? '$' : '₮';
    
    // Setup method options
    this.setupMethodOptions();
    
    // Enable amount input
    amountInput.disabled = false;
    
    // Set minimum amount
    const settings = this.withdrawalSettings.currencies[this.selectedCurrency];
    amountInput.min = settings.min_amount;
    amountInput.placeholder = `${settings.min_amount.toFixed(2)} minimum`;
  }

  setupMethodOptions() {
    const methodSelect = document.getElementById('method-select');
    if (!methodSelect || !this.selectedCurrency) return;

    methodSelect.innerHTML = '<option value="">Select Method</option>';
    methodSelect.disabled = false;

    Object.keys(this.withdrawalSettings.methods).forEach(methodKey => {
      const method = this.withdrawalSettings.methods[methodKey];
      const option = document.createElement('option');
      option.value = methodKey;
      option.textContent = method.name;
      methodSelect.appendChild(option);
    });
  }

  handleMethodChange() {
    const methodSelect = document.getElementById('method-select');
    const methodDetails = document.getElementById('method-details');

    this.selectedMethod = methodSelect.value;
    
    if (!this.selectedMethod) {
      methodDetails.style.display = 'none';
      return;
    }

    this.updateMethodDetails();
  }

  updateMethodDetails() {
    const methodDetails = document.getElementById('method-details');
    const methodDetailsContent = document.getElementById('method-details-content');
    
    if (!this.selectedMethod || !this.selectedCurrency) {
      methodDetails.style.display = 'none';
      return;
    }

    const methodKey = `${this.selectedCurrency}_${this.selectedMethod}`;
    const userMethod = this.userMethods[methodKey];

    if (userMethod) {
      // Show existing method details
      const method = this.withdrawalSettings.methods[this.selectedMethod];
      methodDetailsContent.innerHTML = method.fields.map(field => `
        <div class="method-detail-item">
          <span class="method-detail-label">${field.label}:</span>
          <span class="method-detail-value">${userMethod[field.key] || 'Not set'}</span>
        </div>
      `).join('');
      
      methodDetails.style.display = 'block';
    } else {
      // Show prompt to add details
      methodDetailsContent.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; opacity: 0.5;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <p>No withdrawal method details found</p>
          <p style="font-size: 14px; margin-top: 8px;">Click "Edit Details" to add your withdrawal information</p>
        </div>
      `;
      
      methodDetails.style.display = 'block';
    }
  }

  updateFeePreview() {
    const amountInput = document.getElementById('amount-input');
    const feePreview = document.getElementById('fee-preview');
    
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0 || !this.selectedCurrency) {
      feePreview.style.display = 'none';
      return;
    }

    const settings = this.withdrawalSettings.currencies[this.selectedCurrency];
    const feeAmount = amount * (settings.fee_percentage / 100);
    const netAmount = amount - feeAmount;
    
    document.getElementById('withdrawal-amount').textContent = `${this.selectedCurrency === 'USD' ? '$' : '₮'}${this.formatMoney(amount, this.selectedCurrency === 'USDT' ? 6 : 2)}`;
    document.getElementById('fee-percentage').textContent = settings.fee_percentage;
    document.getElementById('fee-amount').textContent = `${this.selectedCurrency === 'USD' ? '$' : '₮'}${this.formatMoney(feeAmount, this.selectedCurrency === 'USDT' ? 6 : 2)}`;
    document.getElementById('net-amount').textContent = `${this.selectedCurrency === 'USD' ? '$' : '₮'}${this.formatMoney(netAmount, this.selectedCurrency === 'USDT' ? 6 : 2)}`;
    
    feePreview.style.display = 'block';
  }

  openMethodModal() {
    if (!this.selectedMethod || !this.selectedCurrency) return;

    const modal = document.getElementById('method-modal');
    const methodForm = document.getElementById('method-form');
    
    const method = this.withdrawalSettings.methods[this.selectedMethod];
    const methodKey = `${this.selectedCurrency}_${this.selectedMethod}`;
    const userMethod = this.userMethods[methodKey] || {};

    methodForm.innerHTML = method.fields.map(field => `
      <div class="method-form-group">
        <label class="method-form-label">${field.label} ${field.required ? '*' : ''}</label>
        <input type="${field.type}" class="method-form-input" id="method-${field.key}" 
               value="${userMethod[field.key] || ''}" 
               placeholder="Enter ${field.label.toLowerCase()}"
               ${field.required ? 'required' : ''}>
      </div>
    `).join('');

    modal.style.display = 'flex';
  }

  closeMethodModal() {
    const modal = document.getElementById('method-modal');
    modal.style.display = 'none';
  }

  async saveMethodDetails() {
    if (!this.selectedMethod || !this.selectedCurrency) return;

    const method = this.withdrawalSettings.methods[this.selectedMethod];
    const methodData = {};

    // Collect form data
    for (const field of method.fields) {
      const input = document.getElementById(`method-${field.key}`);
      if (field.required && !input.value.trim()) {
        window.Notify.error(`${field.label} is required`);
        return;
      }
      methodData[field.key] = input.value.trim();
    }

    try {
      this.setButtonLoading('save-method-btn', true);

      const { data, error } = await window.API.fetchEdge('user_withdrawal_methods_update', {
        method: 'POST',
        body: {
          currency: this.selectedCurrency,
          method: this.selectedMethod,
          details: methodData
        }
      });

      if (error) {
        throw error;
      }

      // Update local data
      const methodKey = `${this.selectedCurrency}_${this.selectedMethod}`;
      this.userMethods[methodKey] = methodData;

      // Update UI
      this.updateMethodDetails();
      this.closeMethodModal();

      window.Notify.success('Withdrawal method details saved successfully!');

    } catch (error) {
      console.error('Failed to save method details:', error);
      window.Notify.error(error.message || 'Failed to save method details');
    } finally {
      this.setButtonLoading('save-method-btn', false);
    }
  }

  async submitWithdrawal() {
    if (!this.validateWithdrawal()) return;

    const amount = parseFloat(document.getElementById('amount-input').value);
    
    // Hard guard: ensure method_id is a UUID string
    const methodId = this.selectedMethod;
    if (!methodId || !this.isValidUUID(methodId)) {
      window.Notify.error('Invalid withdrawal method selected');
      return;
    }
    
    try {
      this.setButtonLoading('submit-withdrawal', true);

      // Use real withdraw_create_request endpoint with validated UUID
      const { data, error } = await window.API.fetchEdge('withdraw_create_request', {
        method: 'POST',
        body: {
          currency: this.selectedCurrency,
          amount: amount,
          method_id: methodId
        }
      });

      if (error) {
        throw error;
      }

      window.Notify.success('Withdrawal request submitted successfully! Your request will be reviewed by our team.');

      // Reset form
      this.resetForm();

      // Reload data
      await this.loadUserBalances();
      await this.loadWithdrawalRequests();

    } catch (error) {
      console.error('Failed to submit withdrawal:', error);
      window.Notify.error(error.detail || error.message || 'Failed to submit withdrawal request');
    } finally {
      this.setButtonLoading('submit-withdrawal', false);
    }
  }

  isValidUUID(uuid) {
    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  validateWithdrawal() {
    // Check KYC and email verification
    if (!this.currentUser.profile) {
      window.Notify.error('KYC verification required');
      return false;
    }

    const profile = this.currentUser.profile;
    if (profile.kyc_status !== 'approved' || !profile.email_verified) {
      window.Notify.error('KYC approval and email verification required');
      return false;
    }

    // Check for active positions
    const hasActivePositions = this.userBalances.USD.locked > 0 || this.userBalances.USDT.locked > 0;
    if (hasActivePositions) {
      window.Notify.error('Withdrawals are blocked while you have active positions');
      return false;
    }

    // Validate currency selection
    if (!this.selectedCurrency) {
      window.Notify.error('Please select a currency');
      return false;
    }

    // Validate method selection
    if (!this.selectedMethod) {
      window.Notify.error('Please select a withdrawal method');
      return false;
    }

    // Validate method details
    const methodKey = `${this.selectedCurrency}_${this.selectedMethod}`;
    const methodDetails = this.userMethods[methodKey];
    if (!methodDetails) {
      window.Notify.error('Please add withdrawal method details');
      return false;
    }

    // Validate amount
    const amountInput = document.getElementById('amount-input');
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
      window.Notify.error('Please enter a valid amount');
      return false;
    }

    // Check minimum amount
    const settings = this.withdrawalSettings.currencies[this.selectedCurrency];
    if (amount < settings.min_amount) {
      window.Notify.error(`Minimum withdrawal amount is ${this.selectedCurrency} ${settings.min_amount}`);
      return false;
    }

    // Check available balance
    const availableBalance = this.userBalances[this.selectedCurrency].available;
    if (amount > availableBalance) {
      window.Notify.error('Insufficient available balance');
      return false;
    }

    // Check daily limits
    const dailyLimit = this.dailyLimits[this.selectedCurrency];
    if (dailyLimit.used + amount > dailyLimit.limit) {
      window.Notify.error(`Daily withdrawal limit exceeded. You can withdraw ${this.selectedCurrency} ${dailyLimit.remaining} more today.`);
      return false;
    }

    return true;
  }

  renderWithdrawalRequests(requests) {
    const requestsList = document.getElementById('requests-list');
    if (!requestsList) return;

    if (requests.length === 0) {
      requestsList.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; opacity: 0.5;">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
          </svg>
          <p>No withdrawal requests found</p>
        </div>
      `;
      return;
    }

    requestsList.innerHTML = requests.map(request => `
      <div class="request-item">
        <div class="request-header">
          <div class="request-info">
            <div class="request-id">${request.id}</div>
            <div class="request-amount">
              ${request.currency === 'USD' ? '$' : '₮'}${this.formatMoney(request.amount, request.currency === 'USDT' ? 6 : 2)}
            </div>
            <div class="request-method">${this.getMethodDisplayName(request.method)}</div>
          </div>
          <div class="request-status status-${request.status}">${request.status}</div>
        </div>
        <div class="request-details">
          <div class="request-detail">
            <span class="request-detail-label">Created:</span>
            <span class="request-detail-value">${new Date(request.created_at).toLocaleDateString()}</span>
          </div>
          <div class="request-detail">
            <span class="request-detail-label">Fee:</span>
            <span class="request-detail-value">${request.currency === 'USD' ? '$' : '₮'}${this.formatMoney(request.fee, request.currency === 'USDT' ? 6 : 2)}</span>
          </div>
          <div class="request-detail">
            <span class="request-detail-label">Net Amount:</span>
            <span class="request-detail-value">${request.currency === 'USD' ? '$' : '₮'}${this.formatMoney(request.net_amount, request.currency === 'USDT' ? 6 : 2)}</span>
          </div>
          <div class="request-detail">
            <span class="request-detail-label">Updated:</span>
            <span class="request-detail-value">${new Date(request.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  getMethodDisplayName(methodKey) {
    const method = this.withdrawalSettings.methods[methodKey];
    return method ? method.name : methodKey;
  }

  handleKYCAction() {
    // Redirect to KYC verification or settings page
    window.location.href = '/app/settings.html#kyc';
  }

  resetForm() {
    // Reset form inputs
    document.getElementById('currency-select').value = '';
    document.getElementById('method-select').value = '';
    document.getElementById('amount-input').value = '';
    
    // Hide method details and fee preview
    document.getElementById('method-details').style.display = 'none';
    document.getElementById('fee-preview').style.display = 'none';
    
    // Reset selections
    this.selectedCurrency = null;
    this.selectedMethod = null;
    
    // Reset currency options
    this.setupCurrencyOptions();
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
      button.textContent = button.textContent.replace('Processing...', 'Submit Withdrawal');
    }
  }

  formatMoney(amount, precision = 2) {
    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
  }

  // Cleanup method
  destroy() {
    console.log('Withdrawals page cleanup');
  }
}

// Initialize page controller
window.withdrawPage = new WithdrawPage();

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WithdrawPage;
}
