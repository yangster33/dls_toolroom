<template>
  <details class="assumption-card" open>
    <summary>{{ title }}</summary>
    <table class="assumption-table">
      <tbody>
        <tr v-for="item in items" :key="item.label">
          <th scope="row">{{ item.label }}</th>
          <td class="readout">{{ item.value }}</td>
          <td class="assumption-note">{{ item.note }}</td>
        </tr>
      </tbody>
    </table>
  </details>
</template>

<script setup lang="ts">
export interface AssumptionItem {
  label: string
  value: string
  note: string
}

withDefaults(
  defineProps<{
    items: ReadonlyArray<AssumptionItem>
    title?: string
  }>(),
  { title: '简易模式假定（固定值参与计算）' },
)
</script>
