<script lang="ts">
  import { onMount } from 'svelte';

  export let visible: boolean = false;
  export let onClose: () => void;
  export let onSave: (settings: Settings) => void;

  export interface Settings {
    mcpServerUrl: string;
    apiToken: string;
    autoConnect: boolean;
  }

  let settings: Settings = {
    mcpServerUrl: 'http://127.0.0.1:3000',
    apiToken: '',
    autoConnect: true,
  };

  let originalSettings: Settings;
  let hasChanges: boolean = false;

  onMount(() => {
    originalSettings = { ...settings };
  });

  $: hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  function handleSave() {
    onSave(settings);
    originalSettings = { ...settings };
    hasChanges = false;
  }

  function handleCancel() {
    settings = { ...originalSettings };
    hasChanges = false;
    onClose();
  }

  function handleReset() {
    settings = {
      mcpServerUrl: 'http://127.0.0.1:3000',
      apiToken: '',
      autoConnect: true,
    };
  }
</script>

{#if visible}
  <div class="settings-panel">
    <div class="settings-panel__overlay" on:click={handleCancel}></div>

    <div class="settings-panel__dialog">
      <div class="settings-panel__header">
        <h2 class="settings-panel__title">
          <svg class="settings-panel__icon"><use xlink:href="#iconSettings"></use></svg>
          MCP 插件设置
        </h2>
        <button class="settings-panel__close" on:click={handleCancel}>
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div class="settings-panel__content">
        <div class="settings-section">
          <h3 class="settings-section__title">连接配置</h3>

          <div class="settings-field">
            <label class="settings-field__label" for="mcpServerUrl">
              MCP 服务器地址
              <span class="settings-field__required">*</span>
            </label>
            <input
              id="mcpServerUrl"
              type="text"
              class="settings-field__input"
              bind:value={settings.mcpServerUrl}
              placeholder="http://127.0.0.1:3000"
            />
            <div class="settings-field__hint">
              MCP 服务器的 HTTP 地址（HTTP 模式将在 Phase 4 实现）
            </div>
          </div>

          <div class="settings-field">
            <label class="settings-field__label" for="apiToken">
              API Token
            </label>
            <input
              id="apiToken"
              type="password"
              class="settings-field__input"
              bind:value={settings.apiToken}
              placeholder="可选：思源笔记 API Token"
            />
            <div class="settings-field__hint">
              如果思源笔记启用了 API 认证，需要填写此项
            </div>
          </div>

          <div class="settings-field">
            <label class="settings-field__checkbox">
              <input
                type="checkbox"
                bind:checked={settings.autoConnect}
              />
              <span>启动时自动连接</span>
            </label>
            <div class="settings-field__hint">
              插件加载时自动连接 MCP 服务器
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section__title">关于</h3>
          <div class="settings-about">
            <p>思源 MCP 插件 v0.1.0</p>
            <p>通过 MCP 协议连接 AI Agent 和思源笔记</p>
            <p>
              <a href="https://github.com/guozao-ex/siyuan-mcp" target="_blank">
                GitHub 仓库
              </a>
            </p>
          </div>
        </div>
      </div>

      <div class="settings-panel__footer">
        <button
          class="settings-panel__button settings-panel__button--secondary"
          on:click={handleReset}
        >
          重置为默认
        </button>
        <div class="settings-panel__actions">
          <button
            class="settings-panel__button settings-panel__button--secondary"
            on:click={handleCancel}
          >
            取消
          </button>
          <button
            class="settings-panel__button settings-panel__button--primary"
            on:click={handleSave}
            disabled={!hasChanges}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .settings-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;

    &__overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    }

    &__dialog {
      position: relative;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: var(--b3-theme-background);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
    }

    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--b3-theme-border);
    }

    &__title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    &__icon {
      width: 20px;
      height: 20px;
    }

    &__close {
      padding: 4px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--b3-theme-on-background);
      opacity: 0.6;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }

    &__content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    &__footer {
      display: flex;
      justify-content: space-between;
      padding: 16px 20px;
      border-top: 1px solid var(--b3-theme-border);
    }

    &__actions {
      display: flex;
      gap: 8px;
    }

    &__button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;

      &--primary {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);

        &:hover:not(:disabled) {
          opacity: 0.9;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      &--secondary {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        border: 1px solid var(--b3-theme-border);

        &:hover {
          background: var(--b3-theme-surface-light);
        }
      }
    }
  }

  .settings-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    &__title {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }
  }

  .settings-field {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    &__label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--b3-theme-on-background);
    }

    &__required {
      color: var(--b3-theme-error);
    }

    &__input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--b3-theme-border);
      border-radius: 4px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      font-size: 14px;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }
    }

    &__hint {
      margin-top: 4px;
      font-size: 12px;
      color: var(--b3-theme-on-background-light);
      opacity: 0.7;
    }

    &__checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;

      input[type="checkbox"] {
        cursor: pointer;
      }

      span {
        font-size: 14px;
        color: var(--b3-theme-on-background);
      }
    }
  }

  .settings-about {
    font-size: 14px;
    line-height: 1.6;
    color: var(--b3-theme-on-background);

    p {
      margin: 8px 0;
    }

    a {
      color: var(--b3-theme-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
</style>
