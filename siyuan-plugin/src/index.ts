import { Plugin, Menu } from 'siyuan';
import AiPanel from './components/AiPanel.svelte';
import Settings from './components/Settings.svelte';
import { createMcpClient, McpClient } from './api/mcp';
import type { Settings as PluginSettings } from './components/Settings.svelte';
import './styles/main.css';

const STORAGE_KEY = 'mcp-plugin-settings';

export default class McpPlugin extends Plugin {
  private isMobile: boolean;
  private mcpClient: McpClient | null = null;
  private aiPanelComponent: AiPanel | null = null;
  private settingsComponent: Settings | null = null;
  private aiPanelVisible: boolean = false;
  private settingsVisible: boolean = false;
  private settings: PluginSettings = {
    mcpServerUrl: 'http://127.0.0.1:3000',
    apiToken: '',
    autoConnect: true,
  };

  async onload() {
    this.isMobile = this.app.isMobile;

    console.log('MCP Plugin loaded');

    // Load settings
    await this.loadSettings();

    // Initialize MCP client
    if (this.settings.autoConnect) {
      await this.initMcpClient();
    }

    // Expose API to components
    this.exposeApi();

    // Add topbar icon
    this.addTopBar();

    // Add right-click menu items
    this.addBlockMenu();

    // Add settings menu
    this.addSettingsMenu();
  }

  onunload() {
    console.log('MCP Plugin unloaded');

    // Cleanup components
    if (this.aiPanelComponent) {
      this.aiPanelComponent.$destroy();
    }
    if (this.settingsComponent) {
      this.settingsComponent.$destroy();
    }
  }

  /**
   * Add topbar icon to open AI panel
   */
  private addTopBar() {
    const topBarElement = this.addTopBar({
      icon: 'iconAI',
      title: this.i18n.openAiPanel,
      position: 'right',
      callback: () => {
        this.openAiPanel();
      },
    });
  }

  /**
   * Add block-level right-click menu
   */
  private addBlockMenu() {
    this.protyle.on('block-menu', (detail) => {
      const menu = detail.menu as Menu;
      const blockId = detail.blockElements[0]?.getAttribute('data-node-id');

      if (!blockId) return;

      // Add separator
      menu.addSeparator();

      // Add AI actions
      menu.addItem({
        icon: 'iconSparkles',
        label: this.i18n.summarize,
        click: () => {
          this.summarizeBlock(blockId);
        },
      });

      menu.addItem({
        icon: 'iconEdit',
        label: this.i18n.continueWriting,
        click: () => {
          this.continueWriting(blockId);
        },
      });

      menu.addItem({
        icon: 'iconRefresh',
        label: this.i18n.improveText,
        click: () => {
          this.improveText(blockId);
        },
      });
    });
  }

  /**
   * Initialize MCP client
   */
  private async initMcpClient() {
    try {
      this.mcpClient = createMcpClient({
        serverUrl: this.settings.mcpServerUrl,
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
   * Expose API to Svelte components
   */
  private exposeApi() {
    (window as any).mcpPluginApi = {
      sendMessage: async (message: string) => {
        if (!this.mcpClient) {
          throw new Error('MCP client not initialized');
        }

        // Search for relevant context
        try {
          const searchResult = await this.mcpClient.searchNotes(message, {
            pageSize: 3,
          });

          // Build context from search results
          let context = '';
          if (searchResult.blocks && searchResult.blocks.length > 0) {
            context = '\n\n相关笔记：\n';
            searchResult.blocks.forEach((block: any) => {
              context += `- ${block.path}: ${block.content}\n`;
            });
          }

          // For now, return a simple response with context
          // In future, this will call actual AI model
          return `我收到了你的消息："${message}"${context}\n\n（实际 AI 对话功能将在后续版本中实现）`;
        } catch (error) {
          console.error('Failed to process message:', error);
          throw new Error('处理消息失败');
        }
      },
    };
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
      this.settingsComponent.$set({ visible: true });
    }
  }

  /**
   * Open AI chat panel
   */
  private async openAiPanel() {
    this.aiPanelVisible = true;

    if (!this.aiPanelComponent) {
      this.aiPanelComponent = new AiPanel({
        target: document.body,
        props: {
          visible: true,
          onClose: () => {
            this.aiPanelVisible = false;
            if (this.aiPanelComponent) {
              this.aiPanelComponent.$set({ visible: false });
            }
          },
        },
      });
    } else {
      this.aiPanelComponent.$set({ visible: true });
    }
  }

  /**
   * Summarize block content
   */
  private async summarizeBlock(blockId: string) {
    if (!this.mcpClient) {
      this.showMessage('请先在设置中配置 MCP 服务器', 3000, 'error');
      return;
    }

    try {
      this.showMessage(this.i18n.processing);

      // Read block content
      const blockData = await this.mcpClient.readBlock(blockId);
      const content = blockData.markdown || blockData.content;

      if (!content) {
        this.showMessage('块内容为空', 3000, 'error');
        return;
      }

      // Generate summary prompt (Phase 4 will implement actual AI call)
      const summary = `摘要：${content.substring(0, 100)}...`;

      // Append summary to block
      await this.mcpClient.appendBlock(blockId, `\n\n**AI 摘要：** ${summary}`);

      this.showMessage('摘要已生成');
    } catch (error) {
      console.error('Failed to summarize:', error);
      this.showMessage(this.i18n.operationFailed, 3000, 'error');
    }
  }

  /**
   * Continue writing from block
   */
  private async continueWriting(blockId: string) {
    if (!this.mcpClient) {
      this.showMessage('请先在设置中配置 MCP 服务器', 3000, 'error');
      return;
    }

    try {
      this.showMessage(this.i18n.processing);

      // Read block content
      const blockData = await this.mcpClient.readBlock(blockId);
      const content = blockData.markdown || blockData.content;

      if (!content) {
        this.showMessage('块内容为空', 3000, 'error');
        return;
      }

      // Generate continuation (Phase 4 will implement actual AI call)
      const continuation = '这是 AI 续写的内容，实际功能将在 Phase 4 实现。';

      // Append continuation
      await this.mcpClient.appendBlock(blockId, `\n\n${continuation}`);

      this.showMessage('续写已完成');
    } catch (error) {
      console.error('Failed to continue writing:', error);
      this.showMessage(this.i18n.operationFailed, 3000, 'error');
    }
  }

  /**
   * Improve block text
   */
  private async improveText(blockId: string) {
    if (!this.mcpClient) {
      this.showMessage('请先在设置中配置 MCP 服务器', 3000, 'error');
      return;
    }

    try {
      this.showMessage(this.i18n.processing);

      // Read block content
      const blockData = await this.mcpClient.readBlock(blockId);
      const content = blockData.markdown || blockData.content;

      if (!content) {
        this.showMessage('块内容为空', 3000, 'error');
        return;
      }

      // Generate improved version (Phase 4 will implement actual AI call)
      const improved = `改进后：${content}（实际 AI 改进功能将在 Phase 4 实现）`;

      // Update block with improved text
      await this.mcpClient.updateBlock(blockId, improved);

      this.showMessage('文字已改进');
    } catch (error) {
      console.error('Failed to improve text:', error);
      this.showMessage(this.i18n.operationFailed, 3000, 'error');
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
    if (type === 'error') {
      this.addTopBar({
        icon: 'iconClose',
        title: message,
        position: 'right',
      });
    }

    // Use SiYuan's showMessage API
    (window as any).siyuan?.showMessage?.(message, timeout, type);
  }
}
