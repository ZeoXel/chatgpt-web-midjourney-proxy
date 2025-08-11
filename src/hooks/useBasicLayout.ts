import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

export function useBasicLayout() {
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isMobile = breakpoints.smaller('sm')
  const isTablet = breakpoints.between('sm', 'lg')

  return { 
    isMobile,
    isTablet
  }
}
