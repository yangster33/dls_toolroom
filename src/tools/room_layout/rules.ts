/**
 * 默认规则（工程建议值，可在页面覆盖）。
 *
 * 来源：GB 50174 / GB 51194 / GB 50311 的常用取值；不同项目/等级可能更严，
 * 页面明确标注「方案示意，需工程师复核」。
 */
import type { LayoutRules } from './types'

export const DEFAULT_RULES: LayoutRules = {
  cabinetW: 600,
  cabinetD: 1200,
  cabinetH: 2000,
  powerW: 800,
  powerD: 600,
  batteryW: 600,
  batteryD: 800,
  acW: 800,
  acD: 800,
  coldAisle: 1200,
  hotAisle: 1000,
  handlingAisle: 1500,
  sideMaintenance: 600,
  perimeter: 600,
  powerFront: 1500,
  batteryAisle: 1000,
  acFront: 1500,
  trayWidth: 400,
  branchTrayWidth: 300,
  trayFillRatio: 0.45,
}
