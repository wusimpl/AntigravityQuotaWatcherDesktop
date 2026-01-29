/**
 * 简体中文翻译
 */
export const zhCN = {
  // 通用
  common: {
    loading: '加载中...',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    close: '关闭',
    retry: '重试',
    refresh: '刷新',
    settings: '设置',
    about: '关于',
    exit: '退出',
    minimize: '最小化',
    seconds: '秒',
    percent: '%',
  },

  // 悬浮窗
  widget: {
    initializing: '初始化中',
    noModelSelected: '未选择模型',
    appName: 'AG Quota Watcher',
    clickToSwitch: '点击切换到主显示区',
  },

  // 设置页面
  settings: {
    title: 'AG Quota 设置',

    // 悬浮窗设置
    widgetSection: '悬浮窗',
    showWidget: '显示悬浮窗',
    showWidgetDesc: '在桌面显示配额监控小组件',
    widgetSize: '悬浮窗大小',
    waveSpeed: '水波速度',
    waveSpeedStill: '静止',
    waveSpeedSlow: '缓慢',
    waveSpeedMedium: '中等',
    waveSpeedFast: '快速',
    waveHeight: '波形高度',
    waveHeightLevel1: '微波',
    waveHeightLevel2: '小浪',
    waveHeightLevel3: '中浪',
    waveHeightLevel4: '大浪',
    waveHeightLevel5: '巨浪',
    showResetTime: '显示重置时间',
    showResetTimeDesc: '在悬浮窗中显示配额重置倒计时',
    showModelName: '显示模型名称',
    showModelNameDesc: '在悬浮窗中显示模型名称',
    showPercentage: '显示剩余额度百分比',
    showPercentageDesc: '在悬浮窗中显示剩余额度百分比',
    miniBarTextColor: '迷你指示条文字颜色',
    miniBarTextColorDesc: '设置次级模型指示条的文字颜色',
    miniBarTextColorWhite: '白色',
    miniBarTextColorBlack: '黑色',

    // 账户管理
    accountSection: '账户管理',
    email: '邮箱',
    tier: '级别',
    action: '操作',
    confirmDelete: '确认删除',
    addAccount: '+ 添加账户',

    // 模型配置
    modelSection: '模型显示开关',
    selectedCount: '已选 {count}/5 个模型',
    noModelData: '暂无模型数据，请先登录账户',
    noModels: '暂无模型数据',
    remainingQuota: '剩余配额',
    resetTime: '重置时间',
    alias: '别名',
    aliasPlaceholder: '别名',
    refreshModels: '刷新模型列表',

    // 显示设置
    displaySection: '显示设置',
    pollingInterval: '刷新频率',
    warningThreshold: '警告阈值',
    criticalThreshold: '紧急阈值',

    // 系统设置
    systemSection: '系统设置',
    autoStart: '开机自启',
    notifications: '系统通知',
    language: '语言',
    languageAuto: '跟随系统',
    exportLogs: '导出日志',
    exportLogsDesc: '导出应用日志用于问题诊断',
    exportLogsButton: '导出',
    exportLogsSuccess: '日志已导出',
    exportLogsFailed: '导出失败',

    // 代理设置
    proxyEnabled: '启用代理',
    proxyEnabledDesc: '开启后使用代理访问 Google API',
    proxyUrl: '代理地址',
    proxyUrlDesc: '留空则使用系统代理',
    proxyUrlPlaceholder: '如 http://127.0.0.1:7890',
    proxyUrlSystemProxy: '系统代理',
    proxyUrlNoProxy: '无代理',

    // 版本信息
    appTitle: 'AG Quota Watcher Desktop',
    appDesc: '监控 Google Antigravity AI 模型配额',
    author: '作者: @wusimpl',
  },

  // 登录弹窗
  login: {
    title: 'Google 账户登录',
    preparing: '正在准备登录...',
    openingBrowser: '正在打开浏览器...',
    waitingAuth: '等待授权中...',
    exchangingToken: '正在完成登录...',
    success: '登录成功！',
    failed: '登录失败',
    cancelled: '已取消',
    preparing2: '准备中...',
    browserNotOpened: '浏览器没有打开？请手动复制链接到浏览器中打开',
    copyLink: '复制链接',
    copied: '已复制',
  },

  // 账户选择器
  account: {
    notLoggedIn: '未登录',
    noAccounts: '暂无账户',
    addAccount: '添加账户',
  },

  // 重置时间
  resetTimer: {
    nextReset: '下次重置',
    reset: '已重置',
    daysLater: '{days}天后',
    hoursMinutes: '{hours}小时{minutes}分',
    minutes: '{minutes}分钟',
  },

  // 托盘菜单
  tray: {
    showWidget: '显示悬浮窗',
    hideWidget: '隐藏悬浮窗',
    refreshNow: '立即刷新',
    settings: '设置',
    about: '关于',
    exit: '退出',
    aboutTitle: '关于 AG Quota Watcher Desktop',
    aboutMessage: 'AG Quota Watcher Desktop',
    aboutDetail: '版本: {version}\n\n监控 Google Antigravity AI 模型配额的桌面应用\n\n作者: @wusimpl',
  },

  // 错误信息
  errors: {
    loadFailed: '加载失败',
    saveFailed: '保存失败',
    loginFailed: '登录失败',
    networkError: '网络错误',
    unknownError: '未知错误',
  },
};

export type Translations = typeof zhCN;
