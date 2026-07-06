import { describe, expect, it } from 'vitest'

describe('Skeleton component module', () => {
  it('exports Skeleton function', async () => {
    const mod = await import('@/components/ui/skeleton')
    expect(mod.Skeleton).toBeDefined()
    expect(typeof mod.Skeleton).toBe('function')
  })

  it('exports SkeletonLine function', async () => {
    const mod = await import('@/components/ui/skeleton')
    expect(mod.SkeletonLine).toBeDefined()
    expect(typeof mod.SkeletonLine).toBe('function')
  })

  it('exports SkeletonCard function', async () => {
    const mod = await import('@/components/ui/skeleton')
    expect(mod.SkeletonCard).toBeDefined()
    expect(typeof mod.SkeletonCard).toBe('function')
  })

  it('exports SkeletonGrid function', async () => {
    const mod = await import('@/components/ui/skeleton')
    expect(mod.SkeletonGrid).toBeDefined()
    expect(typeof mod.SkeletonGrid).toBe('function')
  })

  it('Skeleton has display name or is a valid React component symbol', async () => {
    const mod = await import('@/components/ui/skeleton')
    const skeletonElement = mod.Skeleton({ className: 'test-class' })
    expect(skeletonElement).toBeDefined()
    expect(skeletonElement.props.className).toContain('animate-pulse')
    expect(skeletonElement.props.className).toContain('rounded-lg')
  })

  it('SkeletonLine renders with default width', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonLine({})
    expect(element).toBeDefined()
    expect(element.props.style).toEqual({ width: '100%' })
  })

  it('SkeletonLine applies custom className', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonLine({ className: 'w-24' })
    expect(element.props.className).toContain('h-4')
    expect(element.props.className).toContain('w-24')
  })

  it('SkeletonLine accepts custom width via style', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonLine({ width: '50%' })
    expect(element.props.style).toEqual({ width: '50%' })
  })

  it('SkeletonCard renders with card structure', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonCard({})
    expect(element).toBeDefined()
    expect(element.props.className).toContain('animate-pulse')
    expect(element.props.className).toContain('pointer-events-none')
    expect(element.props.className).toContain('border-[color:var(--border)]')
  })

  it('SkeletonGrid renders correct number of items', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonGrid({ count: 4 })
    expect(element.props.children).toHaveLength(4)
  })

  it('SkeletonGrid caps items when isMobile', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonGrid({ count: 12, isMobile: true })
    expect(element.props.children).toHaveLength(6)
  })

  it('SkeletonGrid defaults count to 12 on desktop', async () => {
    const mod = await import('@/components/ui/skeleton')
    const element = mod.SkeletonGrid({})
    expect(element.props.children).toHaveLength(12)
  })
})
