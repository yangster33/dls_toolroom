import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';

export interface UseEChartsOptions<T> {
  data: { value: T | null };
  getChartOption: (data: T, theme: Record<string, string>) => EChartsOption | null;
  themeVariables?: Record<string, () => string>;
}

export function useECharts<T>(options: UseEChartsOptions<T>) {
  const { data, getChartOption, themeVariables = {} } = options;
  const chartContainer = ref<HTMLDivElement | null>(null);
  let chartInstance: ECharts | null = null;
  let chartInitialized = false;
  const chartLoading = ref(false);

  const initChart = async () => {
    if (!chartContainer.value || data.value === null)
      return;
    if (!chartInitialized) {
      const { clientWidth, clientHeight } = chartContainer.value;
      if (clientWidth === 0 || clientHeight === 0)
        return;
      chartInitialized = true;
      chartInstance = echarts.init(chartContainer.value);
      await updateChart();
    }
    else {
      chartInstance?.resize();
      await updateChart();
    }
  };

  const updateChart = async () => {
    await nextTick();
    if (!chartInstance || data.value === null)
      return;
    const theme: Record<string, string> = Object.fromEntries(
      Object.entries(themeVariables).map(([key, getter]) => [key, getter()])
    );
    const option = getChartOption(data.value, theme);
    if (option) {
      chartInstance.setOption(option, true);
    }
  };

  const disposeChart = () => {
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
    chartInitialized = false;
  };

  const handleDataChange = async (newData: T | null) => {
    if (!newData) {
      disposeChart();
      return;
    }
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
      chartInitialized = false;
    }
    chartLoading.value = true;
    await nextTick();
    chartLoading.value = false;
    await nextTick();
    initChart();
  };

  const handleThemeChange = () => {
    if (chartInitialized) {
      updateChart();
    }
  };

  const handleResize = () => {
    if (chartInitialized) {
      chartInstance?.resize();
    }
  };

  watch(() => data.value, handleDataChange);

  if (Object.keys(themeVariables).length > 0) {
    watch(Object.values(themeVariables), handleThemeChange);
  }

  onMounted(() => {
    if (data.value !== null) {
      initChart();
    }
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    disposeChart();
    window.removeEventListener('resize', handleResize);
  });

  return {
    chartContainer,
    chartLoading,
    initChart,
    disposeChart,
  };
}
