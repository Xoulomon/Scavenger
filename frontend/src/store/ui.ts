/**
 * store/ui.ts — UI slice
 *
 * Manages cross-cutting UI state:
 *   sidebar open/closed, active modal, global loading overlay, toast queue.
 */

export type ModalId = string | null

export interface UiState {
  sidebarOpen: boolean
  activeModal: ModalId
  globalLoading: boolean
  /** Tracks which panels/sections are currently loading */
  loadingKeys: Set<string>
}

export type UiAction =
  | { type: 'UI_SIDEBAR_OPEN' }
  | { type: 'UI_SIDEBAR_CLOSE' }
  | { type: 'UI_SIDEBAR_TOGGLE' }
  | { type: 'UI_MODAL_OPEN'; payload: string }
  | { type: 'UI_MODAL_CLOSE' }
  | { type: 'UI_GLOBAL_LOADING'; payload: boolean }
  | { type: 'UI_LOADING_KEY_ADD'; payload: string }
  | { type: 'UI_LOADING_KEY_REMOVE'; payload: string }

export const uiInitialState: UiState = {
  sidebarOpen: false,
  activeModal: null,
  globalLoading: false,
  loadingKeys: new Set()
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'UI_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: true }

    case 'UI_SIDEBAR_CLOSE':
      return { ...state, sidebarOpen: false }

    case 'UI_SIDEBAR_TOGGLE':
      return { ...state, sidebarOpen: !state.sidebarOpen }

    case 'UI_MODAL_OPEN':
      return { ...state, activeModal: action.payload }

    case 'UI_MODAL_CLOSE':
      return { ...state, activeModal: null }

    case 'UI_GLOBAL_LOADING':
      return { ...state, globalLoading: action.payload }

    case 'UI_LOADING_KEY_ADD': {
      const next = new Set(state.loadingKeys)
      next.add(action.payload)
      return { ...state, loadingKeys: next }
    }

    case 'UI_LOADING_KEY_REMOVE': {
      const next = new Set(state.loadingKeys)
      next.delete(action.payload)
      return { ...state, loadingKeys: next }
    }

    default:
      return state
  }
}
