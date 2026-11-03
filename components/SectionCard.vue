<template>
  <view class="section-card">
    <view v-if="title || extra" class="section-head">
      <view>
        <text v-if="title" class="section-title">{{ title }}</text>
        <text v-if="desc" class="section-desc">{{ desc }}</text>
      </view>
      <slot name="extra">
        <text v-if="extra" class="section-extra">{{ extra }}</text>
      </slot>
    </view>
    <slot />
  </view>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: ''
    },
    desc: {
      type: String,
      default: ''
    },
    extra: {
      type: String,
      default: ''
    }
  }
};
</script>

<style scoped lang="scss">
.section-card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18rpx 50rpx rgba(20, 33, 61, 0.08);
  backdrop-filter: blur(16rpx);
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #14213d;
}

.section-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #60708f;
  line-height: 1.5;
}

.section-extra {
  font-size: 22rpx;
  color: #0f766e;
}
</style>
