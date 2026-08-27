import { describe, expect, it } from 'vitest'
import { BinaryHeap } from './BinaryHeap'

describe('BinaryHeap', () => {
  it('pops items in ascending score order', () => {
    const heap = new BinaryHeap<number>((value) => value)
    for (const value of [5, 3, 8, 1, 9, 2, 7]) heap.push(value)

    const popped: number[] = []
    while (heap.size > 0) popped.push(heap.pop() as number)

    expect(popped).toEqual([1, 2, 3, 5, 7, 8, 9])
  })

  it('returns undefined when empty', () => {
    const heap = new BinaryHeap<number>((value) => value)
    expect(heap.pop()).toBeUndefined()
    expect(heap.size).toBe(0)
  })

  it('orders by the provided score function rather than the value', () => {
    const heap = new BinaryHeap<{ name: string; f: number }>((node) => node.f)
    heap.push({ name: 'far', f: 90 })
    heap.push({ name: 'near', f: 2 })
    heap.push({ name: 'mid', f: 40 })

    expect(heap.pop()?.name).toBe('near')
    expect(heap.pop()?.name).toBe('mid')
    expect(heap.pop()?.name).toBe('far')
  })

  it('handles duplicate scores without losing entries', () => {
    const heap = new BinaryHeap<number>((value) => value)
    for (const value of [4, 4, 4, 1, 4]) heap.push(value)
    expect(heap.size).toBe(5)

    const popped: number[] = []
    while (heap.size > 0) popped.push(heap.pop() as number)
    expect(popped).toEqual([1, 4, 4, 4, 4])
  })

  it('clear empties the heap', () => {
    const heap = new BinaryHeap<number>((value) => value)
    heap.push(1)
    heap.push(2)
    heap.clear()
    expect(heap.size).toBe(0)
    expect(heap.pop()).toBeUndefined()
  })

  it('stays correct under randomised insertion', () => {
    const heap = new BinaryHeap<number>((value) => value)
    const values = Array.from({ length: 500 }, () => Math.floor(Math.random() * 10000))
    for (const value of values) heap.push(value)

    const popped: number[] = []
    while (heap.size > 0) popped.push(heap.pop() as number)

    expect(popped).toEqual([...values].sort((a, b) => a - b))
  })
})
