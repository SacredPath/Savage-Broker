/**
 * API Client - REST API Only Version
 */

class APIClient {
  constructor() {
    this.supabase = null;
    this.serviceClient = null;
    this.initialized = false;
    this.initPromise = null;
    this.init();
  }

  init() {
    this.initSupabase();
    this.initServiceClient();
    this.startKeepAlive();
  }

  getDevelopmentUrl() {
    return 'https://ubycoeyutauzjgxbozcm.supabase.co';
  }

  getServiceRoleKey() {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieWNvZXRlcm9sZSIsImlhdCI6MTczODQ2OTkyfQ.16X2ssw9RgDw4QhF4x1KvilcbMUpqn00gBP0Ed7MCHc';
  }

  async initSupabase() {
    try {
      console.log('[APIClient] Initializing shared Supabase client...');
      
      // Use shared Supabase client instance to prevent duplicates
      if (window.SupabaseClient) {
        this.supabase = await window.SupabaseClient.getClient();
        console.log('[APIClient] Using shared Supabase client instance');
        
        // Test auth immediately
        const { data: { session } } = await this.supabase.auth.getSession();
        console.log('[APIClient] Auth test - Session:', session ? 'Found' : 'Not found');
        if (session?.access_token) {
          console.log('[APIClient] Auth test - Token available:', session.access_token.substring(0, 20) + '...');
        }
      } else if (window.supabase) {
        // Fallback to legacy global instance
        this.supabase = await window.supabase.getClient();
        console.log('[APIClient] Using legacy Supabase client instance');
        
        // Test auth immediately
        const { data: { session } } = await this.supabase.auth.getSession();
        console.log('[APIClient] Auth test - Session:', session ? 'Found' : 'Not found');
        if (session?.access_token) {
          console.log('[APIClient] Auth test - Token available:', session.access_token.substring(0, 20) + '...');
        }
      } else {
        // Last resort - wait for SupabaseClient to load
        console.warn('[APIClient] SupabaseClient not available, retrying...');
        setTimeout(() => this.initSupabase(), 100);
        return;
      }
      
      console.log('[APIClient] Initialized with shared client');
    } catch (error) {
      console.error('[APIClient] Init failed:', error);
    }
  }

  async initServiceClient() {
    try {
      console.log('[APIClient] Initializing service client...');
      
      // Use the shared Supabase client for service operations too
      // This prevents multiple client instances
      if (window.SupabaseClient) {
        this.serviceClient = await window.SupabaseClient.getClient();
        console.log('[APIClient] Using shared Supabase client for service operations');
      } else if (window.supabase) {
        this.serviceClient = await window.supabase.getClient();
        console.log('[APIClient] Using legacy Supabase client for service operations');
      } else {
        console.warn('[APIClient] No Supabase client available for service operations');
        return;
      }
      
      console.log('[APIClient] Service client initialized successfully');
    } catch (error) {
      console.error('[APIClient] Service client init failed:', error);
    }
  }

  transformBalanceData(data) {
    if (!data) return [];
    return data.map(item => ({
      symbol: item.symbol,
      amount: item.amount,
      value: item.usd_value || 0
    }));
  }

