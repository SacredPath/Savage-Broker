/**
 * Portfolio Page Controller
 * Handles portfolio display, P/L calculations, and position management
 * All theme handling goes through AppShell - no duplicate theme systems
 */

class PortfolioPage {
  constructor() {
    this.currentUser = null;
    this.portfolioData = null;
    this.marketPrices = null;
    this.allocationView = 'principal';
    this.chartInstance = null;
    this.priceUpdateInterval = null;
    
    // Get API client
    this.api = window.API || null;

    if (!this.api) {
      console.warn("PortfolioPage: API client not found on load. Retrying in 500ms...");
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
    console.log('Portfolio page initializing...');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupPage());
    } else {
      this.setupPage();
    }
  }

  async setupPage() {
    // Initialize app shell FIRST - this handles all sidebar and theme functionality
    if (window.AppShell) {
      window.AppShell.initShell();
    }
    
    // Setup portfolio-specific UI elements
    this.setupPortfolioUI();
    
    // Check if API client is available
    if (!this.api) {
      console.error('API client not initialized');
      this.renderErrorState('API client not initialized - please refresh the page');
      return;
    }
    
    // Load portfolio data
    try {
      console.log('Loading portfolio data...');
      
      await this.loadPortfolioSnapshot();
      await this.loadMarketPrices();
      
      // Render UI components
      this.renderPortfolio();
      this.renderAllocationChart();
      this.renderPositionsTable();
      this.setupTradingViewWidget();
      this.startPriceUpdates();
      
      console.log('Portfolio page setup complete');
    } catch (error) {
      console.error('Error setting up portfolio page:', error);
      this.showConnectionError(error);
      
      if (window.Notify) {
        window.Notify.error('Failed to load portfolio data');
      }
    }
  }

  setupPortfolioUI() {
    // Setup allocation view toggle buttons
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        if (view) {
          this.setAllocationView(view);
        }
      });
    });
    
    // Setup refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.refreshPrices();
      });
    }
    
    // Set default view
    this.setAllocationView('principal');
  }

  showConnectionError(error) {
    // Create a connection error banner in the main content area
    const portfolioContent = document.querySelector('.portfolio-content');
    if (portfolioContent) {
      portfolioContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--error-color, #ff6b6b);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px; opacity: 0.5;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <h3>Portfolio Data Unavailable</h3>
          <p>Unable to load portfolio information due to connection issues.</p>
          <p style="font-size: 14px; margin-top: 8px; opacity: 0.7;">
            ${error.message || 'Please check your internet connection and try again.'}
          </p>
          <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 16px;">
            Retry Connection
          </button>
        </div>
      `;
    }
  }

  
  async loadPortfolioSnapshot() {
    // INSTANCE VERIFICATION: Check if API client is initialized
    if (!this.api) {
      console.error('API Client not initialized');
      this.renderErrorState('API client not initialized');
      return;
    }

    try {
      console.log('Loading portfolio data via REST API...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load both portfolio data and wallet balances in parallel
      const [portfolioData, walletData] = await Promise.all([
        this.api.getPortfolioSnapshot(userId),
        window.BalanceService.getUserBalances(userId)
      ]);
      
      this.portfolioData = portfolioData;
      this.walletData = walletData;
      
      if (!this.portfolioData || !this.portfolioData.positions) {
        this.renderEmptyState('No portfolio data available');
        return;
      }

      console.log('Portfolio and wallet data loaded successfully:', {
        positions: portfolioData.positions?.length || 0,
        balances: walletData ? Object.keys(walletData).length : 0,
        total_value: portfolioData.summary?.total_value
      });
    } catch (error) {
      console.error('Failed to load portfolio snapshot:', error);
      this.renderErrorState('Failed to load portfolio data: ' + error.message);
    }
  }

  async loadMarketPrices() {
    // INSTANCE VERIFICATION: Check if API client is initialized
    if (!this.api) {
      console.error('API Client not initialized');
      this.marketPrices = {};
      return;
    }

    try {
      console.log('Loading market prices via REST API...');
      
      // Use REST API method instead of Edge Function
      const data = await this.api.getMarketPrices();

      // DEFENSIVE DATA HANDLING: Handle undefined data from API failures
      if (!data) {
        console.warn('Market prices API returned no data');
        this.marketPrices = {};
        return; // Early return instead of throwing TypeError
      }
      
      // Transform price cache data to expected format
      const prices = {};
      data.forEach(item => {
        if (item.symbol && item.price_usd) {
          prices[item.symbol] = item.price_usd;
        }
      });
      
      if (!prices || Object.keys(prices).length === 0) {
        console.warn('Market prices data is empty or unavailable');
        this.marketPrices = {};
        return; // Early return instead of throwing TypeError
      }

      console.log('Market prices loaded successfully:', Object.keys(prices).length, 'symbols');
      
      this.marketPrices = prices;
      this.updateLastUpdated();
    } catch (error) {
      console.error('Failed to load market prices:', error);
      // Set empty object to prevent undefined access errors
      this.marketPrices = {};
    }
  }

  renderEmptyState(message) {
    const portfolioContent = document.querySelector('.portfolio-content');
    if (!portfolioContent) return;
    
    portfolioContent.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
        </svg>
        <h3>No portfolio data</h3>
        <p>${message}</p>
      </div>
    `;
  }

  renderErrorState(message) {
    const portfolioContent = document.querySelector('.portfolio-content');
    if (!portfolioContent) return;
    
    portfolioContent.innerHTML = `
      <div class="error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>Failed to load portfolio</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }

  renderPortfolio() {
    if (!this.portfolioData) return;

    // Update overview cards - Use wallet balance for total value (same as home page)
    if (this.walletData && this.walletData.total_usd !== undefined) {
      document.getElementById('total-value').textContent = this.formatMoney(this.walletData.total_usd);
    } else {
      document.getElementById('total-value').textContent = this.formatMoney(this.portfolioData.total_value);
    }
    
    const totalPl = this.portfolioData.total_pl || 0;
    const totalPlElement = document.getElementById('total-pl');
    totalPlElement.textContent = (totalPl >= 0 ? '+' : '') + '$' + this.formatMoney(Math.abs(totalPl));
    totalPlElement.className = 'overview-value ' + (totalPl >= 0 ? 'profit' : 'loss');
    
    const totalRoi = this.portfolioData.total_roi || 0;
    const totalRoiElement = document.getElementById('total-roi');
    totalRoiElement.textContent = (totalRoi >= 0 ? '+' : '') + totalRoi.toFixed(2) + '%';
    totalRoiElement.className = 'overview-value ' + (totalRoi >= 0 ? 'profit' : 'loss');
    
    document.getElementById('positions-count').textContent = this.portfolioData.positions.length;

    // Update available balance from wallet data (same as home page)
    if (this.walletData && this.walletData.total_usd !== undefined) {
      const availableBalanceElement = document.getElementById('available-balance');
      if (availableBalanceElement) {
        availableBalanceElement.textContent = this.formatMoney(this.walletData.total_usd);
      }
    }
  }

  renderAllocationChart() {
    if (!this.portfolioData) return;

    const chartContainer = document.getElementById('allocation-chart');
    const legendContainer = document.getElementById('allocation-legend');
    
    // Calculate allocation data based on view
    const allocationData = this.calculateAllocation();
    
    // Create donut chart
    this.createDonutChart(chartContainer, allocationData);
    
    // Create legend
    this.createLegend(legendContainer, allocationData);
  }

  calculateAllocation() {
    const positions = this.portfolioData.positions;
    let allocationData = [];

    // Include wallet balances in allocation
    if (this.walletData && this.walletData.balances) {
      Object.entries(this.walletData.balances).forEach(([currency, balance]) => {
        if (balance.total > 0) {
          allocationData.push({
            symbol: currency,
            name: currency === 'USD' ? 'US Dollar' : currency === 'USDT' ? 'Tether' : currency,
            value: balance.total,
            percentage: 0
          });
        }
      });
    }

    // Add positions if available
    switch (this.allocationView) {
      case 'principal':
        positions.forEach(pos => {
          allocationData.push({
            symbol: pos.asset_symbol,
            name: pos.asset_name,
            value: pos.quantity * pos.average_cost,
            percentage: 0
          });
        });
        break;
      case 'equity':
        positions.forEach(pos => {
          allocationData.push({
            symbol: pos.asset_symbol,
            name: pos.asset_name,
            value: pos.market_value,
            percentage: 0
          });
        });
        break;
      case 'both':
        positions.forEach(pos => {
          allocationData.push({
            symbol: pos.asset_symbol,
            name: pos.asset_name,
            principal: pos.quantity * pos.average_cost,
            equity: pos.market_value,
            percentage: 0
          });
        });
        break;
    }

    // Calculate percentages
    const total = allocationData.reduce((sum, item) => {
      return sum + (item.equity ? item.equity : item.value);
    }, 0);

    allocationData.forEach(item => {
      if (item.equity) {
        item.percentage = (item.equity / total) * 100;
      } else {
        item.percentage = (item.value / total) * 100;
      }
    });

    return allocationData;
  }

  createDonutChart(container, data) {
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (data.length === 0) {
      container.innerHTML = `
        <div class="chart-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
          </svg>
          <p>No allocation data available</p>
        </div>
      `;
      return;
    }

    // Create canvas for chart
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    container.appendChild(canvas);

    // Draw donut chart
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    const innerRadius = 60;

    // Colors for different assets
    const colors = [
      '#00D4AA', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#3B82F6', '#EC4899', '#6B7280'
    ];

    let currentAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      
      // Draw outer arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      currentAngle += sliceAngle;
    });

    // Draw center text
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (this.allocationView === 'both') {
      ctx.fillText('Principal', centerX, centerY - 10);
      ctx.fillText('& Equity', centerX, centerY + 10);
    } else {
      ctx.fillText(this.allocationView === 'principal' ? 'Principal' : 'Equity', centerX, centerY);
    }
  }

  createLegend(container, data) {
    if (!container) return;

    container.innerHTML = '';

    const colors = [
      '#00D4AA', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#3B82F6', '#EC4899', '#6B7280'
    ];

    data.forEach((item, index) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const color = document.createElement('div');
      color.className = 'legend-color';
      color.style.backgroundColor = colors[index % colors.length];
      
      const label = document.createElement('div');
      label.className = 'legend-label';
      label.textContent = item.symbol + ' - ' + item.name;
      
      let valueText = '';
      if (item.equity) {
        valueText = '$' + this.formatMoney(item.equity) + ' (' + item.percentage.toFixed(1) + '%)';
      } else {
        valueText = '$' + this.formatMoney(item.value) + ' (' + item.percentage.toFixed(1) + '%)';
      }
      
      const value = document.createElement('div');
      value.className = 'legend-value';
      value.textContent = valueText;
      
      legendItem.appendChild(color);
      legendItem.appendChild(label);
      legendItem.appendChild(value);
      container.appendChild(legendItem);
    });
  }

  renderPositionsTable() {
    if (!this.portfolioData) return;

    const tbody = document.getElementById('positions-tbody');
    if (!tbody) return;

    // Check if there are positions
    if (!this.portfolioData.positions || this.portfolioData.positions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No active positions. Start investing to see your positions here.</td></tr>';
      return;
    }

    tbody.innerHTML = this.portfolioData.positions.map(position => {
      // Transform position data to match expected field names
      const transformedPosition = {
        asset_name: position.asset_name || position.investment_tiers?.name || 'Unknown Asset',
        asset_symbol: position.asset_symbol || position.investment_tiers?.symbol || 'UNK',
        quantity: position.quantity || position.amount || 0,
        average_cost: position.average_cost || position.principal_usd / (position.quantity || 1) || 0,
        current_price: position.current_price || position.current_price_usd || position.principal_usd / (position.quantity || 1) || 0,
        market_value: position.market_value || position.amount || position.principal_usd || 0,
        unrealized_pl: position.unrealized_pl || position.accrued_roi || 0,
        unrealized_pl_percent: position.unrealized_pl_percent || (position.accrued_roi && position.principal_usd ? (position.accrued_roi / position.principal_usd) * 100 : 0)
      };

      const priceData = this.marketPrices[transformedPosition.asset_symbol];
      const priceChange = priceData ? priceData.change : 0;
      const priceChangePercent = priceData ? priceData.change_percent : 0;
      
      return '<tr>' +
        '<td>' +
          '<div class="asset-name">' + transformedPosition.asset_name + '</div>' +
          '<div class="asset-symbol">' + transformedPosition.asset_symbol + '</div>' +
        '</td>' +
        '<td>' + this.formatQuantity(transformedPosition.quantity, transformedPosition.asset_symbol) + '</td>' +
        '<td>$' + this.formatMoney(transformedPosition.average_cost) + '</td>' +
        '<td>' +
          '<div class="price-info">' +
            '<div class="current-price">$' + this.formatMoney(transformedPosition.current_price) + '</div>' +
            '<div class="price-change ' + (priceChange >= 0 ? 'positive' : 'negative') + '">' +
              (priceChange >= 0 ? '+' : '') + '$' + this.formatMoney(priceChange) + ' (' + (priceChangePercent >= 0 ? '+' : '') + priceChangePercent.toFixed(2) + '%)' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>$' + this.formatMoney(transformedPosition.market_value) + '</td>' +
        '<td class="' + (transformedPosition.unrealized_pl >= 0 ? 'profit-positive' : 'profit-negative') + '">' +
          (transformedPosition.unrealized_pl >= 0 ? '+' : '') + '$' + this.formatMoney(Math.abs(transformedPosition.unrealized_pl)) +
        '</td>' +
        '<td class="' + (transformedPosition.unrealized_pl_percent >= 0 ? 'profit-positive' : 'profit-negative') + '">' +
          (transformedPosition.unrealized_pl_percent >= 0 ? '+' : '') + transformedPosition.unrealized_pl_percent.toFixed(2) + '%' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  setupTradingViewWidget() {
    const container = document.getElementById('tradingview-widget-container');
    if (!container) return;

    // Create TradingView widget for major indices
    container.innerHTML = '<div class="tradingview-widget-container"><div id="tradingview_widget"></div></div>';

    // TRADINGVIEW 403 FIX: Wrap widget initialization in its own try/catch
    setTimeout(() => {
      try {
        if (window.TradingView) {
          // DEFENSIVE CONFIG: Ensure all required properties are valid
          const config = {
            container_id: "tradingview_widget",
            width: "100%",
            height: 400,
            symbol: "BINANCE:BTCUSDT",
            interval: "D",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#f1f3f6",
            enable_publishing: false,
            allow_symbol_change: true,
            details: true,
            hotlist: true,
            calendar: false,
            studies: [],
            show_popup_button: true,
            popup_width: "1000",
            popup_height: "650",
            disabled_features: ["use_localstorage_for_settings"],
            enabled_features: []
          };
          
          // Validate configuration before creating widget
          if (!config.container_id || !config.symbol) {
            console.error('Invalid TradingView configuration: missing required properties');
            container.innerHTML = '<div class="widget-unavailable">TradingView widget configuration error</div>';
            return;
          }
          
          new window.TradingView.widget(config);
        } else {
          console.warn('TradingView widget not available');
          container.innerHTML = '<div class="widget-unavailable">TradingView widget unavailable</div>';
        }
      } catch (tradingViewError) {
        console.error('TradingView widget initialization failed:', tradingViewError);
        container.innerHTML = '<div class="widget-unavailable">TradingView widget temporarily unavailable</div>';
      }
    }, 1000);
  }

  setAllocationView(view) {
    this.allocationView = view;

    // Update toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('active');
      }
    });

    // Re-render chart
    this.renderAllocationChart();
  }

  async refreshPrices() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<div class="loading-spinner" style="display: inline-block; margin-right: 8px;"></div>Refreshing...';
    }

    try {
      // Force refresh prices
      const { data, error } = await this.api.fetchEdge('prices_refresh', {
        method: 'POST'
      });

      if (error) {
        throw error;
      }

      // Reload portfolio data with updated prices
      await this.loadPortfolioSnapshot();
      await this.loadMarketPrices();
      
      // Re-render everything
      this.renderPortfolio();
      this.renderAllocationChart();
      this.renderPositionsTable();

      if (window.Notify) {
        window.Notify.success('Prices refreshed successfully!');
      }
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      if (window.Notify) {
        window.Notify.error('Failed to refresh prices');
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Prices';
      }
    }
  }

  startPriceUpdates() {
    // Clear any existing interval
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
    
    // Update prices every 5 minutes
    this.priceUpdateInterval = setInterval(async () => {
      try {
        await this.loadMarketPrices();
        this.renderPositionsTable();
        this.updateLastUpdated();
      } catch (error) {
        console.error('Failed to update prices:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  updateLastUpdated() {
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated && this.portfolioData) {
      const date = new Date(this.portfolioData.last_updated);
      lastUpdated.textContent = 'Last updated: ' + date.toLocaleString();
    }
  }

  formatQuantity(quantity, symbol) {
    // Format quantity based on asset type
    if (symbol === 'BTC' || symbol === 'ETH') {
      return quantity.toFixed(8);
    } else if (symbol === 'USDT') {
      return quantity.toFixed(2);
    } else {
      return quantity.toFixed(4);
    }
  }

  formatMoney(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '$0.00';
    }
    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Cleanup method
  destroy() {
    console.log('Portfolio page cleanup');
    
    // Clear price update interval
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
  }
}

// Initialize page controller
window.portfolioPage = new PortfolioPage();

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PortfolioPage;
}
