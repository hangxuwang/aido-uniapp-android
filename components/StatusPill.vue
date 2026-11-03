<template>
  <view class="pill" :class="kind">
    <view class="dot" />
    <text>{{ text }}</text>
  </view>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: ''
    },
    kind: {
      type: String,
      default: 'idle'
    }
  }
};
</script>

<style scoped lang="scss">
.pill {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: currentColor;
}

.idle {
  color: #60708f;
  background: #edf2f7;
}

.working {
  color: #0f766e;
  background: #d8f3ee;
}

.error {
  color: #b42318;
  background: #fee4e2;
}
</style>
