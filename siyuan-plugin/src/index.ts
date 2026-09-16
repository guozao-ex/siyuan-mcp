import { Plugin, getFrontend, showMessage } from 'siyuan';
import Settings from './components/Settings.svelte';
import { createMcpClient, McpClient } from './api/mcp';
import { DEFAULT_SETTINGS, type PluginSettings } from './types';
import './styles/main.css';

const STORAGE_KEY = 'mcp-plugin-settings';

export default class McpPlugin extends Plugin {
  /**
   * 当前是否运行在移动端。由 onload() 依据 getFrontend() 赋值，
   * 供后续 UI 适配使用（移动端不适合固定宽度的浮动面板）。
   */
  private isMobile: boolean = false;
  private mcpClient: McpClient | null = null;
  private settingsComponent: Settings | null = null;
  private settingsVisible: boolean = false;
  private settings: PluginSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    // siyuan 包导出的 App 类型只声明了 plugins / appId，并没有 isMobile 属性；
    // 判断当前前端环境应使用 SDK 导出的 getFrontend()。
    const frontend = getFrontend();
    this.isMobile = frontend === 'mobile' || frontend === 'browser-mobile';

    console.log('MCP Plugin loaded');

    // Load settings
    await this.loadSettings();

    // Initialize MCP client
    if (this.settings.autoConnect) {
      await this.initMcpClient();
    }

    // Add topbar icon（用于快速打开插件设置）
    this.addTopBarIcon();

    // Add settings menu
    this.addSettingsMenu();
  }

  onunload() {
    console.log('MCP Plugin unloaded');

    // Cleanup components
    if (this.settingsComponent) {
      this.settingsComponent.$destroy();
    }
  }

  /**
   * 顶栏图标：打开插件设置。
   *
   * 注：本插件**不内置 AI 对话面板** —— 对话交给 DSH / Claude Desktop / Cursor
   * 等外部 Agent 通过 MCP 接入。插件只负责配置，以及编辑器内的块级 AI 操作。
   *
   * 注意：本方法**不能**命名为 addTopBar —— 那会覆盖基类的
   * Plugin.addTopBar(options): HTMLElement，而方法体内部又会调用
   * this.addTopBar({...})，结果是无限递归（Maximum call stack size exceeded）。
   * 这里改用独立名字，并显式走 super。
   */
  private addTopBarIcon() {
    super.addTopBar({
      // 注意：思源内置图标里没有 iconAI（已用 document.getElementById 在运行时核对过，
      // 553 个内置 symbol 中不存在），用它会导致顶栏图标显示为空白。
      icon: 'iconBrain',
      title: this.i18n.openPluginSettings,
      position: 'right',
      callback: () => {
        this.openSettings();
      },
    });
  }

  /**
   * Initialize MCP client
   */
  private async initMcpClient() {
    try {
      this.mcpClient = createMcpClient({
        serverUrl: this.settings.mcpServerUrl,
        token: this.settings.apiToken,
      });
      // Test connection
      const isConnected = await this.mcpClient.checkConnection();
      if (isConnected) {
        console.log('MCP client initialized and connected');
        this.showMessage('MCP 服务器已连接');
      } else {
        console.warn('MCP client initialized but server not reachable');
        this.showMessage('MCP 服务器无法访问', 3000, 'error');
      }
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      this.showMessage('MCP 客户端初始化失败', 3000, 'error');
    }
  }


  /**
   * Add settings menu
   */
  private addSettingsMenu() {
    this.addIcons(`<symbol id="iconMcpSettings" viewBox="0 0 32 32">
      <path d="M16 10a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>
      <path d="M27.5 13h-3.2a9.4 9.4 0 0 0-.8-2l2.3-2.3a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0L19.3 6.8a9.4 9.4 0 0 0-2-.8V3.5a1.5 1.5 0 0 0-1.5-1.5h-3a1.5 1.5 0 0 0-1.5 1.5V6a9.4 9.4 0 0 0-2 .8L7 4.5a1.5 1.5 0 0 0-2.1 0l-2.1 2.1a1.5 1.5 0 0 0 0 2.1l2.3 2.3a9.4 9.4 0 0 0-.8 2H1.5a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5h2.8a9.4 9.4 0 0 0 .8 2l-2.3 2.3a1.5 1.5 0 0 0 0 2.1l2.1 2.1a1.5 1.5 0 0 0 2.1 0l2.3-2.3a9.4 9.4 0 0 0 2 .8v2.5a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5V26a9.4 9.4 0 0 0 2-.8l2.3 2.3a1.5 1.5 0 0 0 2.1 0l2.1-2.1a1.5 1.5 0 0 0 0-2.1l-2.3-2.3a9.4 9.4 0 0 0 .8-2h2.8a1.5 1.5 0 0 0 1.5-1.5v-3a1.5 1.5 0 0 0-1.5-1.5z"/>
    </symbol>`);

    this.addCommand({
      langKey: 'settings',
      hotkey: '',
      callback: () => {
        this.openSettings();
      },
    });
  }

  /**
   * Open settings dialog
   */
  private openSettings() {
    this.settingsVisible = true;

    if (!this.settingsComponent) {
      this.settingsComponent = new Settings({
        target: document.body,
        props: {
          visible: true,
          // 传入当前真实设置的副本，否则面板只会显示组件内的默认值
          initialSettings: { ...this.settings },
          onClose: () => {
            this.settingsVisible = false;
            if (this.settingsComponent) {
              this.settingsComponent.$set({ visible: false });
            }
          },
          onSave: async (newSettings: PluginSettings) => {
            this.settings = newSettings;
            await this.saveSettings();
            await this.initMcpClient();
            this.showMessage('设置已保存');
            this.settingsVisible = false;
            if (this.settingsComponent) {
              this.settingsComponent.$set({ visible: false });
            }
          },
        },
      });
    } else {
      // 每次打开都同步最新的设置（副本），面板据此重置编辑态
      this.settingsComponent.$set({
        visible: true,
        initialSettings: { ...this.settings },
      });
    }
  }

  /**
   * Load plugin settings
   */
  private async loadSettings() {
    try {
      const data = await this.loadData(STORAGE_KEY);
      if (data) {
        this.settings = { ...this.settings, ...data };
      }
      console.log('Settings loaded:', this.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Save plugin settings
   */
  private async saveSettings() {
    try {
      await this.saveData(STORAGE_KEY, this.settings);
      console.log('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Show message to user
   */
  private showMessage(message: string, timeout = 2000, type: 'info' | 'error' = 'info') {
    // 思源在 siyuan 模块中导出了 showMessage 函数：
    //   export function showMessage(text: string, timeout?: number, type?: "info" | "error", id?: string): void
    // 不要再往顶栏 addTopBar 塞图标：那会无限累积且无法移除，且 addTopBar 的
    // callback 是必填参数。
    showMessage(message, timeout, type);
  }
}
