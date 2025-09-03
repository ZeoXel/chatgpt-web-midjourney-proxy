import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { gptServerStore } from "@/store/homeStore";

interface TokenQuotaResponse {
  id: number;
  name: string;
  quota: number;
}

export const useBalanceStore = defineStore("balance-store", () => {
  // 状态
  const usedAmount = ref<number>(0); // API返回的已使用额度（负值）
  const rechargeAmount = ref<number>(100); // 充值金额（元），默认100元
  const lastUpdateTime = ref<number>(Date.now());
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const actualBalance = computed(() => {
    // 真正的余额 = 充值金额 + 使用额度（使用额度为负值）
    return rechargeAmount.value + usedAmount.value;
  });
  
  const displayBalance = computed(() => {
    // 显示余额：实际余额 * 10000（1元=10000零素）
    return Math.round(actualBalance.value * 10000);
  });

  const formattedBalance = computed(() => {
    return displayBalance.value.toLocaleString("zh-CN");
  });
  
  const formattedRechargeAmount = computed(() => {
    return (rechargeAmount.value * 10000).toLocaleString("zh-CN");
  });
  
  const formattedUsedAmount = computed(() => {
    return Math.abs(usedAmount.value * 10000).toLocaleString("zh-CN");
  });

  // 获取余额
  async function fetchBalance() {
    if (isLoading.value) return;

    try {
      isLoading.value = true;
      error.value = null;

      // 获取API配置
      const apiKey = gptServerStore.myData.OPENAI_API_KEY;
      const baseUrl = gptServerStore.myData.OPENAI_API_BASE_URL || "";

      if (!apiKey) {
        throw new Error("API Key未配置");
      }

      // 调用余额查询接口
      const response = await fetch(`${baseUrl}/v1/token/quota`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`);
      }

      const data: TokenQuotaResponse = await response.json();

      // 更新使用额度
      usedAmount.value = data.quota;
      lastUpdateTime.value = Date.now();

      // 缓存到localStorage
      localStorage.setItem(
        "user-balance",
        JSON.stringify({
          usedAmount: usedAmount.value,
          rechargeAmount: rechargeAmount.value,
          updateTime: lastUpdateTime.value,
        }),
      );
    } catch (err: any) {
      error.value = err.message || "获取余额失败";
      console.error("获取余额失败:", err);
    } finally {
      isLoading.value = false;
    }
  }

  // 充值功能
  function addRecharge(amount: number) {
    rechargeAmount.value += amount;
    
    // 更新缓存
    localStorage.setItem(
      "user-balance",
      JSON.stringify({
        usedAmount: usedAmount.value,
        rechargeAmount: rechargeAmount.value,
        updateTime: lastUpdateTime.value,
      }),
    );
  }

  // 初始化时从缓存加载
  function initFromCache() {
    const cached = localStorage.getItem("user-balance");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        usedAmount.value = data.usedAmount || 0;
        rechargeAmount.value = data.rechargeAmount || 100; // 默认100元
        lastUpdateTime.value = data.updateTime || Date.now();
      } catch (e) {
        console.error("加载缓存失败:", e);
      }
    }
  }

  // 初始化
  initFromCache();

  return {
    // 状态
    usedAmount,
    rechargeAmount,
    actualBalance,
    displayBalance,
    formattedBalance,
    formattedRechargeAmount,
    formattedUsedAmount,
    lastUpdateTime,
    isLoading,
    error,

    // 方法
    fetchBalance,
    addRecharge,
  };
});
