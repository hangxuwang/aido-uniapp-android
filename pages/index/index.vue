<template>
  <view class="page">
    <view class="bg bg-left"></view>
    <view class="bg bg-right"></view>

    <view class="topbar">
      <view class="plus-btn" @click="createConversation">+</view>
      <view class="topbar-center">
        <text class="brand">AIDO</text>
        <text class="brand-sub">{{ topModeText }}</text>
      </view>
      <StatusPill :text="statusText" :kind="statusKind" />
    </view>

    <view class="workspace">
      <view v-if="activeTab === 'chat'" class="panel chat-panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">{{ currentConversation.title }}</text>
            <text class="panel-desc">{{ conversationSummary }}</text>
          </view>
          <view class="count-badge">{{ currentConversation.messages.length }} 条</view>
        </view>

        <scroll-view
          class="message-list"
          scroll-y
          scroll-with-animation
          :scroll-into-view="scrollIntoView"
        >
          <view
            v-for="message in currentConversation.messages"
            :id="message.id"
            :key="message.id"
            class="message-row"
            :class="message.role"
          >
            <view class="avatar">{{ roleMap[message.role] || '?' }}</view>
            <view class="bubble">
              <view class="bubble-head">
                <text class="role-name">{{ roleLabelMap[message.role] || message.role }}</text>
                <text v-if="streamingMessageId === message.id" class="streaming-badge">输出中</text>
              </view>
              <text class="bubble-text">{{ message.content }}</text>
            </view>
          </view>
          <view id="chat-bottom-anchor" class="bottom-anchor"></view>
        </scroll-view>

        <view class="composer">
          <view class="composer-head">
            <text class="composer-title">{{ composerModeText }}</text>
            <text class="composer-tip">{{ composerTipText }}</text>
          </view>
          <textarea
            v-model="draft"
            class="composer-input"
            maxlength="-1"
            :placeholder="composerPlaceholder"
          />
          <view class="composer-actions">
            <text class="footer-status">{{ footerStatusText }}</text>
            <view class="composer-btns">
              <button v-if="busy" class="stop-btn" @click="stopGeneration">停止</button>
              <button class="send-btn" :disabled="busy" @click="sendMessage">
                {{ busy ? '发送中...' : '发送' }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view v-if="activeTab === 'history'" class="panel history-panel">
        <view class="panel-head">
          <view>
            <text class="panel-title">历史对话</text>
            <text class="panel-desc">点击某条历史会话即可切回对话继续聊。</text>
          </view>
          <view class="count-badge">{{ state.conversations.length }} 个</view>
        </view>

        <scroll-view class="history-list" scroll-y>
          <view
            v-for="session in state.conversations"
            :key="session.id"
            class="history-item"
            :class="{ active: session.id === state.activeConversationId }"
            @click="openConversationFromHistory(session.id)"
          >
            <view class="history-main">
              <text class="history-title">{{ session.title }}</text>
              <text class="history-preview">{{ session.preview || '还没有消息' }}</text>
            </view>
            <text
              v-if="state.conversations.length > 1"
              class="history-delete"
              @click.stop="removeConversation(session.id)"
            >
              删除
            </text>
          </view>
        </scroll-view>
      </view>

      <view v-if="activeTab === 'config'" class="panel config-panel">
        <view class="config-intro">
          <text class="config-eyebrow">CONFIG</text>
          <text class="config-title">连接中心</text>
          <text class="config-desc">
            AI 是必填项，SSH 是可选项。只配 AI 也可以聊天，配上 SSH 后才支持服务器操作。
          </text>
        </view>

        <scroll-view class="config-scroll" scroll-y>
          <view class="config-card">
            <view class="config-head">
              <view>
                <text class="config-card-title">AI 模型</text>
                <text class="config-card-desc">支持 OpenAI 兼容格式，例如官方、OneAPI、NewAPI。</text>
              </view>
              <text class="config-count">{{ state.aiProfiles.length }} 个</text>
            </view>

            <view class="form-grid">
              <input v-model="aiForm.name" class="field" placeholder="配置名称，例如 OpenAI 主账号" />
              <input v-model="aiForm.baseUrl" class="field" placeholder="BaseURL，例如 https://api.openai.com/v1" />
              <input v-model="aiForm.apiKey" class="field" password placeholder="ApiKey" />
              <input v-model="aiForm.model" class="field" placeholder="模型名称，例如 gpt-4o-mini" />
            </view>

            <view class="action-row">
              <button class="solid-btn accent" @click="saveAiProfile">保存 AI</button>
            </view>

            <view class="saved-grid">
              <view
                v-for="item in state.aiProfiles"
                :key="item.id"
                class="saved-card"
                :class="{ active: item.id === state.activeAiProfileId }"
                @click="pickAi(item.id)"
              >
                <text class="saved-delete" @click.stop="removeAiProfile(item.id)">删除</text>
                <text class="saved-title">{{ item.name || item.model }}</text>
                <text class="saved-line">{{ item.model }}</text>
                <text class="saved-line url">{{ item.baseUrl }}</text>
                <text class="saved-flag">{{ item.id === state.activeAiProfileId ? '当前启用' : '点击设为当前' }}</text>
              </view>
            </view>
          </view>

          <view class="config-card dark">
            <view class="config-head">
              <view>
                <text class="config-card-title">SSH 服务器</text>
                <text class="config-card-desc">不配置也能聊天，配置后 AI 才能在服务器上执行命令。</text>
              </view>
              <text class="config-count">{{ state.sshProfiles.length }} 个</text>
            </view>

            <view class="form-grid">
              <input v-model="sshForm.name" class="field light" placeholder="配置名称，例如 生产服务器" />
              <input v-model="sshForm.host" class="field light" placeholder="IP 或域名" />
              <input v-model="sshForm.port" class="field light" type="number" placeholder="端口，默认 22" />
              <input v-model="sshForm.username" class="field light" placeholder="用户名" />
              <input v-model="sshForm.password" class="field light" password placeholder="密码" />
            </view>

            <view class="action-row two">
              <button class="solid-btn deep" @click="saveSshProfile">保存 SSH</button>
              <button class="line-btn" @click="quickTestSsh">测试连接</button>
            </view>

            <view class="saved-grid">
              <view
                v-for="item in state.sshProfiles"
                :key="item.id"
                class="saved-card dark-card"
                :class="{ active: item.id === state.activeSshProfileId }"
                @click="pickSsh(item.id)"
              >
                <text class="saved-delete" @click.stop="removeSshProfile(item.id)">删除</text>
                <text class="saved-title">{{ item.name || item.host }}</text>
                <text class="saved-line">{{ item.username }}@{{ item.host }}:{{ item.port || 22 }}</text>
                <text class="saved-flag">{{ item.id === state.activeSshProfileId ? '当前启用' : '点击设为当前' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="tabbar">
      <view class="tab-item" :class="{ active: activeTab === 'history' }" @click="switchTab('history')">
        <text class="tab-text">历史对话</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'chat' }" @click="switchTab('chat')">
        <text class="tab-text">对话</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'config' }" @click="switchTab('config')">
        <text class="tab-text">配置</text>
      </view>
    </view>
  </view>
</template>

<script>
import StatusPill from '../../components/StatusPill.vue';
import { createId, loadState, saveState, upsertById } from '../../utils/storage';
import { runAgentChat } from '../../services/agent';
import { testSsh } from '../../services/nativeSsh';

function buildWelcomeMessage() {
  return {
    id: createId('msg'),
    role: 'assistant',
    content:
      '我是 AIDO。你可以直接和我聊天；如果配置了 SSH，我也可以帮你在服务器上执行命令并结合结果继续处理。'
  };
}

function createConversationRecord(title = '新对话') {
  return {
    id: createId('conv'),
    title,
    preview: '还没有消息',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [buildWelcomeMessage()]
  };
}

function ensureStateShape(state) {
  if (!Array.isArray(state.sshProfiles)) state.sshProfiles = [];
  if (!Array.isArray(state.aiProfiles)) state.aiProfiles = [];
  if (!Array.isArray(state.conversations)) state.conversations = [];

  if (!state.conversations.length) {
    const session = createConversationRecord('默认对话');
    state.conversations = [session];
    state.activeConversationId = session.id;
  }

  if (!state.activeConversationId) {
    state.activeConversationId = state.conversations[0].id;
  }

  const activeExists = state.conversations.some((item) => item.id === state.activeConversationId);
  if (!activeExists) {
    state.activeConversationId = state.conversations[0].id;
  }

  return state;
}

export default {
  components: {
    StatusPill
  },
  data() {
    const state = ensureStateShape(loadState());
    saveState(state);

    return {
      state,
      activeTab: 'chat',
      draft: '',
      busy: false,
      currentStopSignal: null,
      statusText: '待命中',
      statusKind: 'idle',
      scrollIntoView: '',
      scrollAnchorId: 'chat-bottom-anchor',
      streamingMessageId: '',
      roleMap: {
        user: '我',
        assistant: 'AI',
        tool: '工'
      },
      roleLabelMap: {
        user: '你',
        assistant: 'AIDO',
        tool: '工具'
      },
      sshForm: {
        id: '',
        name: '',
        host: '',
        port: '22',
        username: '',
        password: ''
      },
      aiForm: {
        id: '',
        name: '',
        baseUrl: '',
        apiKey: '',
        model: ''
      }
    };
  },
  computed: {
    activeSsh() {
      return this.state.sshProfiles.find((item) => item.id === this.state.activeSshProfileId) || null;
    },
    activeAi() {
      return this.state.aiProfiles.find((item) => item.id === this.state.activeAiProfileId) || null;
    },
    currentConversation() {
      return (
        this.state.conversations.find((item) => item.id === this.state.activeConversationId) ||
        this.state.conversations[0]
      );
    },
    topModeText() {
      if (this.activeAi && this.activeSsh) return 'AI + SSH 已就绪';
      if (this.activeAi) return 'AI 已就绪';
      return '请先配置 AI';
    },
    conversationSummary() {
      if (this.activeAi && this.activeSsh) return '当前可以聊天，也可以让 AI 使用 SSH 操作服务器。';
      if (this.activeAi) return '当前为 AI 单聊模式，还没有启用服务器操作。';
      return '还没有可用的 AI 配置，请先去配置页保存一个模型。';
    },
    composerModeText() {
      if (this.activeAi && this.activeSsh) return '对话 + 服务器模式';
      if (this.activeAi) return '纯 AI 对话模式';
      return '未配置 AI';
    },
    composerTipText() {
      if (this.activeAi && this.activeSsh) return '你可以让 AI 执行命令、检查日志、下载文件到服务器。';
      if (this.activeAi) return '你现在可以先聊天，之后再补 SSH 配置。';
      return '先在配置页填写 BaseURL、ApiKey 和模型名。';
    },
    composerPlaceholder() {
      if (this.activeAi && this.activeSsh) {
        return '例如：帮我登录服务器检查日志，或者下载某个文件到服务器。';
      }
      if (this.activeAi) {
        return '例如：帮我写脚本、解释报错、规划部署步骤。';
      }
      return '请先配置 AI 后再发送消息。';
    },
    footerStatusText() {
      if (this.activeAi && this.activeSsh) return 'AI 与 SSH 都已生效';
      if (this.activeAi) return 'AI 已生效，SSH 未启用';
      return '当前没有可用的 AI 配置';
    }
  },
  mounted() {
    this.scrollToConversationBottom();
  },
  methods: {
    persistState() {
      saveState(this.state);
    },
    persistConversation() {
      const session = this.currentConversation;
      if (!session) return;

      session.updatedAt = Date.now();
      const meaningful = session.messages.filter((item) => item.content && item.content.trim());
      const firstUser = meaningful.find((item) => item.role === 'user');
      const lastMessage = meaningful[meaningful.length - 1];

      if (firstUser) {
        session.title = firstUser.content.slice(0, 16) || session.title;
      }
      session.preview = lastMessage ? lastMessage.content.slice(0, 28) : '还没有消息';
      this.persistState();
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'chat') {
        this.$nextTick(() => {
          this.scrollToConversationBottom();
        });
      }
    },
    appendMessage(role, content) {
      const message = {
        id: createId('msg'),
        role,
        content
      };
      this.currentConversation.messages.push(message);
      this.queueScrollToBottom();
      this.persistConversation();
      return message;
    },
    queueScrollToBottom() {
      this.scrollIntoView = '';
      this.$nextTick(() => {
        this.scrollIntoView = this.scrollAnchorId;
      });
    },
    scrollToConversationBottom() {
      const session = this.currentConversation;
      if (!session || !session.messages.length) {
        this.scrollIntoView = '';
        return;
      }
      this.queueScrollToBottom();
    },
    createConversation() {
      if (this.busy) {
        uni.showToast({ title: '正在回复中，暂时不能新建', icon: 'none' });
        return;
      }
      const session = createConversationRecord();
      this.state.conversations.unshift(session);
      this.state.activeConversationId = session.id;
      this.activeTab = 'chat';
      this.draft = '';
      this.persistState();
      this.$nextTick(() => {
        this.scrollToConversationBottom();
      });
    },
    switchConversation(id) {
      if (this.busy || id === this.state.activeConversationId) return;
      this.state.activeConversationId = id;
      this.draft = '';
      this.persistState();
      this.$nextTick(() => {
        this.scrollToConversationBottom();
      });
    },
    openConversationFromHistory(id) {
      this.switchConversation(id);
      this.activeTab = 'chat';
    },
    removeConversation(id) {
      if (this.busy) {
        uni.showToast({ title: '请先停止当前任务', icon: 'none' });
        return;
      }
      if (this.state.conversations.length <= 1) {
        uni.showToast({ title: '至少保留一个会话', icon: 'none' });
        return;
      }
      const nextList = this.state.conversations.filter((item) => item.id !== id);
      this.state.conversations = nextList;
      if (this.state.activeConversationId === id) {
        this.state.activeConversationId = nextList[0].id;
        this.activeTab = 'chat';
      }
      this.persistState();
    },
    buildNormalizedSshForm() {
      const port = parseInt(this.sshForm.port, 10);
      return {
        id: this.sshForm.id || '',
        name: (this.sshForm.name || '').trim(),
        host: (this.sshForm.host || '').trim(),
        port: Number.isNaN(port) || port <= 0 ? '22' : String(port),
        username: (this.sshForm.username || '').trim(),
        password: this.sshForm.password || ''
      };
    },
    saveSshProfile() {
      const normalized = this.buildNormalizedSshForm();
      if (!normalized.host || !normalized.username || !normalized.password) {
        uni.showToast({ title: '请补全 SSH 配置', icon: 'none' });
        return;
      }
      const item = Object.assign({}, normalized, {
        id: normalized.id || createId('ssh')
      });
      this.state.sshProfiles = upsertById(this.state.sshProfiles, item);
      this.state.activeSshProfileId = item.id;
      this.persistState();
      this.sshForm = {
        id: '',
        name: '',
        host: '',
        port: '22',
        username: '',
        password: ''
      };
      this.statusText = 'SSH 已生效';
      this.statusKind = 'idle';
      uni.showToast({ title: 'SSH 已保存并启用', icon: 'success' });
    },
    removeSshProfile(id) {
      if (this.busy) {
        uni.showToast({ title: '请先停止当前任务', icon: 'none' });
        return;
      }
      const nextProfiles = this.state.sshProfiles.filter((item) => item.id !== id);
      this.state.sshProfiles = nextProfiles;
      if (this.state.activeSshProfileId === id) {
        this.state.activeSshProfileId = nextProfiles.length ? nextProfiles[0].id : '';
      }
      this.persistState();
      this.statusText = this.state.activeSshProfileId ? 'SSH 已更新' : 'SSH 已清空';
      this.statusKind = 'idle';
      uni.showToast({ title: 'SSH 已删除', icon: 'success' });
    },
    async quickTestSsh() {
      const candidate = this.sshForm.host
        ? this.buildNormalizedSshForm()
        : this.state.sshProfiles.find((item) => item.id === this.state.activeSshProfileId);

      if (!candidate) {
        uni.showToast({ title: '请先保存一个 SSH 配置', icon: 'none' });
        return;
      }
      if (!candidate.host || !candidate.username || !candidate.password) {
        uni.showToast({ title: 'SSH 配置不完整', icon: 'none' });
        return;
      }

      uni.showLoading({ title: '测试连接中...' });
      try {
        const result = await testSsh(candidate);
        uni.hideLoading();
        const ok = result.code === 0 && /AIDO_SSH_OK/.test(result.stdout || '');
        uni.showModal({
          title: ok ? '连接成功' : '连接失败',
          content: ok ? 'SSH 连接测试通过。' : result.stderr || result.stdout || '没有拿到返回结果',
          showCancel: false
        });
      } catch (error) {
        uni.hideLoading();
        uni.showModal({
          title: '连接异常',
          content: error.message,
          showCancel: false
        });
      }
    },
    pickSsh(id) {
      this.state.activeSshProfileId = id;
      this.persistState();
      this.statusText = 'SSH 已切换';
      this.statusKind = 'idle';
      uni.showToast({ title: 'SSH 已切换', icon: 'success' });
    },
    saveAiProfile() {
      const baseUrl = (this.aiForm.baseUrl || '').trim();
      const apiKey = (this.aiForm.apiKey || '').trim();
      const model = (this.aiForm.model || '').trim();
      const name = (this.aiForm.name || '').trim();

      if (!baseUrl || !apiKey || !model) {
        uni.showToast({ title: '请补全 AI 配置', icon: 'none' });
        return;
      }

      const item = {
        id: this.aiForm.id || createId('ai'),
        name,
        baseUrl,
        apiKey,
        model
      };
      this.state.aiProfiles = upsertById(this.state.aiProfiles, item);
      this.state.activeAiProfileId = item.id;
      this.persistState();
      this.aiForm = {
        id: '',
        name: '',
        baseUrl: '',
        apiKey: '',
        model: ''
      };
      this.statusText = 'AI 已生效';
      this.statusKind = 'idle';
      uni.showToast({ title: 'AI 已保存并启用', icon: 'success' });
    },
    removeAiProfile(id) {
      if (this.busy) {
        uni.showToast({ title: '请先停止当前任务', icon: 'none' });
        return;
      }
      const nextProfiles = this.state.aiProfiles.filter((item) => item.id !== id);
      this.state.aiProfiles = nextProfiles;
      if (this.state.activeAiProfileId === id) {
        this.state.activeAiProfileId = nextProfiles.length ? nextProfiles[0].id : '';
      }
      this.persistState();
      this.statusText = this.state.activeAiProfileId ? 'AI 已更新' : 'AI 已清空';
      this.statusKind = this.state.activeAiProfileId ? 'idle' : 'error';
      uni.showToast({ title: 'AI 已删除', icon: 'success' });
    },
    pickAi(id) {
      this.state.activeAiProfileId = id;
      this.persistState();
      this.statusText = 'AI 已切换';
      this.statusKind = 'idle';
      uni.showToast({ title: 'AI 已切换', icon: 'success' });
    },
    stopGeneration() {
      if (!this.busy || !this.currentStopSignal) return;
      this.currentStopSignal.stopped = true;
      if (typeof this.currentStopSignal.abort === 'function') {
        this.currentStopSignal.abort();
      }
      this.statusText = '已停止';
      this.statusKind = 'idle';
    },
    async sendMessage() {
      if (this.busy) return;

      const text = this.draft.trim();
      if (!text) {
        uni.showToast({ title: '请输入消息内容', icon: 'none' });
        return;
      }
      if (!this.activeAi) {
        uni.showToast({ title: '请先配置 AI', icon: 'none' });
        this.activeTab = 'config';
        return;
      }

      this.draft = '';
      const userMessage = this.appendMessage('user', text);
      const assistantMessage = this.appendMessage('assistant', '');
      this.streamingMessageId = assistantMessage.id;
      this.busy = true;
      this.currentStopSignal = {
        stopped: false,
        abort: null
      };
      this.statusText = this.activeSsh ? 'AI 正在联动服务器...' : 'AI 正在输出...';
      this.statusKind = 'working';

      try {
        const history = this.currentConversation.messages
          .filter((item) => item.id !== userMessage.id && item.id !== assistantMessage.id)
          .map((item) => ({
            role: item.role,
            content: item.content
          }));

        await runAgentChat({
          aiProfile: this.activeAi,
          sshProfile: this.activeSsh,
          history,
          userText: text,
          stopSignal: this.currentStopSignal,
          onAssistantDelta: (delta) => {
            assistantMessage.content += delta;
            this.queueScrollToBottom();
          },
          onToolStatus: (toolText) => {
            this.statusText = toolText || '正在执行服务器命令...';
          }
        });

        if (!assistantMessage.content) {
          assistantMessage.content = '这次没有返回可显示的正文，你可以再试一次或检查模型配置。';
        }
        this.statusText = this.currentStopSignal && this.currentStopSignal.stopped ? '已停止' : '已完成';
        this.statusKind = 'idle';
        this.persistConversation();
      } catch (error) {
        if (error && error.message === 'REQUEST_ABORTED') {
          if (!assistantMessage.content.trim()) {
            assistantMessage.content = '本次输出已手动停止。';
          }
          this.statusText = '已停止';
          this.statusKind = 'idle';
        } else {
          assistantMessage.content = `请求失败：${error.message}`;
          this.statusText = '请求失败';
          this.statusKind = 'error';
        }
        this.persistConversation();
      } finally {
        this.streamingMessageId = '';
        this.busy = false;
        this.currentStopSignal = null;
      }
    }
  }
};
</script>

