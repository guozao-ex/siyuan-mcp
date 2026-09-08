<script lang="ts">
  import { onMount } from 'svelte';

  export let visible: boolean = false;
  export let onClose: () => void;

  interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }

  let messages: Message[] = [];
  let inputText: string = '';
  let isLoading: boolean = false;
  let messagesContainer: HTMLDivElement;

  onMount(() => {
    // Add welcome message
    addMessage('assistant', '你好！我是 AI 助手，可以帮你处理笔记。有什么我可以帮助你的吗？');
  });

  function addMessage(role: 'user' | 'assistant', content: string) {
    messages = [...messages, { role, content, timestamp: Date.now() }];

    // Scroll to bottom after message is added
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  async function sendMessage() {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    inputText = '';

    addMessage('user', userMessage);
    isLoading = true;

    try {
      // TODO: Implement MCP API call in Change 14
      // Simulate AI response for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      addMessage('assistant', '这个功能即将推出，敬请期待！');
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('assistant', '抱歉，发送消息失败。请稍后重试。');
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if visible}
  <div class="ai-panel">
    <div class="ai-panel__header">
      <div class="ai-panel__title">
        <svg class="ai-panel__icon"><use xlink:href="#iconAI"></use></svg>
        <span>AI 对话</span>
      </div>
      <button class="ai-panel__close" on:click={onClose}>
        <svg><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>

    <div class="ai-panel__messages" bind:this={messagesContainer}>
      {#each messages as message (message.timestamp)}
        <div class="message message--{message.role}">
          <div class="message__avatar">
            {#if message.role === 'user'}
              <svg><use xlink:href="#iconUser"></use></svg>
            {:else}
              <svg><use xlink:href="#iconAI"></use></svg>
            {/if}
          </div>
          <div class="message__content">
            <div class="message__text">{message.content}</div>
            <div class="message__time">{formatTime(message.timestamp)}</div>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="message message--assistant">
          <div class="message__avatar">
            <svg><use xlink:href="#iconAI"></use></svg>
          </div>
          <div class="message__content">
            <div class="message__loading">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="ai-panel__input">
      <textarea
        class="ai-panel__textarea"
        bind:value={inputText}
        on:keydown={handleKeydown}
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        rows="3"
        disabled={isLoading}
      ></textarea>
      <button
        class="ai-panel__send"
        on:click={sendMessage}
        disabled={!inputText.trim() || isLoading}
      >
        <svg><use xlink:href="#iconSend"></use></svg>
      </button>
    </div>
  </div>
{/if}

<style lang="scss">
  .ai-panel {
    position: fixed;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
    width: 400px;
    max-height: 80vh;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    z-index: 999;

    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--b3-theme-border);
    }

    &__title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
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
        width: 16px;
        height: 16px;
      }
    }

    &__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    &__input {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--b3-theme-border);
    }

    &__textarea {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--b3-theme-border);
      border-radius: 4px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      font-size: 14px;
      resize: none;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &__send {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover:not(:disabled) {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }

  .message {
    display: flex;
    gap: 12px;

    &--user {
      flex-direction: row-reverse;
    }

    &__avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--b3-theme-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg {
        width: 18px;
        height: 18px;
        color: var(--b3-theme-on-surface);
      }
    }

    &__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    &__text {
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      line-height: 1.5;
      word-wrap: break-word;
    }

    &--user &__text {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }

    &__time {
      font-size: 12px;
      color: var(--b3-theme-on-background-light);
      opacity: 0.6;
    }

    &--user &__time {
      text-align: right;
    }

    &__loading {
      padding: 10px 14px;
      display: flex;
      gap: 4px;

      span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--b3-theme-on-surface);
        opacity: 0.4;
        animation: loading 1.4s infinite;

        &:nth-child(2) {
          animation-delay: 0.2s;
        }

        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }
    }
  }

  @keyframes loading {
    0%, 60%, 100% {
      opacity: 0.4;
    }
    30% {
      opacity: 1;
    }
  }
</style>
