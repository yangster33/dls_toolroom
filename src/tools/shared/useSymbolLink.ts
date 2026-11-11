import { ref } from 'vue'
import type { CalcSymbol } from './calcTrace'

/**
 * 计算书符号与左侧输入框的联动高亮。
 *
 * chip 的 inputSymbol 对应输入控件上的 data-symbol；没有 inputSymbol 的计算值
 * 只高亮同名的输入项（如果有）。
 */
export function useSymbolLink() {
  const activeSymbol = ref('')

  function isActive(name: string): boolean {
    return activeSymbol.value === name
  }

  function activateSymbol(symbol: CalcSymbol) {
    activeSymbol.value = symbol.inputSymbol ?? symbol.symbol
  }

  function deactivate() {
    activeSymbol.value = ''
  }

  function chipActive(symbol: CalcSymbol): boolean {
    return (
      activeSymbol.value === symbol.symbol ||
      (symbol.inputSymbol !== undefined && activeSymbol.value === symbol.inputSymbol)
    )
  }

  return { activeSymbol, isActive, activateSymbol, deactivate, chipActive }
}