<style scoped lang="scss">
.page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #f5eee5 0%, #f1ece4 100%);
}

.bg {
  position: absolute;
  border-radius: 50%;
  filter: blur(30rpx);
  opacity: 0.72;
}

.bg-left {
  top: -90rpx;
  left: -50rpx;
  width: 260rpx;
  height: 260rpx;
  background: rgba(214, 119, 72, 0.18);
}

.bg-right {
  top: 140rpx;
  right: -80rpx;
  width: 320rpx;
  height: 320rpx;
  background: rgba(45, 64, 55, 0.12);
}

.topbar {
  position: relative;
  z-index: 2;
  height: 110rpx;
  padding: 18rpx 22rpx 8rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.plus-btn {
  width: 70rpx;
  height: 70rpx;
  line-height: 70rpx;
  text-align: center;
  border-radius: 22rpx;
  background: #2d4037;
  color: #fff7eb;
  font-size: 42rpx;
  font-weight: 700;
  box-shadow: 0 16rpx 30rpx rgba(45, 64, 55, 0.16);
}

.topbar-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.brand {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  color: #2c3a34;
}

.brand-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #897d71;
}

.workspace {
  position: relative;
  z-index: 2;
  height: calc(100vh - 110rpx - 96rpx);
  padding: 8rpx 18rpx 12rpx;
}

