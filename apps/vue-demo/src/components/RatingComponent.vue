<template>
  <div class="rating-component">
    <div class="stars">
      <span 
        v-for="i in 5" 
        :key="i" 
        class="star" 
        :class="{ 'active': i <= rating }"
        @click="onStarClick(i)"
      >★</span>
    </div>
    <span class="rating-value">{{ rating }}/5</span>
  </div>
</template>

<script>
export default {
  name: 'RatingComponent',
  props: {
    value: {
      type: Number,
      default: 0
    },
    readOnly: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      rating: this.value || 0
    }
  },
  watch: {
    value(newVal) {
      this.rating = newVal;
    }
  },
  methods: {
    onStarClick(value) {
      if (this.readOnly) return;
      
      this.rating = value;
      this.$emit('update:value', value);
      this.$emit('change', value);
    }
  }
}
</script>

<style scoped>
.rating-component {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
}

.stars {
  display: flex;
  margin-right: 10px;
}

.star {
  font-size: 18px;
  color: #d1d1d1;
  cursor: pointer;
  transition: color 0.2s;
  user-select: none;
}

.star.active {
  color: #ffcc00;
}

.star:hover {
  color: #ffcc00;
}

.rating-value {
  font-size: 14px;
  color: #666;
}
</style> 