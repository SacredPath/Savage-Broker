/**
 * Home Page Controller (App Shell Example)
 * Demonstrates how to use the app shell components
 */

class HomePage {
  constructor() {
    this.currentUser = null;
    
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
    if (this.api) {
      this.init();
    } else {
      // Retry again if API client still not available
      setTimeout(() => this.retryInit(), 500);
    }
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
      // Setup page content
      this.updateUserDisplay();
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

  updateUserDisplay() {
    // Update user display name in welcome message
    const userDisplay = document.getElementById('user-display-name');
    
    if (window.AppShell?.currentUser) {
      const user = window.AppShell.currentUser;
      const displayName = user.profile?.display_name || 
                        user.email?.split('@')[0] || 
                        'User';
      
      if (userDisplay) {
        userDisplay.textContent = displayName;
      }
    }
  }

  async loadDashboardData() {
    try {
      console.log('Loading dashboard data via BalanceService...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Use BalanceService as single source of truth for balances
      if (!window.BalanceService) {
        throw new Error('BalanceService not available');
      }

      const balanceData = await window.BalanceService.getUserBalances(userId);
      
      // Load portfolio data for invested amount and profit
      let portfolioData = null;
      try {
        portfolioData = await this.api.getPortfolioSnapshot(userId);
      } catch (error) {
        console.warn('Failed to load portfolio data:', error);
      }

      // Transform data for dashboard
      const totalBalanceUSD = balanceData.total_usd || 0;
      const investedAmount = portfolioData?.summary?.total_value || 0;
      
      const dashboardData = {
        totalBalance: totalBalanceUSD,
        investedAmount: investedAmount,
        totalProfit: totalBalanceUSD - investedAmount,
        activeSignals: 3 // TODO: Replace with actual signals count when available
      };

      console.log('Dashboard data loaded:', dashboardData);
      this.updateDashboardStats(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Show error to user instead of fallback mock data
      if (window.Notify) {
        window.Notify.error('Failed to load dashboard data. Please try again.');
      }
      this.updateDashboardStats({
        totalBalance: 0,
        investedAmount: 0,
        totalProfit: 0,
        activeSignals: 0
      });
    }
  }

  updateDashboardStats(data) {
    // Update stats with proper formatting
    const totalBalance = document.getElementById('total-balance');
    const investedAmount = document.getElementById('invested-amount');
    const totalProfit = document.getElementById('total-profit');
    const activeSignals = document.getElementById('active-signals');

    if (window.Money) {
      const balanceMoney = window.Money.create(data.totalBalance, 'USD');
      const investedMoney = window.Money.create(data.investedAmount, 'USD');
      const profitMoney = window.Money.create(data.totalProfit, 'USD');

      if (totalBalance) totalBalance.textContent = window.Money.format(balanceMoney);
      if (investedAmount) investedAmount.textContent = window.Money.format(investedMoney);
      if (totalProfit) totalProfit.textContent = window.Money.format(profitMoney);
    } else {
      // Fallback formatting
      if (totalBalance) totalBalance.textContent = `$${data.totalBalance.toFixed(2)}`;
      if (investedAmount) investedAmount.textContent = `$${data.investedAmount.toFixed(2)}`;
      if (totalProfit) totalProfit.textContent = `$${data.totalProfit.toFixed(2)}`;
    }

    if (activeSignals) {
      activeSignals.textContent = data.activeSignals.toString();
    }
  }

  loadRecentActivity() {
    try {
      // Mock activity data
      const activities = [
        {
          type: 'deposit',
          title: 'Deposit Received',
          description: 'USD deposit processed successfully',
          amount: 1000.00,
          currency: 'USD',
          time: '2 hours ago',
          icon: 'deposit'
        },
        {
          type: 'trade',
          title: 'BTC Purchase',
          description: 'Bought 0.025 BTC',
          amount: -500.00,
          currency: 'USD',
          time: '5 hours ago',
          icon: 'trade'
        },
        {
          type: 'signal',
          title: 'New Signal',
          description: 'Buy signal for ETH/USD',
          amount: null,
          currency: null,
          time: '1 day ago',
          icon: 'signal'
        },
        {
          type: 'withdrawal',
          title: 'Withdrawal Processed',
          description: 'Bank transfer completed',
          amount: -200.00,
          currency: 'USD',
          time: '2 days ago',
          icon: 'withdrawal'
        }
      ];

      this.renderRecentActivity(activities);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  }

  renderRecentActivity(activities) {
    const activityList = document.getElementById('recent-activity-list');
    
    if (!activityList) return;

    const icons = {
      deposit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      trade: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
      signal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
      withdrawal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 19 19 12 12 5"></polyline></svg>'
    };

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon ${activity.icon}">
          ${icons[activity.icon] || icons.trade}
        </div>
        <div class="activity-details">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
        ${activity.amount !== null ? `
          <div class="activity-amount ${activity.amount >= 0 ? 'positive' : 'negative'}">
            ${activity.amount >= 0 ? '+' : ''}$${Math.abs(activity.amount).toFixed(2)}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // Cleanup method
  destroy() {
    console.log('Home page cleanup');
  }
}

// Initialize page controller
window.homePage = new HomePage();

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HomePage;
}