.panel {
  height: 100%;
  border-radius: 30rpx;
  background: rgba(255, 251, 245, 0.9);
  box-shadow: 0 20rpx 50rpx rgba(88, 74, 56, 0.08);
}

.chat-panel,
.history-panel,
.config-panel {
  display: flex;
  flex-direction: column;
  padding: 22rpx;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.panel-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #26362f;
}

.panel-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: #8d8276;
}

.count-badge {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #efe4d7;
  color: #5f5549;
  font-size: 22rpx;
}

.message-list,
.history-list,
.config-scroll {
  flex: 1;
  min-height: 0;
  margin-top: 18rpx;
}

.bottom-anchor {
  width: 100%;
  height: 2rpx;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 62rpx;
  height: 62rpx;
  line-height: 62rpx;
  text-align: center;
  border-radius: 50%;
  background: #e7dccf;
  color: #5d5146;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.message-row.assistant .avatar {
  background: #314740;
  color: #fff7eb;
}

.message-row.tool .avatar {
  background: #d67748;
  color: #fff7eb;
}

.bubble {
  max-width: 82%;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: #fffdf9;
  box-shadow: 0 10rpx 24rpx rgba(88, 74, 56, 0.06);
}

.message-row.user .bubble {
  background: linear-gradient(135deg, #2d4037, #41584f);
}

.message-row.tool .bubble {
  background: #fff1e6;
}

.bubble-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.role-name {
  font-size: 22rpx;
  font-weight: 700;
  color: #d67748;
}

.message-row.user .role-name {
  color: rgba(255, 247, 235, 0.72);
}

.streaming-badge {
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(214, 119, 72, 0.12);
  color: #d67748;
  font-size: 20rpx;
}

.bubble-text {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  line-height: 1.72;
  color: #2b302d;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-row.user .bubble-text {
  color: #fff7eb;
}

.composer {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 2rpx solid rgba(120, 101, 82, 0.08);
}

.composer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.composer-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #2d4037;
}

