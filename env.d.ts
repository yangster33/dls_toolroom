/// <reference types="vite/client" />

// 激活 pinia-plugin-persistedstate 的模块增强（DefineStoreOptionsBase.persist），
// 使 setup store 的 persist 选项在 app 与 vitest 两个 TS 工程中都能通过类型检查。
import 'pinia-plugin-persistedstate'
