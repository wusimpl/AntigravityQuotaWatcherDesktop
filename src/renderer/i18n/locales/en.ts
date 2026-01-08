/**
 * English translations
 */
import type { Translations } from './zh-CN';

export const en: Translations = {
  // Common
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    close: 'Close',
    retry: 'Retry',
    refresh: 'Refresh',
    settings: 'Settings',
    about: 'About',
    exit: 'Exit',
    minimize: 'Minimize',
    seconds: 's',
    percent: '%',
  },

  // Widget
  widget: {
    initializing: 'Initializing',
    noModelSelected: 'No Model Selected',
    appName: 'AG Quota Watcher',
  },

  // Settings page
  settings: {
    title: 'AG Quota Settings',

    // Widget settings
    widgetSection: 'Widget',
    showWidget: 'Show Widget',
    showWidgetDesc: 'Display quota monitor widget on desktop',
    widgetSize: 'Widget Size',
    waveSpeed: 'Wave Speed',
    waveSpeedStill: 'Still',
    waveSpeedSlow: 'Slow',
    waveSpeedMedium: 'Medium',
    waveSpeedFast: 'Fast',
    waveHeight: 'Wave Height',
    waveHeightLevel1: 'Ripple',
    waveHeightLevel2: 'Small',
    waveHeightLevel3: 'Medium',
    waveHeightLevel4: 'Large',
    waveHeightLevel5: 'Huge',
    showResetTime: 'Show Reset Time',
    showResetTimeDesc: 'Display quota reset countdown in widget',
    showModelName: 'Show Model Name',
    showModelNameDesc: 'Display model name in widget',
    showPercentage: 'Show Percentage',
    showPercentageDesc: 'Display remaining quota percentage in widget',

    // Account management
    accountSection: 'Account Management',
    email: 'Email',
    tier: 'Tier',
    action: 'Action',
    confirmDelete: 'Confirm Delete',
    addAccount: '+ Add Account',

    // Model configuration
    modelSection: 'Model Display',
    selectedCount: 'Selected {count}/2 models',
    noModelData: 'No model data, please login first',
    noModels: 'No model data',
    remainingQuota: 'Remaining',
    resetTime: 'Reset Time',
    alias: 'Alias',
    aliasPlaceholder: 'Alias',
    refreshModels: 'Refresh Model List',

    // Display settings
    displaySection: 'Display Settings',
    pollingInterval: 'Refresh Interval',
    warningThreshold: 'Warning Threshold',
    criticalThreshold: 'Critical Threshold',

    // System settings
    systemSection: 'System Settings',
    autoStart: 'Start at Login',
    notifications: 'Notifications',
    language: 'Language',
    languageAuto: 'System Default',
    exportLogs: 'Export Logs',
    exportLogsDesc: 'Export application logs for troubleshooting',
    exportLogsButton: 'Export',
    exportLogsSuccess: 'Logs exported successfully',
    exportLogsFailed: 'Export failed',

    // Version info
    appTitle: 'AG Quota Watcher Desktop',
    appDesc: 'Monitor Google Antigravity AI model quota',
    author: 'Author: @wusimpl',
  },

  // Login dialog
  login: {
    title: 'Google Account Login',
    preparing: 'Preparing login...',
    openingBrowser: 'Opening browser...',
    waitingAuth: 'Waiting for authorization...',
    exchangingToken: 'Completing login...',
    success: 'Login successful!',
    failed: 'Login failed',
    cancelled: 'Cancelled',
    preparing2: 'Preparing...',
    browserNotOpened: 'Browser not opened? Copy the link and open it manually',
    copyLink: 'Copy Link',
    copied: 'Copied',
  },

  // Account selector
  account: {
    notLoggedIn: 'Not logged in',
    noAccounts: 'No accounts',
    addAccount: 'Add Account',
  },

  // Reset timer
  resetTimer: {
    nextReset: 'Next reset',
    reset: 'Reset',
    daysLater: '{days}d',
    hoursMinutes: '{hours}h {minutes}m',
    minutes: '{minutes}m',
  },

  // Tray menu
  tray: {
    showWidget: 'Show Widget',
    hideWidget: 'Hide Widget',
    refreshNow: 'Refresh Now',
    settings: 'Settings',
    about: 'About',
    exit: 'Exit',
    aboutTitle: 'About AG Quota Watcher Desktop',
    aboutMessage: 'AG Quota Watcher Desktop',
    aboutDetail: 'Version: {version}\n\nDesktop app for monitoring Google Antigravity AI model quota\n\nAuthor: @wusimpl',
  },

  // Error messages
  errors: {
    loadFailed: 'Load failed',
    saveFailed: 'Save failed',
    loginFailed: 'Login failed',
    networkError: 'Network error',
    unknownError: 'Unknown error',
  },
};