.composer-tip {
  flex: 1;
  text-align: right;
  font-size: 22rpx;
  line-height: 1.6;
  color: #897d71;
}

.composer-input {
  width: 100%;
  min-height: 108rpx;
  height: 118rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: #f7f0e7;
  font-size: 28rpx;
  line-height: 1.55;
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 14rpx;
}

.composer-btns {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.footer-status {
  flex: 1;
  font-size: 22rpx;
  color: #7c7368;
}

.stop-btn {
  min-width: 132rpx;
  height: 78rpx;
  line-height: 78rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  color: #2d4037;
  background: #e7ddd1;
}

.send-btn {
  min-width: 180rpx;
  height: 78rpx;
  line-height: 78rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  color: #fff7eb;
  background: linear-gradient(135deg, #d67748, #c95e2c);
}

.history-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f7f2ea;
  margin-bottom: 14rpx;
}

.history-item.active {
  background: linear-gradient(180deg, #314740, #3d564d);
}

.history-item.active .history-title,
.history-item.active .history-preview,
.history-item.active .history-delete {
  color: #fff7eb;
}

.history-main {
  flex: 1;
}

.history-title {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: #2f3f38;
}

.history-preview {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #8a7f73;
  word-break: break-word;
}

.history-delete {
  font-size: 22rpx;
  color: #d67748;
}

.config-intro {
  padding: 24rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #d67748 0%, #c85b2a 100%);
}

.config-eyebrow {
  display: block;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: rgba(255, 247, 235, 0.72);
}

.config-title {
  display: block;
  margin-top: 12rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: #fff7eb;
}

.config-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 247, 235, 0.84);
}

