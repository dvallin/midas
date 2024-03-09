import { ComponentStorage } from './component-storage'

export interface SearchStorage<T> extends ComponentStorage<T> {
  match(value: Partial<T>): Promise<{ entityId: string; component: T }[]>
  suggest(key: keyof T, value: Partial<T>): Promise<string[]>
}
