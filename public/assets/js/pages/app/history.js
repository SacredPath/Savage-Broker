/**
 * History Page Controller
 * Handles unified timeline with all transaction types, filtering, search, and CSV export
 */

class HistoryPage {
  constructor() {
    this.currentUser = null;
    this.historyData = [];
    this.filteredData = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.filters = {
      search: '',
      eventType: '',
      status: '',
      startDate: '',
      endDate: ''
    };
    
    // Get API client
    this.api = window.API || null;

    if (!this.api) {
      console.warn("HistoryPage: API client not found on load. Retrying in 500ms...");
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
    console.log('History page initializing...');
    
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
      await this.loadHistoryData();
      
      // Setup UI
      this.setupEventListeners();
      this.setDefaultDateRange();
      this.applyFilters();
      
      console.log('History page setup complete');
    } catch (error) {
      console.error('Error setting up history page:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load history data');
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

  async loadHistoryData() {
    try {
      console.log('Loading history data via REST API...');
      
      // Get current user ID
      const userId = await this.api.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Load unified history from database (combine transactions, withdrawals, and positions)
      const historyData = [];

      // Load transactions (deposits)
      try {
        const { data: transactions } = await this.api.supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (transactions) {
          transactions.forEach(tx => {
            historyData.push({
              id: tx.id,
              type: tx.type === 'deposit' ? 'deposit' : 'transaction',
              description: tx.type === 'deposit' ? 'Deposit' : 'Transaction',
              amount: tx.amount,
              currency: tx.currency,
              status: tx.status,
              created_at: tx.created_at
            });
          });
        }
      } catch (error) {
        console.warn('Failed to load transactions:', error.message);
      }

      // Load withdrawals
      try {
        const { data: withdrawals } = await this.api.supabase
          .from('withdrawals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (withdrawals) {
          withdrawals.forEach(wd => {
            historyData.push({
              id: wd.id,
              type: 'withdrawal',
              description: 'Withdrawal',
              amount: wd.amount,
              currency: wd.currency,
              status: wd.status,
              created_at: wd.created_at
            });
          });
        }
      } catch (error) {
        console.warn('Failed to load withdrawals:', error.message);
      }

      // Load positions
      try {
        const { data: positions } = await this.api.supabase
          .from('positions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (positions) {
          positions.forEach(pos => {
            historyData.push({
              id: pos.id,
              type: 'position',
              description: `Position: ${pos.asset_symbol}`,
              amount: pos.principal_usd,
              currency: 'USD',
              status: pos.status,
              created_at: pos.created_at
            });
          });
        }
      } catch (error) {
        console.warn('Failed to load positions:', error.message);
      }

      // Sort by date
      historyData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      this.historyData = historyData;
      console.log('History data loaded:', this.historyData.length, 'items');
    } catch (error) {
      console.error('Failed to load history data:', error);
      if (window.Notify) {
        window.Notify.error('Failed to load history data. Please try again.');
      }
      throw error;
    }
  }

  
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.applyFilters();
      });
    }

    // Event type filter
    const eventFilter = document.getElementById('event-filter');
    if (eventFilter) {
      eventFilter.addEventListener('change', (e) => {
        this.filters.eventType = e.target.value;
        this.applyFilters();
      });
    }

    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.applyFilters();
      });
    }

    // Date range filters
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    
    if (startDate) {
      startDate.addEventListener('change', (e) => {
        this.filters.startDate = e.target.value;
        this.applyFilters();
      });
    }
    
    if (endDate) {
      endDate.addEventListener('change', (e) => {
        this.filters.endDate = e.target.value;
        this.applyFilters();
      });
    }
  }

  setDefaultDateRange() {
    const endDate = document.getElementById('end-date');
    const startDate = document.getElementById('start-date');
    
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    if (endDate) {
      endDate.value = today.toISOString().split('T')[0];
    }
    
    if (startDate) {
      startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    
    this.filters.startDate = thirtyDaysAgo.toISOString().split('T')[0];
    this.filters.endDate = today.toISOString().split('T')[0];
  }

  applyFilters() {
    let filtered = [...this.historyData];

    // Apply search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        event.description.toLowerCase().includes(searchTerm) ||
        event.amount.toString().includes(searchTerm) ||
        event.currency.toLowerCase().includes(searchTerm)
      );
    }

    // Apply event type filter
    if (this.filters.eventType) {
      filtered = filtered.filter(event => event.event_type === this.filters.eventType);
    }

    // Apply status filter
    if (this.filters.status) {
      filtered = filtered.filter(event => event.status === this.filters.status);
    }

    // Apply date range filter
    if (this.filters.startDate) {
      const start = new Date(this.filters.startDate);
      filtered = filtered.filter(event => new Date(event.created_at) >= start);
    }

    if (this.filters.endDate) {
      const end = new Date(this.filters.endDate);
      end.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(event => new Date(event.created_at) <= end);
    }

    this.filteredData = filtered;
    this.renderTimeline();
    this.updateStats();
  }

  renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    if (this.filteredData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
          </svg>
          <h3>No transactions found</h3>
          <p>Try adjusting your filters or search terms</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredData.map(event => this.formatEventRow(event)).join('');
  }

  formatEventRow(event) {
    const icon = this.getEventIcon(event.event_type);
    const details = this.getEventDetails(event);
    
    return `
      <div class="timeline-item">
        <div class="timeline-icon ${icon.class}">
          ${icon.svg}
        </div>
        <div class="timeline-content">
          <div class="timeline-header-row">
            <div class="timeline-title">${event.title}</div>
            <div class="timeline-status status-${event.status}">${event.status}</div>
          </div>
          <div class="timeline-description">${event.description}</div>
          <div class="timeline-details">
            ${details}
          </div>
          ${this.getEventActions(event)}
        </div>
      </div>
    `;
  }

  getEventIcon(eventType) {
    const icons = {
      deposit: {
        class: 'icon-deposit',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
      },
      withdrawal: {
        class: 'icon-withdrawal',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 19 19 12 12 5"></polyline></svg>'
      },
      conversion: {
        class: 'icon-conversion',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>'
      },
      claim: {
        class: 'icon-claim',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>'
      },
      upgrade: {
        class: 'icon-upgrade',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path><path d="M12 22V8"></path><path d="M8 12H16"></path></svg>'
      },
      purchase: {
        class: 'icon-purchase',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'
      },
      bonus: {
        class: 'icon-bonus',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path><path d="M16 12h-4"></path><path d="M12 16h-4"></path><path d="M8 12h4"></path><path d="M12 8h4"></path></svg>'
      },
      referral: {
        class: 'icon-referral',
        svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7.5" r="1"></circle><path d="M21 16V8a2 2 0 0 0-2-2h-4"></path><path d="M3 12V6a2 2 0 0 1 2-2h4"></path></svg>'
      }
    };

    return icons[eventType] || icons.deposit;
  }

  getEventDetails(event) {
    let details = [];
    
    // Amount
    if (event.amount) {
      const amountClass = event.amount >= 0 ? 'positive' : 'negative';
      details.push(`
        <div class="detail-item">
          <div class="detail-label">Amount</div>
          <div class="detail-value ${amountClass}">
            ${event.amount >= 0 ? '+' : ''}${event.currency} ${this.formatMoney(event.amount, event.currency === 'USDT' ? 6 : 2)}
          </div>
        </div>
      `);
    }

    // Converted amount (for conversions)
    if (event.converted_amount) {
      details.push(`
        <div class="detail-item">
          <div class="detail-label">Converted To</div>
          <div class="detail-value">
            ${event.converted_currency} ${this.formatMoney(event.converted_amount, 2)}
          </div>
        </div>
      `);
    }

    // Rate (for conversions)
    if (event.rate) {
      details.push(`
        <div class="detail-item">
          <div class="detail-label">Rate</div>
          <div class="detail-value">${event.rate}</div>
        </div>
      `);
    }

    // Created date
    details.push(`
      <div class="detail-item">
        <div class="detail-label">Created</div>
        <div class="detail-value">${new Date(event.created_at).toLocaleDateString()}</div>
      </div>
    `);

    // Completed date
    if (event.completed_at) {
      details.push(`
        <div class="detail-item">
          <div class="detail-label">Completed</div>
          <div class="detail-value">${new Date(event.completed_at).toLocaleDateString()}</div>
        </div>
      `);
    }

    // Event-specific details
    switch (event.event_type) {
      case 'deposit':
        if (event.from_address) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">From</div>
              <div class="detail-value" style="font-family: monospace; font-size: 12px;">${event.from_address}</div>
            </div>
          `);
        }
        break;
      case 'withdrawal':
        if (event.bank_name) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Bank</div>
              <div class="detail-value">${event.bank_name}</div>
            </div>
          `);
        }
        break;
      case 'claim':
        if (event.tier_name) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Position</div>
              <div class="detail-value">${event.tier_name}</div>
            </div>
          `);
        }
        break;
      case 'upgrade':
        if (event.from_tier && event.to_tier) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Upgrade</div>
              <div class="detail-value">${event.from_tier} → ${event.to_tier}</div>
            </div>
          `);
        }
        break;
      case 'purchase':
        if (event.signal_name) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Signal</div>
              <div class="detail-value">${event.signal_name}</div>
            </div>
          `);
        }
        if (event.access_duration) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${event.access_duration} days</div>
            </div>
          `);
        }
        break;
      case 'bonus':
        if (event.bonus_type) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Bonus Type</div>
              <div class="detail-value">${event.bonus_type}</div>
            </div>
          `);
        }
        break;
      case 'referral':
        if (event.referred_user) {
          details.push(`
            <div class="detail-item">
              <div class="detail-label">Referred User</div>
              <div class="detail-value">${event.referred_user}</div>
            </div>
          `);
        }
        break;
    }

    return details.join('');
  }

  getEventActions(event) {
    let actions = [];

    // Add action links based on event type
    switch (event.event_type) {
      case 'deposit':
        if (event.transaction_hash) {
          actions.push(`<a href="#" class="action-link">View Transaction</a>`);
        }
        break;
      case 'withdrawal':
        if (event.status === 'pending') {
          actions.push(`<a href="#" class="action-link">Track Status</a>`);
        }
        break;
      case 'purchase':
        if (event.signal_id) {
          actions.push(`<a href="/app/signal_detail.html?id=${event.signal_id}" class="action-link">View Signal</a>`);
        }
        break;
      case 'claim':
        if (event.position_id) {
          actions.push(`<a href="/app/positions.html" class="action-link">View Position</a>`);
        }
        break;
    }

    return actions.length > 0 ? `
      <div class="timeline-actions">
        ${actions.join('')}
      </div>
    ` : '';
  }

  updateStats() {
    const totalCount = document.getElementById('total-count');
    const filteredCount = document.getElementById('filtered-count');
    
    if (totalCount) {
      totalCount.textContent = `${this.historyData.length} transactions`;
    }
    
    if (filteredCount) {
      const count = this.filteredData.length;
      filteredCount.textContent = `${count} filtered${count !== this.historyData.length ? ' (' + Math.round((count / this.historyData.length) * 100) + '%)' : ''}`;
    }
  }

  clearFilters() {
    // Reset all filters
    this.filters = {
      search: '',
      eventType: '',
      status: '',
      startDate: '',
      endDate: ''
    };

    // Reset UI
    document.getElementById('search-input').value = '';
    document.getElementById('event-filter').value = '';
    document.getElementById('status-filter').value = '';
    
    // Set default date range
    this.setDefaultDateRange();
    
    // Apply filters
    this.applyFilters();
  }

  async exportCSV() {
    try {
      // Create CSV content
      const headers = [
        'Date', 'Event Type', 'Title', 'Description', 'Status', 
        'Amount', 'Currency', 'Created At', 'Completed At'
      ];

      const rows = this.filteredData.map(event => [
        new Date(event.created_at).toLocaleDateString(),
        event.event_type,
        event.title,
        event.description,
        event.status,
        event.amount || '',
        event.currency || '',
        event.created_at,
        event.completed_at || ''
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transaction_history_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      window.Notify.success('History exported successfully!');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      window.Notify.error('Failed to export history');
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
    console.log('History page cleanup');
  }
}

// Initialize page controller
window.historyPage = new HistoryPage();

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryPage;
}
