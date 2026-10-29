import { describe, expect, it } from 'vitest';
import { TDeterministicMinHeap, TFifoQueue } from './collections';

describe('TFifoQueue', () => {
  it('dequeues in insertion order and tracks size', () => {
    const queue = new TFifoQueue<number>();
    for (let i = 0; i < 100; i += 1) queue.enqueue(i);
    expect(queue.size).toBe(100);
    for (let i = 0; i < 100; i += 1) expect(queue.dequeue()).toBe(i);
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });

  it('clear empties the queue', () => {
    const queue = new TFifoQueue<string>();
    queue.enqueue('a');
    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });
});

describe('TDeterministicMinHeap', () => {
  it('pops in ascending cost order', () => {
    const heap = new TDeterministicMinHeap<string>();
    heap.push('c', 3);
    heap.push('a', 1);
    heap.push('d', 4);
    heap.push('b', 2);
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual(['a', 'b', 'c', 'd']);
    expect(heap.pop()).toBeUndefined();
  });

  it('breaks ties deterministically (insertion order)', () => {
    const heap = new TDeterministicMinHeap<string>();
    ['x', 'y', 'z', 'w'].forEach((v) => heap.push(v, 1));
    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual(['x', 'y', 'z', 'w']);
  });
});
