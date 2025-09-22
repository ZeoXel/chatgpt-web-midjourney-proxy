<script setup lang="ts">
import { mlog } from '@/api';
import { homeStore ,useChatStore} from '@/store';
import { watch } from 'vue'; 

const chatStore = useChatStore() //const chatStore = useChatStore()
//const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
// 移除自动创建新聊天的逻辑，避免切换页面时意外创建对话
// 原逻辑：watch homeStore.myData.local 变化时自动创建新聊天
// 问题：每次从其他模块返回聊天模块都会触发新建聊天
// watch( ()=>homeStore.myData.local,n=>{
//     if(! chatStore.active) return ;
//     const dataSources =    chatStore.getChatByUuid(+chatStore.active) ;
//     if( dataSources.length> 0 ){
//         chatStore.addHistory({ title: 'New Chat', uuid: Date.now(), isEdit: false })
//     }
// })
 
</script>

<template></template>