  // REST API methods
  async getPortfolioSnapshot(userId) {
    try {
      console.log('[APIClient] Getting portfolio snapshot via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      // Get user positions first
      const { data: positions, error: positionsError } = await this.serviceClient
        .from('positions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (positionsError) {
        throw positionsError;
      }

      // Get investment tiers data separately
      const { data: tiers, error: tiersError } = await this.serviceClient
        .from('investment_tiers')
        .select('*')
        .order('id');

      if (tiersError) {
        throw tiersError;
      }

      // Map tier data to positions
      const positionsWithTiers = positions?.map(position => {
        const tier = tiers?.find(t => t.id === position.tier_id);
        return {
          ...position,
          investment_tiers: tier || null
        };
      }) || [];

      // Calculate portfolio summary
      const totalValue = positionsWithTiers.reduce((sum, pos) => sum + (pos.amount || 0), 0);
      const totalROI = positionsWithTiers.reduce((sum, pos) => sum + (pos.accrued_roi || 0), 0);

      return {
        positions: positionsWithTiers,
        summary: {
          total_value: totalValue,
          total_roi: totalROI,
          positions_count: positionsWithTiers.length
        },
        balances: [] // TODO: Add balances if needed
      };
    } catch (error) {
      console.error('Failed to fetch portfolio snapshot:', error);
      throw error;
    }
  }

  async fetchPositionsList(userId) {
    try {
      console.log('[APIClient] Getting positions list via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const response = await this.serviceClient
        .from('positions')
        .select('*')
        .eq('user_id', userId)
        .single();

      return this.mapPositionsList(response);
    } catch (error) {
      console.error('Failed to fetch positions list:', error);
      throw error;
    }
  }

  async fetchTiersList() {
    try {
      console.log('[APIClient] Getting tiers list via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const response = await this.serviceClient
        .from('tiers')
        .select('*')
        .eq('user_id', userId)
        .single();

      return this.mapTiersList(response);
    } catch (error) {
      console.error('Failed to fetch tiers list:', error);
      throw error;
    }
  }

  async fetchInvestPreview(userId) {
    try {
      console.log('[APIClient] Getting invest preview via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const response = await this.serviceClient
        .from('investment_preview')
        .select('*')
        .eq('user_id', userId)
        .single();

      return this.mapInvestPreview(response);
    } catch (error) {
      console.error('Failed to fetch invest preview:', error);
      throw error;
    }
  }

  async getExchangeRate(from = 'USDT', to = 'USD') {
    try {
      console.log('[APIClient] Getting exchange rate via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const result = await this.serviceClient
        .from('exchange_rates')
        .select('from_currency', from)
        .eq('to_currency', to)
        .single();

      return result;
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      throw error;
    }
  }

  async getMarketPrices() {
    try {
      console.log('[APIClient] Getting market prices...');
      
      // For now, return mock market prices in array format since portfolio.js expects forEach
      // This can be updated later to fetch from a real market data API
      const mockPrices = [
        { symbol: 'BTC', price_usd: 45000.00 },
        { symbol: 'ETH', price_usd: 2800.00 },
        { symbol: 'USDT', price_usd: 1.00 },
        { symbol: 'USD', price_usd: 1.00 }
      ];

      console.log('[APIClient] Market prices loaded:', mockPrices);
      return mockPrices;
    } catch (error) {
      console.error('Failed to fetch market prices:', error);
      // Return empty array on error to match expected format
      return [];
    }
  }

  async createPaymentIntent(amount, currency = 'USD') {
    try {
      console.log('[APIClient] Creating payment intent via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const result = await this.serviceClient
        .from('payment_intents')
        .insert({
          amount: parseFloat(amount),
          currency,
          user_id: userId,
          status: 'pending'
        })
        .select();

      return result;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  async getAuthSessionFor(userId) {
    try {
      console.log('[APIClient] Getting auth session for:', 'kyc_status');
      
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session } } = await this.supabase.auth.getSession();
      console.log('[APIClient] Session retrieved:', session ? 'Found' : 'Not found');

      if (session && session.access_token) {
        const token = session.access_token;
        console.log('[APIClient] JWT Token found:', token.substring(0, 20) + '...');
        console.log('[APIClient] JWT Token length:', token.length);
        console.log('[APIClient] JWT Token expires at:', new Date(session.expires_at * 1000).toISOString());
        
        return {
          'Content-Type': 'application/json',
          'apikey': this.supabase.supabaseKey,
          'Authorization': `Bearer ${token}`
        };
      } else {
        console.error('[APIClient] No session or access_token found');
        console.log('[APIClient] Session object:', session);
        
        if (requireAuth) {
          // If authentication is required but no session, throw an error
          throw new Error('Authentication required but no active session found.');
        }
        // For public functions, create a minimal auth header or use anon key
        console.log('[APIClient] Public function but no session - using anon key');
        return {
          'Content-Type': 'application/json',
          'apikey': this.supabase.supabaseKey
        };
      }
    } catch (error) {
      console.error('[APIClient] Failed to get auth session:', error);
      throw error;
    }
  }

  async fetchEdge(functionName, options = {}) {
    const {
      method = 'GET',
      body,
      timeout = 10000, // Default timeout of 10 seconds
      retries = 3,
      requireAuth = true,
      sentAuthPrefix = null
    } = options;

    // Ensure Supabase client is initialized
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const edgeFunctionUrl = `${this.supabase.supabaseUrl}/functions/v1/${functionName}`;
    const headers = await this.getAuthSessionFor(functionName);

    let lastError = null;
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const fetchOptions = {
          method,
          headers,
          signal: controller.signal
        };

        if (body) {
          // Check if body is already a string to prevent double encoding
          if (typeof body === 'string') {
            fetchOptions.body = body;
          } else {
            fetchOptions.body = JSON.stringify(body);
          }
        }

        console.log('[APIClient] Sending request to:', edgeFunctionUrl);
        console.log('[APIClient] Request headers:', headers);
        console.log('[APIClient] Full fetch options:', fetchOptions);

        const response = await fetch(edgeFunctionUrl, fetchOptions);

        clearTimeout(id);

        // Log response details for debugging
        console.log('[APIClient] Response status:', response.status);
        console.log('[APIClient] Response headers:', Object.fromEntries(response.headers.entries()));
        
        // Handle HTTP errors with proper status codes
        if (!response.ok) {
          let errorBody;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = { message: response.statusText };
          }
          
          let errorMessage;
          switch (response.status) {
            case 400:
              errorMessage = `Bad Request: ${errorBody.message || 'Invalid request data'}`;
              break;
            case 401:
              errorMessage = `Unauthorized: Authentication required`;
              break;
            case 403:
              errorMessage = `Forbidden: Insufficient permissions`;
              break;
            case 404:
              errorMessage = `Not Found: ${errorBody.message || 'Resource not found'}`;
              break;
            case 500:
              errorMessage = `Server Error: ${errorBody.message || 'Internal server error'}`;
              break;
            default:
              errorMessage = `HTTP ${response.status}: ${errorBody.message || JSON.stringify(errorBody)}`;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('[APIClient] Response data:', data);
        return { data, error: null };
      } catch (error) {
        clearTimeout(id);
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.warn(`Edge function ${functionName} timed out. Retrying... (${i + 1}/${retries})`);
        } else {
          console.error(`Edge function ${functionName} failed: ${error.message}. Retrying... (${i + 1}/${retries})`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
      }
    }
    throw lastError;
  }

  // Mapping functions for data transformation
  mapPortfolioSnapshot(response) {
    if (!response) return null;
    
    return {
      totalValue: response.total_value || 0,
      totalGain: response.total_gain || 0,
      totalLoss: response.total_loss || 0,
      positions: response.positions || []
    };
  }

  mapPositionsList(response) {
    if (!response) return [];
    
    return response.positions || [];
  }

  mapTiersList(response) {
    if (!response) return [];
    
    return response.tiers || [];
  }

  mapInvestPreview(response) {
    if (!response) return null;
    
    return response.preview || {};
  }

  // Keep-alive ping
  startKeepAlive() {
    setInterval(async () => {
      try {
        if (!this.serviceClient) {
          console.warn('[APIClient] Service client not available for keep-alive');
          return;
        }

        // Simple health check - query app_settings
        const { data, error } = await this.serviceClient
          .from('app_settings')
          .select('id, updated_at')
          .eq('id', 1)
          .single();

        if (error) {
          console.error('[APIClient] Keep-alive ping failed:', error);
        }
      } catch (error) {
        console.error('[APIClient] Keep-alive ping error:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  async getCurrentUserId() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
      }

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      return session.user.id;
    } catch (error) {
      console.error('[APIClient] Failed to get current user ID:', error);
      return null;
    }
  }

  async getKYCStatus(userId) {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data: profile, error } = await this.serviceClient
        .from('profiles')
        .select('kyc_status, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason')
        .eq('user_id', userId)
        .single();

      let kycData;
      if (profile) {
        kycData = {
          status: profile.kyc_status || 'not_submitted',
          submitted_at: profile.kyc_submitted_at,
          reviewed_at: profile.kyc_reviewed_at,
          rejection_reason: profile.kyc_rejection_reason
        };
      }

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      // Return default status if no record found
      if (!kycData) {
        return {
          status: 'not_submitted',
          submitted_at: null,
          reviewed_at: null,
          rejection_reason: null
        };
      }

      return kycData;
    } catch (error) {
      console.error('[APIClient] Failed to get KYC status:', error);
      // Return default status on error
      return {
        status: 'not_submitted',
        submitted_at: null,
        reviewed_at: null,
        rejection_reason: null
      };
    }
  }

  async submitKYC(userId, kycData) {
    try {
      console.log('[APIClient] Submitting KYC for user:', userId);
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data, error } = await this.serviceClient
        .from('profiles')
        .update({
          first_name: kycData.firstName,
          last_name: kycData.lastName,
          date_of_birth: kycData.dateOfBirth,
          nationality: kycData.nationality,
          kyc_status: 'pending',
          kyc_submitted_at: new Date().toISOString(),
          kyc_documents: kycData.documents
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('[APIClient] KYC submitted successfully:', data);
      return {
        ok: true,
        status: 'pending',
        message: 'KYC submitted successfully',
        profile: data
      };
    } catch (error) {
      console.error('[APIClient] Failed to submit KYC:', error);
      return {
        ok: false,
        error: 'Failed to submit KYC',
        detail: error.message
      };
    }
  }

  async getPayoutMethods(userId) {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data, error } = await this.serviceClient
        .from('payout_methods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[APIClient] Failed to get payout methods:', error);
      return [];
    }
  }

  async getUserProfile(userId) {
    try {
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data: profile, error } = await this.serviceClient
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      return { profile };
    } catch (error) {
      console.error('[APIClient] Failed to get user profile:', error);
      return { profile: null };
    }
  }

  async getConversionSettings() {
    try {
      console.log('[APIClient] Getting conversion settings via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data, error } = await this.serviceClient
        .from('conversion_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      // Return default settings if no record found
      if (!data) {
        return {
          fees: {
            markup_percentage: 0.5,
            fixed_fee: 1.0,
            variable_fee_percentage: 0.1
          },
          refresh_interval: 30,
          min_amount: 1.0,
          max_amount: 10000.0
        };
      }

      return data;
    } catch (error) {
      console.error('[APIClient] Failed to get conversion settings:', error);
      // Return default settings on error
      return {
        fees: {
          markup_percentage: 0.5,
          fixed_fee: 1.0,
          variable_fee_percentage: 0.1
        },
        refresh_interval: 30,
        min_amount: 1.0,
        max_amount: 10000.0
      };
    }
  }

  /**
   * @deprecated Use BalanceService.getUserBalances() instead
   * This method is deprecated and will be removed in a future version.
   * BalanceService is the single source of truth for all balance operations.
   */
  async getWalletBalances(userId) {
    console.warn('[APIClient] DEPRECATED: getWalletBalances() is deprecated. Use BalanceService.getUserBalances() instead.');
    
    try {
      console.log('[APIClient] Getting wallet balances via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data, error } = await this.serviceClient
        .from('wallet_balances')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Transform to expected format
      const balances = {};
      if (data) {
        data.forEach(balance => {
          balances[balance.currency] = {
            available: balance.available || 0,
            frozen: balance.frozen || 0,
            total: balance.total || 0
          };
        });
      }

      // Ensure USDT and USD exist with defaults
      if (!balances.USDT) {
        balances.USDT = { available: 0, frozen: 0, total: 0 };
      }
      if (!balances.USD) {
        balances.USD = { available: 0, frozen: 0, total: 0 };
      }

      return balances;
    } catch (error) {
      console.error('[APIClient] Failed to get wallet balances:', error);
      // Return default balances on error
      return {
        USDT: { available: 0, frozen: 0, total: 0 },
        USD: { available: 0, frozen: 0, total: 0 }
      };
    }
  }

  async getConversionHistory(userId) {
    try {
      console.log('[APIClient] Getting conversion history via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      const { data, error } = await this.serviceClient
        .from('conversions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[APIClient] Failed to get conversion history:', error);
      return [];
    }
  }

  async getFXQuote(fromCurrency, toCurrency, amount) {
    try {
      console.log('[APIClient] Getting FX quote via REST API...');
      
      if (!this.serviceClient) {
        throw new Error('Service client not initialized');
      }

      // For now, generate mock quote since we don't have a real FX API
      // This can be replaced with a real API call later
      const mockRate = fromCurrency === 'USDT' && toCurrency === 'USD' ? 1.0 : 0.95;
      const markup = 0.005; // 0.5% markup
      const finalRate = mockRate * (1 + markup);
      
      const fees = {
        fixed: 1.0,
        variable: amount * 0.001, // 0.1% variable fee
        total: 1.0 + (amount * 0.001)
      };

      const toAmount = (amount * finalRate) - fees.total;

      return {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: amount,
        to_amount: toAmount,
        rate: mockRate,
        final_rate: finalRate,
        fees: fees.total,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[APIClient] Failed to get FX quote:', error);
      throw error;
    }
  }

  destroy() {
    // Clear keep-alive interval
    this.supabase = null;
    this.serviceClient = null;
    console.log('APIClient destroyed');
  }
}

// Only initialize if not already present
setTimeout(() => {
  if (!window.API) {
    window.API = new APIClient();
    window.APIClient = APIClient;
    console.log('API Client initialized and made globally available');
  } else {
    console.log('API Client already available, skipping delayed initialization');
  }
}, 100);

export default APIClient;
