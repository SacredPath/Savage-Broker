/**
 * Home Page Controller
 * Handles dashboard display, user stats, and recent activity
 * All theme handling goes through AppShell - no duplicate theme systems
 */

class HomePage {
  constructor() {
    this.currentUser = null;
    this.dashboardData = null;
    this.recentActivity = null;
    
    // Get API client
    this.api = window.API || null;

    if (!this.api) {
      console.warn("HomePage: API client not found on load. Retrying in 500ms...");
      setTimeout(() => this.retryInit(), 500);
    } else {
      this.init();
    }
  }

  retryInit() {
    this.api = window.API || null;
    this.init();
  }

  async init() {
    console.log('Home page initializing...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }

  async setupPage() {
    try {
      // Wait for API client to be available
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      while (!window.API && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.API) {
        throw new Error('API client not available');
      }
      
      // Initialize app shell FIRST - this handles all sidebar and theme functionality (like portfolio.js)
      if (window.AppShell) {
        window.AppShell.initShell();
      }
      
      // Setup page content (app shell is loaded inline like portfolio.html)
      await this.updateUserDisplay();
      this.loadDashboardData();
      this.loadRecentActivity();
      
      console.log('Home page setup complete');
    } catch (error) {
      console.error('Error setting up home page:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load home page');
      }
    }
  }

  async updateUserDisplay() {
    try {
      // Update user display name in welcome message
      const userDisplay = document.getElementById('user-display-name');
      
      if (!userDisplay) return;

      // Get current user data from database
      const userId = await window.API.getCurrentUserId();
      if (!userId) {
        userDisplay.textContent = 'Guest';
        return;
      }

      // Get user profile from database
      const userData = await window.API.getUserProfile(userId);
      
      const displayName = userData.profile?.display_name || 
                        userData.profile?.first_name || 
                        userData.email?.split('@')[0] || 
                        'User';
      
      userDisplay.textContent = displayName;
      console.log('[HomePage] User display updated:', displayName);
      
    } catch (error) {
      console.error('[HomePage] Failed to update user display:', error);
      const userDisplay = document.getElementById('user-display-name');
      if (userDisplay) {
        userDisplay.textContent = 'User';
      }
    }
  }

  async loadDashboardData() {
    try {
      console.log('[HomePage] Loading real dashboard data...');
      
      // Get current user ID
      const userId = await window.API.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load real balance data using unified service
      const balanceData = await window.BalanceService.getUserBalances(userId);
      
      // Load portfolio data for invested amount and profit
      let portfolioData = null;
      try {
        portfolioData = await window.API.getPortfolioSnapshot(userId);
      } catch (portfolioError) {
        console.warn('[HomePage] Portfolio data unavailable:', portfolioError.message);
      }

      // Calculate dashboard metrics
      const totalBalance = balanceData.total_usd;
      const investedAmount = portfolioData?.summary?.total_value || 0;
      const totalProfit = totalBalance - investedAmount;
      
      // Get active signals count from database
      let activeSignals = 0;
      try {
        const { data: signalData, error: signalError } = await window.API.supabase
          .from('signals')
          .select('id')
          .eq('status', 'active');

        if (!signalError) {
          activeSignals = signalData?.length || 0;
        }
      } catch (signalError) {
        console.warn('[HomePage] Could not load active signals:', signalError.message);
      }

      const dashboardData = {
        totalBalance,
        investedAmount,
        totalProfit,
        activeSignals
      };

      console.log('[HomePage] Dashboard data loaded:', dashboardData);
      this.updateDashboardStats(dashboardData);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      
      // Set zero values when data is unavailable
      const zeroData = {
        totalBalance: 0,
        investedAmount: 0,
        totalProfit: 0,
        activeSignals: 0
      };
      
      this.updateDashboardStats(zeroData);
      
      if (window.Notify) {
        window.Notify.error('Failed to load dashboard data. Please refresh the page.');
      }
    }
  }

  updateDashboardStats(data) {
    // Update stats with proper formatting
    const totalBalance = document.getElementById('total-balance');
    const investedAmount = document.getElementById('invested-amount');
    const totalProfit = document.getElementById('total-profit');
    const activeSignals = document.getElementById('active-signals');

    if (totalBalance) {
      totalBalance.textContent = this.formatCurrency(data.totalBalance);
    }
    
    if (investedAmount) {
      investedAmount.textContent = this.formatCurrency(data.investedAmount);
    }
    
    if (totalProfit) {
      totalProfit.textContent = this.formatCurrency(data.totalProfit);
      // Add profit/loss styling
      totalProfit.className = data.totalProfit >= 0 ? 'stat-value positive' : 'stat-value negative';
    }
    
    if (activeSignals) {
      activeSignals.textContent = data.activeSignals;
    }
  }

  async loadRecentActivity() {
    try {
      console.log('[HomePage] Loading recent activity from database...');
      
      const userId = await window.API.getCurrentUserId();
      if (!userId) {
        console.warn('[HomePage] User not authenticated, skipping activity');
        this.renderRecentActivity([]);
        return;
      }

      const activity = [];

      // Load recent deposits
      try {
        const { data: deposits, error: depositError } = await window.API.supabase
          .from('transactions')
          .select('amount, currency, created_at, status')
          .eq('user_id', userId)
          .eq('type', 'deposit')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!depositError && deposits) {
          deposits.forEach(deposit => {
            activity.push({
              type: 'deposit',
              description: 'Deposit completed',
              amount: deposit.amount,
              currency: deposit.currency,
              timestamp: deposit.created_at
            });
          });
        }
      } catch (depositError) {
        console.warn('[HomePage] Could not load deposits:', depositError.message);
      }

      // Load recent withdrawals
      try {
        const { data: withdrawals, error: withdrawalError } = await window.API.supabase
          .from('transactions')
          .select('amount, currency, created_at, status')
          .eq('user_id', userId)
          .eq('type', 'withdrawal')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!withdrawalError && withdrawals) {
          withdrawals.forEach(withdrawal => {
            activity.push({
              type: 'withdrawal',
              description: 'Withdrawal processed',
              amount: withdrawal.amount,
              currency: withdrawal.currency,
              timestamp: withdrawal.created_at
            });
          });
        }
      } catch (withdrawalError) {
        console.warn('[HomePage] Could not load withdrawals:', withdrawalError.message);
      }

      // Load recent signal purchases
      try {
        const { data: signalData, error: signalError } = await window.API.supabase
          .from('signals')
          .select('title, price, created_at, category, risk_level')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!signalError && signalData) {
          signalData.forEach(signal => {
            activity.push({
              type: 'signal',
              title: signal.title,
              description: `${signal.category} - ${signal.risk_level || 'Low'} risk`,
              amount: signal.price || 0,
              currency: 'USD',
              timestamp: signal.created_at
            });
          });
        }
      } catch (signalError) {
        console.warn('[HomePage] Could not load signals:', signalError.message);
      }

