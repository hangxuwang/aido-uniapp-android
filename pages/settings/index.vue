<template>
  <view class="page">
    <view class="hero-card">
      <text class="hero-eyebrow">SETUP</text>
      <text class="hero-title">连接中心</text>
      <text class="hero-desc">把 AI 和服务器配置好。你只配 AI 也可以聊天，配上 SSH 后才会支持服务器操作。</text>
    </view>

    <view class="stack">
      <view class="block-card">
        <view class="block-head">
          <view>
            <text class="block-title">AI 模型</text>
            <text class="block-desc">OpenAI 兼容接口即可，例如官方、OneAPI、NewAPI。</text>
          </view>
          <text class="block-badge">{{ state.aiProfiles.length }} 个</text>
        </view>

        <view class="form-grid">
          <input v-model="aiForm.name" class="field" placeholder="配置名称，例如 OpenAI 主账号" />
          <input v-model="aiForm.baseUrl" class="field" placeholder="BaseURL，例如 https://api.openai.com/v1" />
          <input v-model="aiForm.apiKey" class="field" password placeholder="ApiKey" />
          <input v-model="aiForm.model" class="field" placeholder="模型名，例如 gpt-4o-mini" />
        </view>

        <view class="action-row">
          <button class="solid-btn" @click="saveAiProfile">保存 AI</button>
        </view>

        <view class="saved-grid">
          <view
            v-for="item in state.aiProfiles"
            :key="item.id"
            class="saved-card"
            :class="{ active: item.id === state.activeAiProfileId }"
            @click="pickAi(item.id)"
          >
            <text class="saved-name">{{ item.name || item.model }}</text>
            <text class="saved-meta">{{ item.model }}</text>
            <text class="saved-meta url">{{ item.baseUrl }}</text>
            <text class="saved-state">{{ item.id === state.activeAiProfileId ? '当前使用' : '点击设为当前' }}</text>
          </view>
        </view>
      </view>

      <view class="block-card ssh-card">
        <view class="block-head">
          <view>
            <text class="block-title">SSH 服务器</text>
            <text class="block-desc">这是可选项。不配置服务器时，AIDO 会以普通 AI 助手方式运行。</text>
          </view>
          <text class="block-badge">{{ state.sshProfiles.length }} 个</text>
        </view>

        <view class="form-grid">
          <input v-model="sshForm.name" class="field" placeholder="配置名称，例如 生产服务器" />
          <input v-model="sshForm.host" class="field" placeholder="IP 或域名" />
          <input v-model="sshForm.port" class="field" type="number" placeholder="端口，默认 22" />
          <input v-model="sshForm.username" class="field" placeholder="用户名" />
          <input v-model="sshForm.password" class="field" password placeholder="密码" />
        </view>

        <view class="action-row two">
          <button class="solid-btn deep" @click="saveSshProfile">保存 SSH</button>
          <button class="line-btn" @click="quickTestSsh">测试连接</button>
        </view>

        <view class="saved-grid">
          <view
            v-for="item in state.sshProfiles"
            :key="item.id"
            class="saved-card light"
            :class="{ active: item.id === state.activeSshProfileId }"
            @click="pickSsh(item.id)"
          >
            <text class="saved-name">{{ item.name || item.host }}</text>
            <text class="saved-meta">{{ item.username }}@{{ item.host }}:{{ item.port || 22 }}</text>
            <text class="saved-state">{{ item.id === state.activeSshProfileId ? '当前绑定' : '点击设为当前' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { createId, loadState, saveState, upsertById } from '../../utils/storage';
import { testSsh } from '../../services/nativeSsh';

export default {
  data() {
    return {
      state: loadState(),
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
  methods: {
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
    persist() {
      saveState(this.state);
    },
    saveSshProfile() {
      const normalized = this.buildNormalizedSshForm();
      if (!normalized.host || !normalized.username || !normalized.password) {
        uni.showToast({ title: '请补全 SSH 信息', icon: 'none' });
        return;
      }
      const item = Object.assign({}, normalized, {
        id: normalized.id || createId('ssh')
      });
      this.state.sshProfiles = upsertById(this.state.sshProfiles, item);
      this.state.activeSshProfileId = item.id;
      this.persist();
      this.sshForm = {
        id: '',
        name: '',
        host: '',
        port: '22',
        username: '',
        password: ''
      };
      uni.showToast({ title: 'SSH 已保存', icon: 'success' });
    },
    async quickTestSsh() {
      const candidate = this.sshForm.host
        ? this.buildNormalizedSshForm()
        : this.state.sshProfiles.find((item) => item.id === this.state.activeSshProfileId);

      if (!candidate) {
        uni.showToast({ title: '先填写或选择 SSH', icon: 'none' });
        return;
      }

      if (!candidate.host || !candidate.username || !candidate.password) {
        uni.showToast({ title: 'SSH 信息不完整', icon: 'none' });
        return;
      }

      uni.showLoading({ title: '连接中...' });
      try {
        const result = await testSsh(candidate);
        uni.hideLoading();
        const ok = result.code === 0 && /AIDO_SSH_OK/.test(result.stdout || '');
        uni.showModal({
          title: ok ? '连接成功' : '连接结果',
          content: ok ? 'SSH 测试通过。' : `${result.stderr || result.stdout || '未返回内容'}`,
          showCancel: false
        });
      } catch (error) {
        uni.hideLoading();
        uni.showModal({
          title: '连接失败',
          content: error.message,
          showCancel: false
        });
      }
    },
    pickSsh(id) {
      this.state.activeSshProfileId = id;
      this.persist();
    },
    saveAiProfile() {
      if (!this.aiForm.baseUrl || !this.aiForm.apiKey || !this.aiForm.model) {
        uni.showToast({ title: '请补全 AI 信息', icon: 'none' });
        return;
      }
      const item = Object.assign({}, this.aiForm, {
        id: this.aiForm.id || createId('ai')
      });
      this.state.aiProfiles = upsertById(this.state.aiProfiles, item);
      this.state.activeAiProfileId = item.id;
      this.persist();
      this.aiForm = {
        id: '',
        name: '',
        baseUrl: '',
        apiKey: '',
        model: ''
      };
      uni.showToast({ title: 'AI 已保存', icon: 'success' });
    },
    pickAi(id) {
      this.state.activeAiProfileId = id;
      this.persist();
    }
  }
};
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 26rpx 24rpx 36rpx;
  background:
    radial-gradient(circle at top left, rgba(214, 119, 72, 0.12), transparent 28%),
    linear-gradient(180deg, #f4eee5 0%, #f7f4ef 100%);
}

.hero-card {
  padding: 28rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #d67748 0%, #c85b2a 100%);
  box-shadow: 0 24rpx 56rpx rgba(200, 91, 42, 0.18);
}

.hero-eyebrow {
  display: block;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: rgba(255, 247, 235, 0.72);
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  font-size: 48rpx;
  font-weight: 800;
  color: #fff7eb;
}

.hero-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.65;
  color: rgba(255, 247, 235, 0.82);
}

.stack {
  margin-top: 22rpx;
  display: grid;
  gap: 20rpx;
}

.block-card {
  padding: 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 252, 246, 0.86);
  box-shadow: 0 18rpx 48rpx rgba(88, 74, 56, 0.08);
}

.ssh-card {
  background: rgba(248, 243, 236, 0.92);
}

.block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.block-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #2d4037;
}

.block-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #8a7f72;
}

