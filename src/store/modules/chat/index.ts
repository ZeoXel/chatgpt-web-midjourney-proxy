import { defineStore } from 'pinia'
import { defaultState, getLocalState, setLocalState, setLocalStateWithDB, setLastChatUuid, getLastChatUuid, getLocalStateWithDB } from './helper'
import { router } from '@/router'
import { homeStore } from '@/store/homeStore'
import { sleep } from '@/api/suno'
import { mlog } from '@/api'

export const useChatStore = defineStore('chat-store', {
  state: (): Chat.ChatState => getLocalState(),

  getters: {
    getChatHistoryByCurrentActive(state: Chat.ChatState) {
      const index = state.history.findIndex(item => item.uuid === state.active)
      if (index !== -1)
        return state.history[index]
      return null
    },

    getChatByUuid(state: Chat.ChatState) {
      return (uuid?: number) => {
        if (uuid)
          return state.chat.find(item => item.uuid === uuid)?.data ?? []
        return state.chat.find(item => item.uuid === state.active)?.data ?? []
      }
    },
  },

  actions: {
    /**
     * 从数据库加载对话历史并合并到当前状态
     * 在应用启动时调用
     */
    async loadFromDatabase() {
      if (!homeStore.myData.session?.isDatabaseEnabled) {
        return
      }
      try {
        console.log('[Chat Store] 🌐 开始从数据库加载对话历史...')
        const mergedState = await getLocalStateWithDB()

        // 更新状态（保留当前的 active 和 usingContext）
        this.history = mergedState.history
        this.chat = mergedState.chat

        // 仅保存到本地，避免循环
        setLocalState(this.$state)

        console.log('[Chat Store] ✅ 数据库加载完成')
      } catch (error) {
        console.error('[Chat Store] ❌ 数据库加载失败:', error)
      }
    },

    setUsingContext(context: boolean) {
      this.usingContext = context
      this.recordState()
    },

    addHistory(history: Chat.History, chatData: Chat.Chat[] = []) {
      this.history.unshift(history)
      this.chat.unshift({ uuid: history.uuid, data: chatData })
      this.active = history.uuid
      this.reloadRoute(history.uuid)
    },

    updateHistory(uuid: number, edit: Partial<Chat.History>) {
      const index = this.history.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.history[index] = { ...this.history[index], ...edit }
        this.recordState()
      }
    },

    async deleteHistory(index: number) {
      // 删除本地数据
      this.history.splice(index, 1)
      this.chat.splice(index, 1)

      // 立即保存更新后的状态到本地和COS (会自动同步删除)
      this.recordState()

      if (this.history.length === 0) {
        this.active = null
        this.reloadRoute()
        return
      }

      if (index > 0 && index <= this.history.length) {
        const uuid = this.history[index - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
        return
      }

      if (index === 0) {
        if (this.history.length > 0) {
          const uuid = this.history[0].uuid
          this.active = uuid
          this.reloadRoute(uuid)
        }
      }

      if (index > this.history.length) {
        const uuid = this.history[this.history.length - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
      }
    },

    async setActive(uuid: number) {
      this.active = uuid
      // 保存聊天模块的最后活动uuid
      setLastChatUuid(uuid)
      return await this.reloadRoute(uuid)
    },

    getChatByUuidAndIndex(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length)
          return this.chat[0].data[index]
        return null
      }
      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1)
        return this.chat[chatIndex].data[index]
      return null
    },

    addChatByUuid(uuid: number, chat: Chat.Chat) {
      // 定义生图UUID的最大记录数限制
      const DRAW_UUID_MAX_MESSAGES = 50 // 生图历史最多保留50条消息
      const DRAW_UUID = 1002 // 默认生图UUID

      if (!uuid || uuid === 0) {
        if (this.history.length === 0) {
          const uuid = Date.now()
          this.history.push({ uuid, title: chat.text, isEdit: false })
          this.chat.push({ uuid, data: [chat] })
          this.active = uuid
          this.recordState()
        }
        else {
          this.chat[0].data.push(chat)
          if (this.history[0].title === 'New Chat')
            this.history[0].title = chat.text

          // 对生图UUID进行记录数量限制
          if (this.chat[0].uuid === DRAW_UUID && this.chat[0].data.length > DRAW_UUID_MAX_MESSAGES) {
            const excessCount = this.chat[0].data.length - DRAW_UUID_MAX_MESSAGES
            this.chat[0].data.splice(0, excessCount)
            mlog('自动清理生图历史', `删除了 ${excessCount} 条旧记录`)
          }

          this.recordState()
        }
        return
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.chat[index].data.push(chat)
        if (this.history[index].title === 'New Chat')
          this.history[index].title = chat.text

        // 对生图UUID进行记录数量限制
        if (uuid === DRAW_UUID && this.chat[index].data.length > DRAW_UUID_MAX_MESSAGES) {
          const excessCount = this.chat[index].data.length - DRAW_UUID_MAX_MESSAGES
          this.chat[index].data.splice(0, excessCount)
          mlog('自动清理生图历史', `删除了 ${excessCount} 条旧记录`)
        }

        this.recordState()
      }
    },

    updateChatByUuid(uuid: number, index: number, chat: Chat.Chat) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          this.chat[0].data[index] = chat
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        this.chat[chatIndex].data[index] = chat
        this.recordState()
      }
    },

    updateChatSomeByUuid(uuid: number, index: number, chat: Partial<Chat.Chat>) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          this.chat[0].data[index] = { ...this.chat[0].data[index], ...chat }
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        this.chat[chatIndex].data[index] = { ...this.chat[chatIndex].data[index], ...chat }
        this.recordState()
      }
    },

    // 更新聊天消息(仅UI,不触发COS保存) - 用于任务进行中的状态更新
    updateChatSomeByUuidNoSave(uuid: number, index: number, chat: Partial<Chat.Chat>) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          this.chat[0].data[index] = { ...this.chat[0].data[index], ...chat }
          // 仅保存到localStorage,不触发COS保存
          setLocalState(this.$state)
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        this.chat[chatIndex].data[index] = { ...this.chat[chatIndex].data[index], ...chat }
        // 仅保存到localStorage,不触发COS保存
        setLocalState(this.$state)
      }
    },

    deleteChatByUuid(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          this.chat[0].data.splice(index, 1)
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        this.chat[chatIndex].data.splice(index, 1)
        this.recordState()
      }
    },

    clearChatByUuid(uuid: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          this.chat[0].data = []
          this.recordState()
        }
        return
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.chat[index].data = []
        this.recordState()
      }

      //清空标题
      const i2= this.history.findIndex( v=>v.uuid===uuid )
      if (i2 !== -1) {
        this.history[i2].title= "New Chat"
         this.recordState()
      }
      //end 清空标题
    },

    clearHistory() {
      this.$state = { ...defaultState() }
      this.recordState()
    },

    async reloadRoute(uuid?: number) {
      this.recordState();
      mlog('toMyuid19','reloadRoute')
      //await sleep(1000)
      await router.push({ name: homeStore.myData.local=='draw'?'draw': 'Chat', params: { uuid } })
    },

    recordState() {
      // Phase 1: 保存到本地 + 数据库
      setLocalStateWithDB(this.$state)
    },
  },
})
