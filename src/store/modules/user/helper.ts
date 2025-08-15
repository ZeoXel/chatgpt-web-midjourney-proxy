import { ss } from '@/utils/storage'
import { t } from '@/locales'
import { homeStore } from '@/store'
import defaultAvatar from '@/assets/avatar.jpg'
const LOCAL_NAME = 'userStorage'
const backgroundImage = homeStore.myData.session.backgroundImage ?? 'https://t.alcy.cc/fj/'

export interface UserInfo {
  avatar: string
  name: string
  backgroundImage?: string
  description: string
}

export interface UserState {
  userInfo: UserInfo
}

export function defaultSetting(): UserState {
  return {
    userInfo: {
      avatar: defaultAvatar,
      name: t('mjset.sysname'), // '零素觉醒AI工具平台',
      description: 'AI工具平台',
    },
  }
}

export function getLocalState(): UserState {
  const localSetting: UserState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: UserState): void {
  ss.set(LOCAL_NAME, setting)
}