.config-card {
  margin-top: 18rpx;
  padding: 22rpx;
  border-radius: 28rpx;
  background: #fff8ef;
}

.config-card.dark {
  background: #f4ede4;
}

.config-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.config-card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #2d4037;
}

.config-card-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: #897e72;
}

.config-count {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #efe5d8;
  color: #65594e;
  font-size: 22rpx;
}

.form-grid {
  display: grid;
  gap: 14rpx;
  margin-top: 18rpx;
}

.field {
  width: 100%;
  min-height: 84rpx;
  padding: 0 22rpx;
  border-radius: 20rpx;
  background: #f6f0e7;
  border: 2rpx solid rgba(120, 101, 82, 0.08);
  font-size: 27rpx;
}

.field.light {
  background: #fbf7f1;
}

.action-row {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.action-row.two button {
  flex: 1;
}

.solid-btn,
.line-btn {
  height: 78rpx;
  line-height: 78rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.solid-btn {
  color: #fff7eb;
}

.solid-btn.accent {
  background: linear-gradient(135deg, #d67748, #c85b2a);
}

.solid-btn.deep {
  background: linear-gradient(135deg, #2d4037, #41584f);
  color: #fff7eb;
}

.line-btn {
  color: #2d4037;
  background: #e8dfd4;
}

.saved-grid {
  display: grid;
  gap: 12rpx;
  margin-top: 18rpx;
}

.saved-card {
  position: relative;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: #fffdf9;
  border: 2rpx solid transparent;
}

.saved-card.dark-card {
  background: #fbf7f2;
}

.saved-card.active {
  border-color: rgba(45, 64, 55, 0.24);
  background: linear-gradient(180deg, #314740, #3c554d);
}

.saved-card.active .saved-title,
.saved-card.active .saved-line,
.saved-card.active .saved-flag,
.saved-card.active .saved-delete {
  color: #fff7eb;
}

.saved-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #304039;
}

.saved-line {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: #877c70;
  word-break: break-all;
}

.saved-line.url {
  font-size: 21rpx;
}

.saved-flag {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  color: #d67748;
}

.saved-delete {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  font-size: 20rpx;
  color: #b95f38;
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  height: 96rpx;
  padding: 10rpx 14rpx 14rpx;
  background: rgba(250, 246, 239, 0.98);
  border-top: 2rpx solid rgba(120, 101, 82, 0.08);
}

.tab-item {
  flex: 1;
  height: 64rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b8174;
}

.tab-item.active {
  background: linear-gradient(135deg, #2d4037, #41584f);
  box-shadow: 0 14rpx 28rpx rgba(45, 64, 55, 0.14);
  color: #fff7eb;
}

.tab-text {
  font-size: 24rpx;
  font-weight: 700;
}
</style>
