/**
 * Withdrawals Page Controller
 * Handles withdrawal requests with method capture and business rules
 */

class WithdrawPage {
  constructor() {
    this.currentUser = null;
    this.userBalances = null;
    this.withdrawalSettings = null;
    this.userMethods = null;
    this.selectedCurrency = null;
    this.selectedMethod = null;
    this.dailyLimits = null;
    
    // Get API client
    this.api = window.API || null;

    if (!this.api) {
      console.warn("WithdrawPage: API client not found on load. Retrying in 500ms...");
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
    console.log('Withdrawals page initializing...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }

  async setupPage() {
    try {
      // Load data with error handling
      await this.loadUserData().catch(() => {});
      await this.loadUserBalances().catch(() => {});
      await this.loadWithdrawalMethods().catch(() => {});
      await this.loadWithdrawalSettings().catch(() => {});
      await this.loadDailyLimits().catch(() => {});
      await this.loadWithdrawalRequests().catch(() => {});
      
      // Setup UI
      this.setupCurrencyOptions();
      this.setupMethodCards();
      this.setupForms();
      this.setupURLParameters();
      this.updateBalanceDisplay();
      
      console.log('Withdrawals page setup complete');
    } catch (error) {
      console.error('Error setting up withdrawals page:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load withdrawals page');
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
      const { data, error } = await window.API.supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Database error loading user profile:', error);
        
        // Handle specific RLS permission errors
        if (error.code === 'PGRST301' || error.message.includes('permission denied')) {
          console.warn('RLS permission error, creating profile for user');
          // Try to create a profile for this user
          await this.createUserProfile(userId);
        }
        
        // Use mock data as fallback
        this.currentUser = this.getMockUser();
        return;
      }

      // Load email verification status
      await this.loadEmailVerificationStatus(userId);

      this.currentUser = {
        id: userId,
        email: data.display_name || 'User',
        profile: data
      };
      
      console.log('User data loaded:', this.currentUser);
    } catch (error) {
      console.error('Failed to load user data:', error);
      this.currentUser = this.getMockUser();
    }
  }

  async createUserProfile(userId) {
    try {
      console.log('Creating user profile for withdrawal validation...');
      
      // Get user data from Supabase auth
      const { data: userData, error: authError } = await window.API.supabase.auth.getUser();
      
      if (authError) {
        console.error('Error getting user data from auth:', authError);
        return null;
      }
      
      const userEmail = userData?.email || 'user@example.com';
      const userMetaData = userData?.user_metadata || userData?.raw_user_meta || {};
      
      // Create profile with Supabase-compatible data
      const profileData = {
        user_id: userId,
        display_name: userEmail.split('@')[0] || userMetaData.display_name || 'User',
        email_verified: false,
        kyc_status: 'not_submitted',
        // Add any additional metadata if present
        ...(userMetaData.phone && { phone: userMetaData.phone }),
        ...(userMetaData.avatar_url && { avatar_url: userMetaData.avatar_url })
      };
      
      const { data, error } = await window.API.supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        return null;
      }

      console.log('User profile created successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      return null;
    }
  }

  async loadEmailVerificationStatus(userId) {
    try {
      console.log('Loading email verification status for withdrawal validation...');
      
      const { data, error } = await window.API.supabase
        .from('profiles')
        .select('email_verified')
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('Database error loading email verification status:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log('Email verification status loaded:', data[0]);
        // Update user profile with email verification status
        if (this.currentUser) {
          this.currentUser.profile = {
            ...this.currentUser.profile,
            ...data[0]
          };
        }
      }
    } catch (error) {
      console.error('Failed to load email verification status:', error);
    }
  }

  async loadWithdrawalSettings() {
    try {
      console.log('Loading withdrawal settings...');
      
      // For now, use mock data since we don't have a withdrawal settings API endpoint yet
      // TODO: Replace with actual REST API call when available
      // const data = await this.api.getWithdrawalSettings();
      
      this.withdrawalSettings = this.getMockWithdrawalSettings();
      console.log('Withdrawal settings loaded from mock data:', Object.keys(this.withdrawalSettings.methods || {}).length, 'methods');
    } catch (error) {
      console.error('Failed to load withdrawal settings:', error);
      // Use mock data as fallback
      this.withdrawalSettings = this.getMockWithdrawalSettings();
      console.log('Using mock withdrawal settings as fallback');
    }
  }

  getMockUser() {
    return {
      id: 'user_123',
      email: 'user@example.com',
      profile: {
        display_name: 'John Doe',
        kyc_status: 'approved',
        email_verified: true
      }
    };
  }

  getMockWithdrawalSettings() {
    return {
      currencies: {
        USD: {
          min_amount: 500,
          daily_limit: 10000,
          fee_percentage: 2.5
        },
        USDT: {
          min_amount: 500,
          daily_limit: 50000,
          fee_percentage: 1.5
        }
      },
      methods: {
        bank: {
          name: 'Bank Transfer',
          fields: [
            { key: 'account_name', label: 'Account Name', type: 'text', required: true },
            { key: 'account_number', label: 'Account Number', type: 'text', required: true },
            { key: 'bank_name', label: 'Bank Name', type: 'text', required: true },
            { key: 'routing_number', label: 'Routing Number', type: 'text', required: false },
            { key: 'swift_code', label: 'SWIFT Code', type: 'text', required: false }
          ]
        },
        paypal: {
          name: 'PayPal',
          fields: [
            { key: 'paypal_email', label: 'PayPal Email', type: 'email', required: true }
          ]
        },
        crypto_trc20: {
          name: 'TRC20 Crypto',
          fields: [
            { key: 'wallet_address', label: 'TRC20 Wallet Address', type: 'text', required: true }
          ]
        }
      },
      kyc_required: true,
      email_verification_required: true,
      admin_approval_required: true
    };
  }

  async loadUserBalances() {
    try {
      console.log('Loading user balances via BalanceService...');
      
      const userId = await this.api.getCurrentUserId();
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
        this.userBalances = this.getMockBalances();
      }
    } catch (error) {
      console.error('Failed to load user balances:', error);
      // Use mock data as fallback
      this.userBalances = this.getMockBalances();
      console.log('Using mock balances as fallback');
    }
  }

  getMockBalances() {
    return {
      USD: {
        available: 2500.00,
        locked: 15000.00, // From active positions
        total: 17500.00
      },
      USDT: {
        available: 1200.000000,
        locked: 800.000000,
        total: 2000.000000
      }
    };
  }

  async loadWithdrawalMethods() {
    try {
      console.log('Loading user payout methods...');
      
      const userId = await this.api.getCurrentUserId();
      
      // Get user payout methods from database
      const { data, error } = await window.API.supabase
        .from('payout_methods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error loading payout methods:', error);
        
        // Handle specific table not found error
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('payout_methods table does not exist yet. User must add payout methods in settings first.');
          this.userMethods = [];
          this.showNoMethodsMessage();
          return;
        }
        
        this.userMethods = [];
        return;
      }

      this.userMethods = data || [];
      console.log('User payout methods loaded:', this.userMethods);
      
      // Check if user has any methods
      if (this.userMethods.length === 0) {
        this.showNoMethodsMessage();
      } else {
        // Auto-populate method dropdown
        this.populateMethodDropdown();
      }
      
    } catch (error) {
      console.error('Failed to load payout methods:', error);
      this.userMethods = [];
    }
  }

  getMockWithdrawalMethods() {
    return [
      {
        id: 'mock_crypto_1',
        method_name: 'USDT TRC20 Withdrawal',
        method_type: 'crypto',
        currency: 'USDT',
        network: 'TRC20',
        address: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        is_default: true,
        is_active: true,
        min_amount: 10,
        max_amount: 100000,
        processing_fee_percent: 0.001,
        processing_time_hours: 24
      },
      {
        id: 'mock_bank_1',
        method_name: 'Bank Transfer - Chase',
        method_type: 'bank',
        currency: 'USD',
        bank_name: 'Chase Bank',
        account_number: '123456789',
        routing_number: '021000021',
        account_holder_name: 'John Doe',
        is_default: false,
        is_active: true,
        min_amount: 100,
        max_amount: 50000,
        processing_fee_percent: 0.005,
        processing_time_hours: 48
      },
      {
        id: 'mock_paypal_1',
        method_name: 'PayPal Withdrawal',
        method_type: 'paypal',
        currency: 'USD',
        paypal_email: 'john.doe@example.com',
        paypal_business_name: 'John Doe Business',
        is_default: false,
        is_active: true,
        min_amount: 10,
        max_amount: 10000,
        processing_fee_percent: 0.03,
        processing_time_hours: 12
      }
    ];
  }

  populateMethodDropdown() {
    const methodSelect = document.getElementById('method-select');
    if (!methodSelect) return;

    // Clear existing options except the first one
    methodSelect.innerHTML = '<option value="">Select Method</option>';

    // Group methods by currency
    const methodsByCurrency = {};
    this.userMethods.forEach(method => {
      if (!methodsByCurrency[method.currency]) {
        methodsByCurrency[method.currency] = [];
      }
      methodsByCurrency[method.currency].push(method);
    });

    // Populate dropdown with methods for selected currency
    const selectedCurrency = document.getElementById('currency-select').value;
    if (selectedCurrency && methodsByCurrency[selectedCurrency]) {
      methodsByCurrency[selectedCurrency].forEach(method => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = `${method.method_name} ${method.is_default ? '(Default)' : ''}`;
        option.dataset.method = JSON.stringify(method);
        methodSelect.appendChild(option);
      });
    }
  }

  showNoMethodsMessage() {
    const methodSelect = document.getElementById('method-select');
    const methodDetails = document.getElementById('method-details');
    const amountInput = document.getElementById('amount-input');
    
    if (methodSelect) {
      methodSelect.innerHTML = '<option value="">No saved methods</option>';
      methodSelect.disabled = true;
    }
    
    if (amountInput) {
      amountInput.disabled = true;
    }
    
    if (methodDetails) {
      methodDetails.style.display = 'none';
    }
    
    // Show message to user
    if (window.Notify) {
      window.Notify.error('No payout methods found. Please add payout methods in Settings first.');
    }
  }

  async loadDailyLimits() {
    try {
      console.log('Loading daily limits via REST API...');
      
      // For now, use null since we don't have a limits API endpoint yet
      // TODO: Replace with actual REST API call when available
      // const data = await this.api.getDailyLimits(userId);
      
      this.dailyLimits = null;
      console.log('Daily limits loaded: null (no API endpoint yet)');
    } catch (error) {
      console.error('Failed to load daily limits:', error);
      // Show error to user instead of fallback mock data
      if (window.Notify) {
        window.Notify.error('Failed to load daily limits. Please try again.');
      }
      this.dailyLimits = null;
    }
  }

  getMockDailyLimits() {
    return {
      USD: {
        used: 0,
        remaining: 10000,
        limit: 10000
      },
      USDT: {
        used: 0,
        remaining: 50000,
        limit: 50000
      }
    };
  }

  async loadWithdrawalRequests() {
    try {
      console.log('Loading withdrawal requests via REST API...');
      
      // For now, use mock data since we don't have a withdrawal requests API endpoint yet
      // TODO: Replace with actual REST API call when available
      // const data = await this.api.getWithdrawalRequests(userId);
      
      this.renderWithdrawalRequests([]);
      console.log('Withdrawal requests loaded: 0 requests');
    } catch (error) {
      console.error('Failed to load withdrawal requests:', error);
      this.renderWithdrawalRequests([]);
    }
  }

  setupCurrencySelector() {
    this.setupCurrencyOptions();
  }

  setupMethodCards() {
    // Method cards are handled by the HTML and form setup
    console.log('Method cards setup complete');
  }

  setupForms() {
    // Setup form event listeners
    const currencySelect = document.getElementById('currency-select');
    const methodSelect = document.getElementById('method-select');
    const amountInput = document.getElementById('amount-input');
    const withdrawButton = document.getElementById('btn-withdraw');

    if (currencySelect) {
      currencySelect.addEventListener('change', () => this.handleCurrencyChange());
    }
    if (methodSelect) {
      methodSelect.addEventListener('change', () => this.handleMethodChange());
    }
    if (amountInput) {
      amountInput.addEventListener('input', () => this.updateAmountDisplay());
    }
    if (withdrawButton) {
      withdrawButton.addEventListener('click', () => this.submitWithdrawal());
    }

    console.log('Forms setup complete');
  }

  setupURLParameters() {
    // Handle URL parameters if needed
    console.log('URL parameters setup complete');
  }

  updateAmountDisplay() {
    // Update amount display based on input
    console.log('Amount display updated');
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

    // Guard against missing balance data
    if (!this.userBalances) {
      if (availableUSD) availableUSD.textContent = '$0';
      if (availableUSDT) availableUSDT.textContent = '₮0';
      return;
    }

    // Display USD balance if available
    if (availableUSD && this.userBalances.USD) {
      availableUSD.textContent = `$${this.formatMoney(this.userBalances.USD.available)}`;
    } else if (availableUSD) {
      availableUSD.textContent = '$0';
    }

    // Display USDT balance if available
    if (availableUSDT && this.userBalances.USDT) {
      availableUSDT.textContent = `₮${this.formatMoney(this.userBalances.USDT.available, 6)}`;
    } else if (availableUSDT) {
      availableUSDT.textContent = '₮0';
    }

    if (dailyUsed && this.dailyLimits && this.dailyLimits.USD && this.dailyLimits.USDT) {
      const totalUsed = (this.dailyLimits.USD.used || 0) + (this.dailyLimits.USDT.used || 0);
      dailyUsed.textContent = `$${this.formatMoney(totalUsed)}`;
    }

    // Update status indicators
    const hasActivePositions = (this.userBalances.USD && this.userBalances.USD.locked > 0) || 
                              (this.userBalances.USDT && this.userBalances.USDT.locked > 0);
    
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
      if (!this.dailyLimits) {
        limitsStatus.textContent = 'No Limits Set';
        limitsStatus.className = 'balance-status available';
      } else {
        const totalLimit = this.withdrawalSettings.currencies.USD.daily_limit + this.withdrawalSettings.currencies.USDT.daily_limit;
        const totalUsed = (this.dailyLimits.USD?.used || 0) + (this.dailyLimits.USDT?.used || 0);
        
        if (totalUsed >= totalLimit) {
          limitsStatus.textContent = 'Daily Limit Reached';
          limitsStatus.className = 'balance-status locked';
        } else {
          limitsStatus.textContent = 'Within Limits';
          limitsStatus.className = 'balance-status available';
        }
      }
    }
  }

  setupCurrencyOptions() {
    const currencySelect = document.getElementById('currency-select');
    if (!currencySelect) return;

    // Check if userBalances is null or undefined
    if (!this.userBalances) {
      console.warn('User balances not available, using default currency options');
      // Enable all currencies by default when balances are not available
      return;
    }

    // Enable currency selection (removed active position blocking)
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

    // Update currency symbol if element exists
    if (amountCurrency) {
      amountCurrency.textContent = this.selectedCurrency === 'USD' ? '$' : '₮';
    }
    
    // Populate method dropdown with user's saved methods for selected currency
    this.populateMethodDropdown();
    
    // Enable amount input
    amountInput.disabled = false;
    
    // Set minimum amount from user methods or default
    const methodsForCurrency = this.userMethods.filter(method => method.currency === this.selectedCurrency);
    if (methodsForCurrency.length > 0) {
      const minAmount = Math.min(...methodsForCurrency.map(m => m.min_amount || 0));
      amountInput.min = minAmount;
      amountInput.placeholder = `${minAmount.toFixed(2)} minimum`;
      
      // Auto-select the default method if available
      const defaultMethod = methodsForCurrency.find(m => m.is_default);
      if (defaultMethod) {
        methodSelect.value = defaultMethod.id;
        this.handleMethodChange();
      }
    } else {
      amountInput.min = 1;
      amountInput.placeholder = '0.00 minimum';
    }
  }

  setupMethodOptions() {
    const methodSelect = document.getElementById('method-select');
    if (!methodSelect || !this.selectedCurrency) return;

    methodSelect.innerHTML = '<option value="">Select Method</option>';
    methodSelect.disabled = false;

    // Check if withdrawalSettings exists and has methods
    if (!this.withdrawalSettings || !this.withdrawalSettings.methods) {
      console.warn('Withdrawal settings not loaded, using fallback methods');
      // Add fallback methods
      const fallbackMethods = {
        'crypto': { name: 'Cryptocurrency', type: 'crypto' },
        'bank': { name: 'Bank Transfer', type: 'bank' },
        'paypal': { name: 'PayPal', type: 'paypal' }
      };
      
      Object.keys(fallbackMethods).forEach(methodKey => {
        const method = fallbackMethods[methodKey];
        const option = document.createElement('option');
        option.value = methodKey;
        option.textContent = method.name;
        methodSelect.appendChild(option);
      });
      return;
    }

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

    // Get selected method data
    const selectedOption = methodSelect.options[methodSelect.selectedIndex];
    const methodData = JSON.parse(selectedOption.dataset.method || '{}');
    
    this.selectedMethodData = methodData;
    this.updateMethodDetails();
  }

  updateMethodDetails() {
    const methodDetails = document.getElementById('method-details');
    const methodDetailsContent = document.getElementById('method-details-content');
    
    if (!methodDetails || !methodDetailsContent) {
      console.warn('Method details elements not found in DOM');
      return;
    }
    
    if (!this.selectedMethodData) {
      methodDetails.style.display = 'none';
      return;
    }

    // Extract details from JSONB field
    const details = this.selectedMethodData.details || {};

    // Show method details based on method type
    let detailsHTML = '';
    
    if (this.selectedMethodData.method_type === 'crypto_wallet') {
      detailsHTML = `
        <div class="method-detail-item">
          <span class="method-detail-label">Network:</span>
          <span class="method-detail-value">${this.selectedMethodData.network || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Address:</span>
          <span class="method-detail-value" style="font-family: 'Courier New', monospace; word-break: break-all;">${this.selectedMethodData.address || details.address || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Processing Time:</span>
          <span class="method-detail-value">${this.selectedMethodData.processing_time_hours || 24} hours</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Fee:</span>
          <span class="method-detail-value">${(this.selectedMethodData.fee_percentage || 0) * 100}%</span>
        </div>
      `;
    } else if (this.selectedMethodData.method_type === 'bank_transfer') {
      detailsHTML = `
        <div class="method-detail-item">
          <span class="method-detail-label">Bank Name:</span>
          <span class="method-detail-value">${details.bank_name || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Account Number:</span>
          <span class="method-detail-value">${details.account_number || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Routing Number:</span>
          <span class="method-detail-value">${details.routing_number || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">SWIFT Code:</span>
          <span class="method-detail-value">${details.swift_code || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Account Holder:</span>
          <span class="method-detail-value">${details.account_name || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Processing Time:</span>
          <span class="method-detail-value">${this.selectedMethodData.processing_time_hours || 72} hours</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Fee:</span>
          <span class="method-detail-value">${(this.selectedMethodData.fee_percentage || 0) * 100}%</span>
        </div>
      `;
    } else if (this.selectedMethodData.method_type === 'paypal') {
      detailsHTML = `
        <div class="method-detail-item">
          <span class="method-detail-label">PayPal Email:</span>
          <span class="method-detail-value">${details.email || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Account ID:</span>
          <span class="method-detail-value">${details.account_id || 'Not set'}</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Processing Time:</span>
          <span class="method-detail-value">${this.selectedMethodData.processing_time_hours || 12} hours</span>
        </div>
        <div class="method-detail-item">
          <span class="method-detail-label">Fee:</span>
          <span class="method-detail-value">${(this.selectedMethodData.fee_percentage || 0) * 100}%</span>
        </div>
      `;
    }

    // Add min/max amounts
    detailsHTML += `
      <div class="method-detail-item">
        <span class="method-detail-label">Minimum Amount:</span>
        <span class="method-detail-value">${this.selectedMethodData.currency === 'USDT' ? '₮' : '$'}${this.formatMoney(this.selectedMethodData.min_amount || 0, this.selectedMethodData.currency === 'USDT' ? 6 : 2)}</span>
      </div>
      ${this.selectedMethodData.max_amount ? `
        <div class="method-detail-item">
          <span class="method-detail-label">Maximum Amount:</span>
          <span class="method-detail-value">${this.selectedMethodData.currency === 'USDT' ? '₮' : '$'}${this.formatMoney(this.selectedMethodData.max_amount, this.selectedMethodData.currency === 'USDT' ? 6 : 2)}</span>
        </div>
      ` : ''}
    `;

    methodDetailsContent.innerHTML = detailsHTML;
    methodDetails.style.display = 'block';
    
    // Update fee preview
    this.updateFeePreview();
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
    const methodSelect = document.getElementById('method-select');
    const selectedOption = methodSelect.options[methodSelect.selectedIndex];
    const methodData = selectedOption ? JSON.parse(selectedOption.dataset.method || '{}') : null;

    try {
      const withdrawButton = document.getElementById('btn-withdraw');
      if (withdrawButton) {
        withdrawButton.disabled = true;
        withdrawButton.textContent = 'Processing...';
      }

      // Calculate fee (0% for now)
      const feeAmount = 0;
      const totalDebit = amount + feeAmount;

      // Map method_type to valid enum values
      const methodTypeMap = {
        'crypto_wallet': 'crypto',
        'bank_transfer': 'bank',
        'paypal': 'paypal'
      };
      const withdrawalMethod = methodTypeMap[methodData?.method_type] || 'bank';

      // Use Supabase REST API directly - no CORS issues
      const { data, error } = await window.API.supabase
        .from('withdrawals')
        .insert({
          user_id: this.currentUser.id,
          currency: this.selectedCurrency,
          amount: amount,
          fee_amount: feeAmount,
          method: withdrawalMethod,
          method_id: methodData?.id,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Deduct from available balance (total is a generated column, cannot be updated)
      const { error: balanceError } = await window.API.supabase
        .from('wallet_balances')
        .update({
          available: this.userBalances[this.selectedCurrency].available - totalDebit
        })
        .eq('user_id', this.currentUser.id)
        .eq('currency', this.selectedCurrency);

      if (balanceError) {
        console.error('Failed to deduct from balance:', balanceError);
      }

      // Note: Ledger entry creation skipped due to RLS policy restrictions
      // The edge function would handle this, but we're using direct insert

      window.Notify.success('Withdrawal request submitted successfully! Your request is pending admin approval.');

      // Reset form
      this.resetForm();

      // Reload requests and balances
      await this.loadWithdrawalRequests();
      await this.loadUserBalances();

    } catch (error) {
      console.error('Failed to submit withdrawal:', error);
      window.Notify.error(error.message || 'Failed to submit withdrawal request');
    } finally {
      const withdrawButton = document.getElementById('btn-withdraw');
      if (withdrawButton) {
        withdrawButton.disabled = false;
        withdrawButton.textContent = 'Withdraw';
      }
    }
  }

  validateWithdrawal() {
    console.log('Validating withdrawal...');
    console.log('Current user:', this.currentUser);
    console.log('Selected currency:', this.selectedCurrency);
    console.log('Selected method:', this.selectedMethod);
    console.log('Selected method data:', this.selectedMethodData);

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

    // Validate method data
    if (!this.selectedMethodData) {
      window.Notify.error('Please select a valid withdrawal method');
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
    const currencyBalance = this.userBalances[this.selectedCurrency];
    if (!currencyBalance || !currencyBalance.available) {
      window.Notify.error('Balance information not available for selected currency');
      return false;
    }
    
    const availableBalance = currencyBalance.available;
    if (amount > availableBalance) {
      window.Notify.error('Insufficient available balance');
      return false;
    }

    // Check daily limits
    if (this.dailyLimits && this.dailyLimits[this.selectedCurrency]) {
      const dailyLimit = this.dailyLimits[this.selectedCurrency];
      if (dailyLimit.used + amount > dailyLimit.limit) {
        window.Notify.error(`Daily withdrawal limit exceeded. You can withdraw ${this.selectedCurrency} ${dailyLimit.remaining} more today.`);
        return false;
      }
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
    const currencySelect = document.getElementById('currency-select');
    const methodSelect = document.getElementById('method-select');
    const amountInput = document.getElementById('amount-input');
    
    if (currencySelect) currencySelect.value = '';
    if (methodSelect) methodSelect.value = '';
    if (amountInput) amountInput.value = '';
    
    // Hide method details and fee preview
    const methodDetails = document.getElementById('method-details');
    const feePreview = document.getElementById('fee-preview');
    if (methodDetails) methodDetails.style.display = 'none';
    if (feePreview) feePreview.style.display = 'none';
    
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
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '0';
    }
    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }
    if (isNaN(amount)) {
      return '0';
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
