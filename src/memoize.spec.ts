import { expect, it, vi } from 'vitest'
import { memoize } from './memoize'

const onInit = vi.fn()
const oneProvider = memoize(() => {
  onInit()
  return 1
})

it('memoizes function', () => {
  expect(onInit).not.toHaveBeenCalled()

  expect(oneProvider()).toEqual(1)
  expect(onInit).toHaveBeenCalledTimes(1)

  expect(oneProvider()).toEqual(1)
  expect(onInit).toHaveBeenCalledTimes(1)
})
