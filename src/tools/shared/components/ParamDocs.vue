<template>
  <details class="panel param-panel">
    <summary>{{ title }}</summary>
    <div class="table-wrap">
      <table class="param-table">
        <thead>
          <tr>
            <th>符号</th>
            <th>名称</th>
            <th>含义</th>
            <th>在计算中的位置</th>
            <th>影响方向</th>
            <th>来源</th>
            <th>可修改</th>
            <th>依据</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in docs" :key="doc.symbol">
            <td class="readout">{{ doc.symbol }}</td>
            <td>{{ doc.name }}</td>
            <td>{{ doc.meaning }}</td>
            <td>{{ doc.position }}</td>
            <td>{{ doc.impact }}</td>
            <td>{{ doc.source }}</td>
            <td>{{ doc.editable }}</td>
            <td>{{ doc.basis }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { ParameterDoc } from '../calcTrace'

withDefaults(
  defineProps<{
    docs: ReadonlyArray<ParameterDoc>
    title?: string
  }>(),
  { title: '参数说明' },
)
</script>