      // Sort by timestamp (most recent first)
      activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Limit to 10 most recent activities
      const recentActivity = activity.slice(0, 10);

      console.log(`[HomePage] Loaded ${recentActivity.length} recent activities`);
      this.renderRecentActivity(recentActivity);
      
    } catch (error) {
      console.error('Failed to load recent activity:', error);
      this.renderRecentActivity([]);
    }
  }

  renderRecentActivity(activity) {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList) return;

    if (!activity || activity.length === 0) {
      activityList.innerHTML = '<p class="no-activity">No recent activity</p>';
      return;
    }

    const activityHTML = activity.map(item => {
      const icon = this.getActivityIcon(item.type);
      const timeAgo = this.formatTimeAgo(item.timestamp);
      
      return `
        <div class="activity-item">
          <div class="activity-icon ${item.type}">
            ${icon}
          </div>
          <div class="activity-details">
            <div class="activity-description">${item.description}</div>
            <div class="activity-amount">${this.formatCurrency(item.amount, item.currency)}</div>
          </div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      `;
    }).join('');

    activityList.innerHTML = activityHTML;
  }

  getActivityIcon(type) {
    const icons = {
      deposit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      withdrawal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 19 19 12 12 5"></polyline></svg>',
      trade: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>',
      signal_purchase: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5"></path></svg>'
    };
    return icons[type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
  }

  formatCurrency(amount, currency = 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }
}

// Initialize home page when DOM is ready
window.homePage = new HomePage();