.block-badge {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #efe5d8;
  color: #6e6257;
  font-size: 22rpx;
}

.form-grid {
  margin-top: 20rpx;
  display: grid;
  gap: 16rpx;
}

.field {
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: 22rpx;
  background: #f7f1e8;
  border: 2rpx solid rgba(120, 101, 82, 0.08);
  font-size: 28rpx;
}

.action-row {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.action-row.two button {
  flex: 1;
}

.solid-btn,
.line-btn {
  height: 82rpx;
  line-height: 82rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.solid-btn {
  color: #fff7eb;
  background: linear-gradient(135deg, #d67748, #c85b2a);
}

.solid-btn.deep {
  background: linear-gradient(135deg, #2d4037, #41584f);
}

.line-btn {
  color: #2d4037;
  background: #e9e1d6;
}

.saved-grid {
  margin-top: 20rpx;
  display: grid;
  gap: 14rpx;
}

.saved-card {
  padding: 22rpx;
  border-radius: 24rpx;
  background: #fff8f0;
  border: 2rpx solid transparent;
}

.saved-card.light {
  background: #f4eee5;
}

.saved-card.active {
  border-color: rgba(45, 64, 55, 0.24);
  background: linear-gradient(180deg, #314740, #3c554d);
}

.saved-card.active .saved-name,
.saved-card.active .saved-meta,
.saved-card.active .saved-state {
  color: #fff7eb;
}

.saved-name {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: #2f3e38;
}

.saved-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #877b6f;
  word-break: break-all;
}

.saved-meta.url {
  line-height: 1.5;
}

.saved-state {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #d67748;
}
</style>
